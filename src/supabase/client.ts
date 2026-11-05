import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client for client components (signup, onboarding
 * form). Persists the session in cookies via @supabase/ssr so it's
 * readable from server components/routes too.
 *
 * Some networks (office firewalls, some Indian ISPs) block *.supabase.co.
 * People on those networks saw "Can't reach Namma Info right now" while
 * their internet worked fine. So in the browser, sign-in/sign-up (auth)
 * and database (rest) calls go to our own domain at /sb/..., which
 * next.config.js forwards to Supabase. The client is still configured
 * with the real Supabase URL, so the session cookie name and public
 * storage URLs stay exactly as before. Storage (photo uploads/downloads)
 * still goes direct, to keep large files off Vercel.
 * Set NEXT_PUBLIC_SUPABASE_PROXY=off to turn this off.
 */
const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const PROXIED = /^\/(auth|rest|functions)\/v1\//;

function viaOwnDomain(input: RequestInfo | URL, init?: RequestInit) {
  if (typeof window === "undefined" || process.env.NEXT_PUBLIC_SUPABASE_PROXY === "off") {
    return fetch(input, init);
  }
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (SUPABASE_URL && url.startsWith(SUPABASE_URL)) {
    const path = url.slice(SUPABASE_URL.length);
    if (PROXIED.test(path)) {
      const proxied = `${window.location.origin}/sb${path}`;
      return input instanceof Request ? fetch(new Request(proxied, input), init) : fetch(proxied, init);
    }
  }
  return fetch(input, init);
}

export function createClient() {
  return createBrowserClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { fetch: viaOwnDomain },
  });
}
