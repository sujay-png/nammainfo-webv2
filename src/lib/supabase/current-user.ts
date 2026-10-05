import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

/**
 * Signed-in user for dashboard client components — WITHOUT a network
 * round-trip.
 *
 * `auth.getUser()` calls Supabase Auth over the network every time; each
 * dashboard page (plus the layout) was doing that before loading any
 * data, adding a full round-trip to every tab switch. Middleware already
 * verifies the session for /dashboard, and every query below is still
 * protected by RLS using the real JWT, so reading the locally stored
 * session here is safe and instant.
 */
export async function getCurrentUser(): Promise<User | null> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user ?? null;
}
