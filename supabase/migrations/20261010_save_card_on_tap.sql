-- Auto-save tapped cards to "Saved Cards"
-- ------------------------------------------------------------------
-- When a signed-in user opens someone's card (NFC tap, QR scan or link),
-- the page calls save_card(owner_id) in the background. One row per
-- (viewer, card owner); tapping again just moves it back to the top.

-- 1. Remove duplicates (keep the newest), then make the pair unique.
delete from public.connections a
using public.connections b
where a.user_id = b.user_id
  and a.connected_user_id = b.connected_user_id
  and a.created_at < b.created_at;

delete from public.connections a
using public.connections b
where a.user_id = b.user_id
  and a.connected_user_id = b.connected_user_id
  and a.ctid < b.ctid;

create unique index if not exists connections_user_connected_uniq
  on public.connections (user_id, connected_user_id);

-- 2. Save / unsave — always for the signed-in user only (auth.uid()),
--    so it's safe to expose; nobody can write into someone else's list.
create or replace function public.save_card(p_owner_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null or p_owner_id is null or v_me = p_owner_id then
    return false;
  end if;
  if not exists (select 1 from profiles where id = p_owner_id) then
    return false;
  end if;

  insert into connections (user_id, connected_user_id)
  values (v_me, p_owner_id)
  on conflict (user_id, connected_user_id)
  do update set created_at = now();

  return true;
end;
$$;

create or replace function public.unsave_card(p_owner_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from connections
  where user_id = auth.uid() and connected_user_id = p_owner_id;
$$;

revoke all on function public.save_card(uuid) from public;
revoke all on function public.unsave_card(uuid) from public;
grant execute on function public.save_card(uuid) to authenticated;
grant execute on function public.unsave_card(uuid) to authenticated;
