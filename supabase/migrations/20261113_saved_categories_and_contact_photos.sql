-- =====================================================================
--  Namma Info: Categories for Saved Cards and Owner Contact Photo Uploads
-- =====================================================================

-- 1. Add category column to connections (saved cards)
ALTER TABLE public.connections ADD COLUMN IF NOT EXISTS category text DEFAULT 'Saved';

-- 2. Allow users to update their own connections (e.g. changing category)
DROP POLICY IF EXISTS "Users can update their connections" ON public.connections;
CREATE POLICY "Users can update their connections" ON public.connections
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 3. update_saved_card_category RPC
CREATE OR REPLACE FUNCTION public.update_saved_card_category(
  p_connected_user_id uuid,
  p_category text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_me uuid := auth.uid();
BEGIN
  IF v_me IS NULL OR p_connected_user_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.connections
  SET category = nullif(btrim(p_category), '')
  WHERE user_id = v_me AND connected_user_id = p_connected_user_id;

  RETURN true;
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_saved_card_category TO authenticated;

-- 4. team_saved_cards with category support
DROP FUNCTION IF EXISTS public.team_saved_cards();
CREATE OR REPLACE FUNCTION public.team_saved_cards()
 RETURNS TABLE(employee_id uuid, employee_name text, connected_user_id uuid, saved_at timestamp with time zone, category text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT e.id AS employee_id,
         e.name AS employee_name,
         c.connected_user_id,
         c.created_at AS saved_at,
         coalesce(c.category, 'Saved') AS category
  FROM public.employees e
  JOIN public.connections c ON c.user_id = e.user_id
  WHERE e.owner_id = auth.uid() AND e.user_id IS NOT NULL
  ORDER BY c.created_at DESC;
END;
$$;
GRANT EXECUTE ON FUNCTION public.team_saved_cards TO authenticated;

-- 5. update_contact_card_photo RPC (allows owner/employee to add/replace card photos)
CREATE OR REPLACE FUNCTION public.update_contact_card_photo(
  p_contact_id uuid,
  p_front_path text default null,
  p_back_path text default null
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_role text := auth.role();
  v_contact contacts%rowtype;
BEGIN
  SELECT * INTO v_contact FROM public.contacts WHERE id = p_contact_id;
  IF NOT FOUND THEN RETURN false; END IF;

  IF v_role <> 'service_role' THEN
    IF v_me IS NULL OR (
      v_contact.owner_id <> v_me
      AND NOT EXISTS (
        SELECT 1 FROM public.employees
        WHERE owner_id = v_contact.owner_id
          AND id = v_contact.employee_id
          AND user_id = v_me
          AND login_enabled
      )
    ) THEN
      RAISE EXCEPTION 'Unauthorized';
    END IF;
  END IF;

  PERFORM set_config('nammainfo.contact_write', 'on', true);
  UPDATE public.contacts
  SET card_front_path = coalesce(p_front_path, card_front_path),
      card_back_path = coalesce(p_back_path, card_back_path)
  WHERE id = p_contact_id;

  RETURN true;
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_contact_card_photo TO authenticated, service_role;

-- 6. Storage insert & update policies for business-cards bucket
DROP POLICY IF EXISTS business_cards_insert ON storage.objects;
CREATE POLICY business_cards_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'business-cards' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.employees e
        where e.user_id = auth.uid() and e.login_enabled
          and (storage.foldername(name))[1] = e.owner_id::text
      )
    )
  );

DROP POLICY IF EXISTS business_cards_update ON storage.objects;
CREATE POLICY business_cards_update ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'business-cards' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.employees e
        where e.user_id = auth.uid() and e.login_enabled
          and (storage.foldername(name))[1] = e.owner_id::text
      )
    )
  );
