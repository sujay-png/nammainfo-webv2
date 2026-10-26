-- =====================================================================
-- NAMMA INFO - COMPLETE DATABASE SCHEMA & SETUP SCRIPT
-- =====================================================================
-- Run this complete script in your Supabase Project's SQL Editor.
-- It creates all tables, constraints, indexes, triggers, RLS policies,
-- storage buckets, and initial administrative permissions.
-- =====================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================================
-- 2. TABLES
-- =====================================================================

-- A. PROFILES (Business & User Accounts)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT,
  owner_name TEXT,
  job_title TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  bio TEXT,
  avatar_url TEXT,
  cover_url TEXT,
  logo_url TEXT,
  slug TEXT UNIQUE,
  username TEXT UNIQUE,
  card_designed BOOLEAN DEFAULT false,
  is_member BOOLEAN DEFAULT false,
  membership_expires_at TIMESTAMPTZ,
  years_in_business INTEGER,
  clients_served INTEGER,
  coverage_area TEXT,
  address TEXT,
  city TEXT,
  pincode TEXT,
  gst_number TEXT,
  brochure_url TEXT,
  google_place_id TEXT,
  maps_url TEXT,
  services JSONB DEFAULT '[]'::jsonb,
  products JSONB DEFAULT '[]'::jsonb,
  gallery JSONB DEFAULT '[]'::jsonb,
  social_links JSONB DEFAULT '[]'::jsonb,
  bank_accounts JSONB DEFAULT '[]'::jsonb,
  theme TEXT DEFAULT 'default',
  is_admin BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'expired', 'pending')),
  subscription_plan TEXT DEFAULT 'free',
  primary_card_count INTEGER DEFAULT 0,
  purchased_id_count INTEGER DEFAULT 0,
  subscription_started_at TIMESTAMPTZ DEFAULT now(),
  follow_up_status TEXT DEFAULT 'unattended' CHECK (follow_up_status IN ('unattended', 'attended')),
  follow_up_notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- B. CARDS (NFC Digital & Physical Cards)
CREATE TABLE IF NOT EXISTS public.cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  public_slug TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  tap_count INTEGER DEFAULT 0,
  physical_card_ordered BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- C. EMPLOYEES (Organization Team Members)
CREATE TABLE IF NOT EXISTS public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  designation TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  slug TEXT NOT NULL,
  avatar_url TEXT,
  cover_url TEXT,
  is_active BOOLEAN DEFAULT true,
  is_premium BOOLEAN DEFAULT false,
  subscription_started_at TIMESTAMPTZ,
  subscription_expires_at TIMESTAMPTZ,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'unassigned')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- D. CONNECTIONS (Saved Cards & Contacts on Tap)
CREATE TABLE IF NOT EXISTS public.connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  connected_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- E. POSTS (Announcements, Updates & Events)
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  post_type TEXT NOT NULL CHECK (post_type IN ('announcement', 'event', 'update')),
  media_url TEXT,
  event_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- F. REVIEWS (Customer Testimonials & Ratings)
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reviewer_name TEXT NOT NULL,
  reviewer_email TEXT,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- G. ORDERS (Physical NFC Cards & Pro Membership Fulfillment)
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  order_type TEXT NOT NULL CHECK (order_type IN ('pro_initial', 'team_addon', 'renewal')),
  card_quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL,
  total_amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'under_review' CHECK (status IN ('under_review', 'on_work', 'delivered', 'cancelled')),
  design_url TEXT,
  design_mode TEXT NOT NULL DEFAULT 'team_assist' CHECK (design_mode IN ('uploaded', 'team_assist')),
  shipping_address JSONB NOT NULL DEFAULT '{}'::jsonb,
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================================
-- 3. INDEXES
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_profiles_slug ON public.profiles(slug);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_plan ON public.profiles(subscription_plan);
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON public.profiles(is_admin);

CREATE INDEX IF NOT EXISTS idx_cards_profile_id ON public.cards(profile_id);
CREATE INDEX IF NOT EXISTS idx_cards_public_slug ON public.cards(public_slug);

CREATE INDEX IF NOT EXISTS idx_employees_owner_id ON public.employees(owner_id);
CREATE INDEX IF NOT EXISTS idx_employees_owner_premium ON public.employees(owner_id, is_premium);
CREATE INDEX IF NOT EXISTS idx_employees_slug ON public.employees(slug);

CREATE UNIQUE INDEX IF NOT EXISTS idx_connections_user_connected_uniq ON public.connections (user_id, connected_user_id);

CREATE INDEX IF NOT EXISTS idx_posts_profile_id ON public.posts(profile_id);
CREATE INDEX IF NOT EXISTS idx_reviews_profile_id ON public.reviews(profile_id);

CREATE INDEX IF NOT EXISTS idx_orders_profile_id ON public.orders(profile_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_idempotency_key ON public.orders(idempotency_key);

-- =====================================================================
-- 4. FUNCTIONS & STORED PROCEDURES
-- =====================================================================

-- Admin check function (Security Definer avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Save Card (Add to Saved Cards on tap or scan)
CREATE OR REPLACE FUNCTION public.save_card(p_owner_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
BEGIN
  IF v_me IS NULL OR p_owner_id IS NULL OR v_me = p_owner_id THEN
    RETURN false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_owner_id) THEN
    RETURN false;
  END IF;

  INSERT INTO public.connections (user_id, connected_user_id)
  VALUES (v_me, p_owner_id)
  ON CONFLICT (user_id, connected_user_id)
  DO UPDATE SET created_at = now();

  RETURN true;
END;
$$;

-- Unsave Card
CREATE OR REPLACE FUNCTION public.unsave_card(p_owner_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.connections
  WHERE user_id = auth.uid() AND connected_user_id = p_owner_id;
$$;

REVOKE ALL ON FUNCTION public.save_card(uuid) FROM public;
REVOKE ALL ON FUNCTION public.unsave_card(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.save_card(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unsave_card(uuid) TO authenticated;

-- Auto-create Profile and Card on new auth.user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug text;
BEGIN
  v_slug := lower(regexp_replace(coalesce(new.raw_user_meta_data->>'full_name', 'user'), '[^a-zA-Z0-9]', '', 'g')) || '-' || substring(new.id::text, 1, 6);

  -- Insert profile (is_admin is always false by default for all registrations)
  INSERT INTO public.profiles (
    id,
    email,
    owner_name,
    slug,
    is_admin,
    created_at,
    updated_at
  )
  VALUES (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    v_slug,
    false,
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;

  -- Insert default digital card
  INSERT INTO public.cards (
    profile_id,
    public_slug,
    is_active,
    created_at
  )
  VALUES (
    new.id,
    v_slug,
    true,
    now()
  )
  ON CONFLICT DO NOTHING;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger to automatically clean customer cards and sync auth app_metadata
-- whenever an admin promotes/demotes a user via: UPDATE public.profiles SET is_admin = true WHERE email = '...';
CREATE OR REPLACE FUNCTION public.handle_profile_admin_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF new.is_admin = true AND (old.is_admin IS DISTINCT FROM true) THEN
    -- Remove customer digital cards so admin is strictly an admin, not a customer card
    DELETE FROM public.cards WHERE profile_id = new.id;

    -- Sync to auth.users app_metadata for instant JWT claim recognition
    UPDATE auth.users
    SET raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"is_admin": true, "role": "admin"}'::jsonb
    WHERE id = new.id;
  ELSIF new.is_admin = false AND old.is_admin = true THEN
    -- Demote: remove is_admin from auth app_metadata
    UPDATE auth.users
    SET raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) - 'is_admin' - 'role'
    WHERE id = new.id;
  END IF;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_admin_change ON public.profiles;
CREATE TRIGGER on_profile_admin_change
  AFTER UPDATE OF is_admin ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_profile_admin_change();

-- =====================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- --- PROFILES POLICIES ---
DROP POLICY IF EXISTS "Public can view active profiles" ON public.profiles;
CREATE POLICY "Public can view active profiles"
  ON public.profiles FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
CREATE POLICY "Admins can manage all profiles"
  ON public.profiles FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- --- CARDS POLICIES ---
DROP POLICY IF EXISTS "Public can view active cards" ON public.cards;
CREATE POLICY "Public can view active cards"
  ON public.cards FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can update their own cards" ON public.cards;
CREATE POLICY "Users can update their own cards"
  ON public.cards FOR UPDATE
  TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own cards" ON public.cards;
CREATE POLICY "Users can insert their own cards"
  ON public.cards FOR INSERT
  TO authenticated
  WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage all cards" ON public.cards;
CREATE POLICY "Admins can manage all cards"
  ON public.cards FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- --- EMPLOYEES POLICIES ---
DROP POLICY IF EXISTS "Public can view active employees" ON public.employees;
CREATE POLICY "Public can view active employees"
  ON public.employees FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Owners can manage their employees" ON public.employees;
CREATE POLICY "Owners can manage their employees"
  ON public.employees FOR ALL
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage all employees" ON public.employees;
CREATE POLICY "Admins can manage all employees"
  ON public.employees FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- --- CONNECTIONS POLICIES ---
DROP POLICY IF EXISTS "Users can view their own connections" ON public.connections;
CREATE POLICY "Users can view their own connections"
  ON public.connections FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their connections" ON public.connections;
CREATE POLICY "Users can delete their connections"
  ON public.connections FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- --- POSTS POLICIES ---
DROP POLICY IF EXISTS "Public can view posts" ON public.posts;
CREATE POLICY "Public can view posts"
  ON public.posts FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Owners can manage their posts" ON public.posts;
CREATE POLICY "Owners can manage their posts"
  ON public.posts FOR ALL
  TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

-- --- REVIEWS POLICIES ---
DROP POLICY IF EXISTS "Public can view reviews" ON public.reviews;
CREATE POLICY "Public can view reviews"
  ON public.reviews FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Anyone can insert reviews" ON public.reviews;
CREATE POLICY "Anyone can insert reviews"
  ON public.reviews FOR INSERT
  WITH CHECK (true);

-- --- ORDERS POLICIES ---
DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;
CREATE POLICY "Users can view their own orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own orders" ON public.orders;
CREATE POLICY "Users can insert their own orders"
  ON public.orders FOR INSERT
  TO authenticated
  WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS "Users can update design while under_review" ON public.orders;
CREATE POLICY "Users can update design while under_review"
  ON public.orders FOR UPDATE
  TO authenticated
  USING (profile_id = auth.uid() AND status = 'under_review')
  WITH CHECK (profile_id = auth.uid() AND status = 'under_review');

DROP POLICY IF EXISTS "Admins have full access to orders" ON public.orders;
CREATE POLICY "Admins have full access to orders"
  ON public.orders FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- =====================================================================
-- 6. STORAGE BUCKETS (Avatars & Profile Media)
-- =====================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-media', 'profile-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage RLS Policies
DROP POLICY IF EXISTS "Public can view avatars" ON storage.objects;
CREATE POLICY "Public can view avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id IN ('avatars', 'profile-media'));

DROP POLICY IF EXISTS "Authenticated users can upload media" ON storage.objects;
CREATE POLICY "Authenticated users can upload media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id IN ('avatars', 'profile-media'));

DROP POLICY IF EXISTS "Users can update their uploaded media" ON storage.objects;
CREATE POLICY "Users can update their uploaded media"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id IN ('avatars', 'profile-media'));

DROP POLICY IF EXISTS "Users can delete their uploaded media" ON storage.objects;
CREATE POLICY "Users can delete their uploaded media"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id IN ('avatars', 'profile-media'));
