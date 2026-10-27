import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client for client components (signup, onboarding
 * form). Persists the session in cookies via @supabase/ssr so it's
 * readable from server components/routes too.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
