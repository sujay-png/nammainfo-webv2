import { createServerClient } from "@supabase/ssr";
import { createClient as createRawClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * Server-side Supabase client for use inside Server Components,
 * Route Handlers, and Server Actions. Reads/writes the auth cookie
 * via Next's cookies() API.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: any; value: any; options: any; }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component with no request context —
            // safe to ignore because middleware refreshes the session.
          }
        },
      },
    }
  );
}

/**
 * A plain, unauthenticated client for public reads (card landing pages,
 * vCard generation) where we deliberately don't want cookie/session
 * plumbing — it's the same anon key, RLS still applies.
 */
export function createPublicClient() {
  return createRawClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: (url, options = {}) =>
          fetch(url, { ...options, cache: "no-store" }),
      },
    }
  );
}

/**
 * Same anon client, but its reads go through Next's data cache for
 * `revalidateSeconds` — for the public profile pages, so most visits are
 * served from cache instead of hitting the database every time. (Taps are
 * counted client-side by <TapTracker />, so caching doesn't affect them.)
 */
export function createCachedPublicClient(revalidateSeconds = 30) {
  return createRawClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: (url, options = {}) =>
          fetch(url, {
            ...options,
            next: { revalidate: revalidateSeconds },
          } as RequestInit),
      },
    }
  );
}
