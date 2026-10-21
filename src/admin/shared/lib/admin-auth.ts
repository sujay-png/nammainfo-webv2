import { NextResponse } from "next/server";
import { createClient as createCookieServerClient } from "@/lib/supabase/server";
import { getAdminSupabase } from "./supabase-admin";

export type AdminAuthCheck =
  | { authorized: true; userId: string; adminSupabase: Awaited<ReturnType<typeof getAdminSupabase>> }
  | { authorized: false; response: NextResponse };

/**
 * Server-side security guard for Admin API routes.
 * 1. Checks if user is authenticated with a valid session.
 * 2. Checks if user has `is_admin === true` in public.profiles.
 * 3. Returns either 401/403 response or authorized client.
 */
export async function requireAdminAuth(request?: Request): Promise<AdminAuthCheck> {
  try {
    const sessionClient = await createCookieServerClient();
    let user = null;

    // 1. Check Authorization Bearer token if provided
    const authHeader = request?.headers?.get("authorization") || request?.headers?.get("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7).trim();
      const { data: tokenData, error: tokenError } = await sessionClient.auth.getUser(token);
      if (!tokenError && tokenData?.user) {
        user = tokenData.user;
      }
    }

    // 2. Fall back to cookie session
    if (!user) {
      const { data: cookieData, error: cookieError } = await sessionClient.auth.getUser();
      if (!cookieError && cookieData?.user) {
        user = cookieData.user;
      }
    }

    if (!user) {
      return {
        authorized: false,
        response: NextResponse.json(
          { error: "Authentication required. Please sign in as an administrator." },
          { status: 401 }
        ),
      };
    }

    // Verify admin flag in database
    const { data: profile, error: profileError } = await sessionClient
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile || !profile.is_admin) {
      return {
        authorized: false,
        response: NextResponse.json(
          { error: "Access denied. Platform administrator privileges required." },
          { status: 403 }
        ),
      };
    }

    const adminSupabase = await getAdminSupabase();
    return {
      authorized: true,
      userId: user.id,
      adminSupabase,
    };
  } catch (err: any) {
    console.error("[requireAdminAuth] Exception:", err);
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "Authorization verification failed." },
        { status: 500 }
      ),
    };
  }
}
