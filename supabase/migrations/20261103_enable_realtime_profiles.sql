-- Migration: Enable Realtime Replication for profiles
-- Date: 2026-11-03
-- Description: Enables PostgreSQL CDC (Change Data Capture) via supabase_realtime publication
--              and sets REPLICA IDENTITY FULL on public.profiles so live updates (plan changes,
--              validity extensions, status changes) are broadcast to connected client apps instantly.

ALTER TABLE public.profiles REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
END $$;
