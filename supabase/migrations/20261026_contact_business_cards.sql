-- =====================================================================
--  Namma Info: visitors can add a photo of their business card
--  (front + back) in the "Share your contact details" popup.
--  Run AFTER 20261025_team_logins_and_contacts.sql. Safe to run twice.
-- =====================================================================

-- 1. Where the photos live: a PRIVATE bucket, max 500 KB per photo,
--    images only. (The app compresses each photo to ~80-180 KB first.)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('business-cards', 'business-cards', false, 512000, array['image/webp', 'image/jpeg'])
on conflict (id) do update
  set public = false,
      file_size_limit = 512000,
      allowed_mime_types = array['image/webp', 'image/jpeg'];

-- Photo paths look like:  <owner id>/<employee id or "owner">/<random>-front.webp
-- Owner sees all of the business's card photos; an employee sees the ones
-- from their own card. Nobody else (and nobody anonymous) can read them.
drop policy if exists business_cards_read on storage.objects;
create policy business_cards_read on storage.objects for select to authenticated
  using (
    bucket_id = 'business-cards' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.employees e
        where e.user_id = auth.uid() and e.login_enabled
          and (storage.foldername(name))[1] = e.owner_id::text
          and (storage.foldername(name))[2] = e.id::text
      )
    )
  );

-- Same people can delete them (deleting a contact removes its photos).
drop policy if exists business_cards_delete on storage.objects;
create policy business_cards_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'business-cards' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.employees e
        where e.user_id = auth.uid() and e.login_enabled
          and (storage.foldername(name))[1] = e.owner_id::text
          and (storage.foldername(name))[2] = e.id::text
      )
    )
  );
-- (No upload policy on purpose: uploads only happen through one-time
--  upload links handed out by the server, see /api/contacts/card-upload.)

-- 2. Every upload link the server hands out is logged here. Used for the
--    abuse limit, and so a contact can only point at photos really
--    uploaded for that business.
create table if not exists public.card_upload_tickets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete set null,
  front_path text not null,
  back_path text not null,
  ip_hash text,
  used boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists card_upload_tickets_owner_idx on public.card_upload_tickets (owner_id, created_at desc);
create index if not exists card_upload_tickets_ip_idx on public.card_upload_tickets (ip_hash, created_at desc);
alter table public.card_upload_tickets enable row level security;  -- server only, no policies

-- 3. Contacts keep the photo paths. A contact may now be just a card photo
--    (no number typed); the owner can fill the details in from the photo.
alter table public.contacts add column if not exists card_front_path text;
alter table public.contacts add column if not exists card_back_path text;

alter table public.contacts drop constraint if exists contacts_has_way_to_reach;
alter table public.contacts add constraint contacts_has_way_to_reach
  check (phone is not null or email is not null or card_front_path is not null);

-- 4. Guard: owner/employee may now also correct the name, number and email
--    (e.g. typing them in from the card photo). Who the contact belongs to
--    and the photo paths still can't be changed.
create or replace function public.contacts_guard()
returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('nammainfo.contact_write', true), '') = 'on' then
    return new; -- submit_contact
  end if;
  if new.owner_id <> old.owner_id
     or new.employee_id is distinct from old.employee_id
     or new.visitor_user_id is distinct from old.visitor_user_id
     or new.card_front_path is distinct from old.card_front_path
     or new.card_back_path is distinct from old.card_back_path
     or new.created_at <> old.created_at then
    raise exception 'This part of a contact can''t be changed';
  end if;
  new.name := left(btrim(new.name), 80);
  if new.name = '' then new.name := old.name; end if;
  new.phone := nullif(left(regexp_replace(coalesce(new.phone, ''), '[^0-9+]', '', 'g'), 16), '');
  new.email := nullif(left(lower(btrim(coalesce(new.email, ''))), 120), '');
  new.category := left(btrim(new.category), 24);
  if new.category = '' then new.category := 'New'; end if;
  new.note := left(new.note, 500);
  return new;
end;
$$;

-- 5. submit_contact now also accepts the two photo paths (both optional).
drop function if exists public.submit_contact(uuid, uuid, text, text, text, text);
create or replace function public.submit_contact(
  p_owner_id uuid,
  p_employee_id uuid,
  p_name text,
  p_phone text,
  p_email text,
  p_source text default 'card',
  p_card_front text default null,
  p_card_back text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_name text := left(btrim(coalesce(p_name, '')), 80);
  v_digits text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  v_phone text;
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_front text;
  v_back text;
  v_ticket uuid;
  v_existing uuid;
begin
  -- One format per number ("98450 12345" = "+91 98450 12345").
  if length(v_digits) = 12 and v_digits like '91%' then v_digits := right(v_digits, 10);
  elsif length(v_digits) = 11 and v_digits like '0%' then v_digits := right(v_digits, 10);
  end if;
  if length(v_digits) = 10 then v_phone := v_digits;
  elsif length(v_digits) between 7 and 15 then v_phone := '+' || v_digits;
  end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then v_email := null; end if;

  if not exists (select 1 from profiles where id = p_owner_id) then return false; end if;
  if p_employee_id is not null
     and not exists (select 1 from employees where id = p_employee_id and owner_id = p_owner_id) then
    return false;
  end if;

  -- Card photos: only accepted if the server issued that upload for this card.
  if p_card_front is not null then
    select id, front_path, case when p_card_back = back_path then back_path end
      into v_ticket, v_front, v_back
    from card_upload_tickets
    where owner_id = p_owner_id
      and employee_id is not distinct from p_employee_id
      and front_path = p_card_front
      and not used
      and created_at > now() - interval '1 day'
    limit 1;
  end if;

  if v_name = '' and v_front is not null then v_name := 'Business card'; end if;
  if v_name = '' then return false; end if;
  if v_phone is null and v_email is null and v_front is null then return false; end if;

  -- Don't record the business's own people looking at their cards.
  if v_me is not null and (
       v_me = p_owner_id
       or exists (select 1 from employees where owner_id = p_owner_id and user_id = v_me)
     ) then
    return false;
  end if;

  -- Basic spam guard: at most 60 new contacts per business per 10 minutes.
  if (select count(*) from contacts
      where owner_id = p_owner_id and created_at > now() - interval '10 minutes') >= 60 then
    return false;
  end if;

  perform set_config('nammainfo.contact_write', 'on', true);
  if v_ticket is not null then
    update card_upload_tickets set used = true where id = v_ticket;
  end if;

  if v_phone is not null or v_email is not null then
    select id into v_existing
    from contacts
    where owner_id = p_owner_id
      and employee_id is not distinct from p_employee_id
      and ((v_phone is not null and phone = v_phone) or (v_email is not null and email = v_email))
    order by last_seen_at desc
    limit 1;
  end if;

  if v_existing is not null then
    update contacts
    set name = case when v_name = 'Business card' then name else v_name end,
        phone = coalesce(v_phone, phone),
        email = coalesce(v_email, email),
        card_front_path = coalesce(v_front, card_front_path),
        card_back_path = coalesce(v_back, card_back_path),
        visitor_user_id = coalesce(v_me, visitor_user_id),
        visits = visits + case when last_seen_at < now() - interval '1 hour' then 1 else 0 end,
        last_seen_at = now()
    where id = v_existing;
  else
    insert into contacts (owner_id, employee_id, name, phone, email, visitor_user_id, source, card_front_path, card_back_path)
    values (p_owner_id, p_employee_id, v_name, v_phone, v_email, v_me, left(coalesce(p_source, 'card'), 20), v_front, v_back);
  end if;
  return true;
end;
$$;

revoke all on function public.submit_contact(uuid, uuid, text, text, text, text, text, text) from public;
grant execute on function public.submit_contact(uuid, uuid, text, text, text, text, text, text) to anon, authenticated;
