import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client — SERVER ONLY. Needed to create logins for employees
 * (Supabase only lets the service role create users for someone else).
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local and in Vercel env vars.
 * Never import this from a client component.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
