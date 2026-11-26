-- =====================================================================
-- Migration: Unified Fulfillment Jobs, Employee/Branch Card Templates,
--            Staff Notifications & CRM Follow-Up Engine
-- Date: 2026-11-26
-- =====================================================================

-- 1. Helper for Staff (Admin + Designer) RLS checks
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND (is_admin = true OR role IN ('admin', 'designer'))
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Company-level reusable card template & scheduled follow-up metadata
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS default_card_template_url TEXT,
  ADD COLUMN IF NOT EXISTS default_card_design_notes TEXT,
  ADD COLUMN IF NOT EXISTS next_followup_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_followup_note TEXT;

-- 3. Employee-level physical card design fields
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS card_design_mode TEXT DEFAULT 'company_template',
  ADD COLUMN IF NOT EXISTS card_design_url TEXT,
  ADD COLUMN IF NOT EXISTS card_design_notes TEXT;

DO $$
BEGIN
  ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_card_design_mode_check;
  ALTER TABLE public.employees ADD CONSTRAINT employees_card_design_mode_check
    CHECK (card_design_mode IN ('company_template', 'custom_upload', 'team_assist'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 4. Branch-level physical card design fields
ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS card_design_mode TEXT DEFAULT 'company_template',
  ADD COLUMN IF NOT EXISTS card_design_url TEXT,
  ADD COLUMN IF NOT EXISTS card_design_notes TEXT;

DO $$
BEGIN
  ALTER TABLE public.branches DROP CONSTRAINT IF EXISTS branches_card_design_mode_check;
  ALTER TABLE public.branches ADD CONSTRAINT branches_card_design_mode_check
    CHECK (card_design_mode IN ('company_template', 'custom_upload', 'team_assist'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 5. Canonical Physical Fulfillment Jobs
CREATE TABLE IF NOT EXISTS public.fulfillment_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  job_type TEXT NOT NULL CHECK (job_type IN ('pro_initial', 'free_trial', 'team_addon', 'primary_addon', 'reprint')),
  stage TEXT NOT NULL DEFAULT 'awaiting_customer'
    CHECK (stage IN ('awaiting_customer', 'sent_to_designer', 'printed_ready', 'posted', 'delivered', 'cancelled')),
  card_quantity INTEGER NOT NULL DEFAULT 1,
  master_template_url TEXT,
  design_notes TEXT,
  shipping_address JSONB NOT NULL DEFAULT '{}'::jsonb,
  courier_name TEXT,
  tracking_number TEXT,
  sent_to_designer_at TIMESTAMPTZ,
  printed_at TIMESTAMPTZ,
  posted_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  last_updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  last_updated_by_role TEXT,
  last_updated_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fulfillment_jobs_profile_id ON public.fulfillment_jobs(profile_id);
CREATE INDEX IF NOT EXISTS idx_fulfillment_jobs_stage ON public.fulfillment_jobs(stage);
CREATE INDEX IF NOT EXISTS idx_fulfillment_jobs_order_id ON public.fulfillment_jobs(order_id);
CREATE INDEX IF NOT EXISTS idx_fulfillment_jobs_created_at ON public.fulfillment_jobs(created_at DESC);

ALTER TABLE public.fulfillment_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can view own fulfillment jobs" ON public.fulfillment_jobs;
CREATE POLICY "Owners can view own fulfillment jobs"
  ON public.fulfillment_jobs FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid() OR public.is_staff());

DROP POLICY IF EXISTS "Staff manage all fulfillment jobs" ON public.fulfillment_jobs;
CREATE POLICY "Staff manage all fulfillment jobs"
  ON public.fulfillment_jobs FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- 6. Individual Card Items inside each Production Batch
CREATE TABLE IF NOT EXISTS public.fulfillment_job_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.fulfillment_jobs(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('primary', 'employee', 'branch')),
  employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  designation TEXT,
  phone TEXT,
  photo_url TEXT,
  public_card_url TEXT NOT NULL,
  design_mode TEXT NOT NULL DEFAULT 'company_template'
    CHECK (design_mode IN ('company_template', 'custom_upload', 'team_assist')),
  design_file_url TEXT,
  design_notes TEXT,
  is_printed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fulfillment_job_items_job_id ON public.fulfillment_job_items(job_id);
CREATE INDEX IF NOT EXISTS idx_fulfillment_job_items_profile_id ON public.fulfillment_job_items(profile_id);
CREATE INDEX IF NOT EXISTS idx_fulfillment_job_items_employee_id ON public.fulfillment_job_items(employee_id);
CREATE INDEX IF NOT EXISTS idx_fulfillment_job_items_branch_id ON public.fulfillment_job_items(branch_id);

ALTER TABLE public.fulfillment_job_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners view own fulfillment job items" ON public.fulfillment_job_items;
CREATE POLICY "Owners view own fulfillment job items"
  ON public.fulfillment_job_items FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid() OR public.is_staff());

DROP POLICY IF EXISTS "Staff manage all fulfillment job items" ON public.fulfillment_job_items;
CREATE POLICY "Staff manage all fulfillment job items"
  ON public.fulfillment_job_items FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- 7. Immutable Audit Trail for Stage Transitions
CREATE TABLE IF NOT EXISTS public.fulfillment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.fulfillment_jobs(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_role TEXT NOT NULL,
  actor_name TEXT,
  from_stage TEXT,
  to_stage TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fulfillment_events_job_id ON public.fulfillment_events(job_id, created_at DESC);

ALTER TABLE public.fulfillment_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read fulfillment events" ON public.fulfillment_events;
CREATE POLICY "Staff read fulfillment events"
  ON public.fulfillment_events FOR SELECT
  TO authenticated
  USING (public.is_staff());

-- 8. Persistent Staff Notifications (Admin, Designer, Partner)
CREATE TABLE IF NOT EXISTS public.staff_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_role TEXT NOT NULL CHECK (recipient_role IN ('admin', 'designer', 'partner')),
  recipient_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'action_required', 'urgent')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  dedupe_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_notifications_role_read ON public.staff_notifications(recipient_role, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_staff_notifications_user ON public.staff_notifications(recipient_user_id, is_read, created_at DESC);

ALTER TABLE public.staff_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own or role notifications" ON public.staff_notifications;
CREATE POLICY "Users read own or role notifications"
  ON public.staff_notifications FOR SELECT
  TO authenticated
  USING (
    recipient_user_id = auth.uid()
    OR (
      recipient_user_id IS NULL
      AND (
        (recipient_role = 'admin' AND public.is_admin())
        OR (recipient_role = 'designer' AND public.is_staff())
      )
    )
  );

-- 9. CRM Follow-Up Schedule (30/60/90-day, 3-day expiry & custom reminders)
CREATE TABLE IF NOT EXISTS public.crm_followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_role TEXT NOT NULL CHECK (assigned_role IN ('admin', 'partner')),
  assigned_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  followup_type TEXT NOT NULL CHECK (followup_type IN ('day_30', 'day_60', 'day_90', 'expiry_3d', 'custom')),
  due_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'dismissed')),
  notes TEXT,
  completed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  completed_by_role TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_followups_due ON public.crm_followups(status, due_at);
CREATE INDEX IF NOT EXISTS idx_crm_followups_profile ON public.crm_followups(profile_id);

ALTER TABLE public.crm_followups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage crm followups" ON public.crm_followups;
CREATE POLICY "Staff manage crm followups"
  ON public.crm_followups FOR ALL
  TO authenticated
  USING (public.is_staff() OR assigned_user_id = auth.uid())
  WITH CHECK (public.is_staff() OR assigned_user_id = auth.uid());

-- 10. Idempotent Backfill: Existing physical orders -> fulfillment_jobs
INSERT INTO public.fulfillment_jobs (
  profile_id,
  order_id,
  job_type,
  stage,
  card_quantity,
  master_template_url,
  design_notes,
  shipping_address,
  created_at,
  updated_at
)
SELECT
  o.profile_id,
  o.id,
  CASE
    WHEN o.order_type = 'primary_card_addon' THEN 'primary_addon'
    WHEN o.order_type = 'team_addon' THEN 'team_addon'
    ELSE 'pro_initial'
  END,
  CASE
    WHEN o.status = 'delivered' THEN 'delivered'
    WHEN o.status = 'out_for_delivery' THEN 'posted'
    WHEN o.status = 'ready_to_dispatch' THEN 'printed_ready'
    WHEN o.status IN ('card_designed', 'on_work') THEN 'sent_to_designer'
    WHEN o.status = 'cancelled' THEN 'cancelled'
    ELSE 'awaiting_customer'
  END,
  GREATEST(1, COALESCE(o.card_quantity, 1)),
  COALESCE(o.design_url, o.shipping_address->'cardDetails'->>'fileUrl'),
  o.shipping_address->'cardDetails'->>'designNotes',
  COALESCE(o.shipping_address, '{}'::jsonb),
  o.created_at,
  COALESCE(o.updated_at, o.created_at)
FROM public.orders o
WHERE o.order_type IN ('pro_initial', 'team_addon', 'primary_card_addon')
  AND NOT EXISTS (
    SELECT 1 FROM public.fulfillment_jobs fj WHERE fj.order_id = o.id
  );

-- 11. Idempotent Backfill: Active Free Trials -> fulfillment_jobs
INSERT INTO public.fulfillment_jobs (
  profile_id,
  job_type,
  stage,
  card_quantity,
  master_template_url,
  created_at,
  updated_at
)
SELECT
  p.id,
  'free_trial',
  CASE
    WHEN COALESCE((p.card_process->'card_delivered'->>'completed')::boolean, false) THEN 'delivered'
    WHEN COALESCE((p.card_process->'card_posted'->>'completed')::boolean, false) THEN 'posted'
    WHEN COALESCE((p.card_process->'card_printed_approved'->>'completed')::boolean, false) THEN 'printed_ready'
    WHEN COALESCE((p.card_process->'customer_responded_designing'->>'completed')::boolean, false) THEN 'sent_to_designer'
    ELSE 'awaiting_customer'
  END,
  1,
  p.default_card_template_url,
  COALESCE(p.trial_approved_at, p.created_at),
  now()
FROM public.profiles p
WHERE p.subscription_plan = 'trial'
  AND NOT EXISTS (
    SELECT 1 FROM public.fulfillment_jobs fj WHERE fj.profile_id = p.id
  );

-- Enable realtime on notifications so Admin / Designer / Partner bells stay live
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_notifications;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

NOTIFY pgrst, 'reload schema';
