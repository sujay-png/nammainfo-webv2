import { createClient as createRawClient } from "@supabase/supabase-js";
import { createClient as createCookieServerClient } from "@/lib/supabase/server";
import { env } from "../config/env";

/**
 * Creates an elevated Supabase client for Admin operations.
 * If SUPABASE_SERVICE_ROLE_KEY is set in .env, it uses service-role (bypasses RLS).
 * Otherwise, it falls back to session-based server client.
 */
export async function getAdminSupabase() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return createRawClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }

  // Fallback to cookie-authenticated server client
  return await createCookieServerClient();
}
