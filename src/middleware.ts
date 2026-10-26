import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase auth session for app routes and protects
 * /dashboard/* routes — redirects to /signup if not signed in.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getClaims() verifies the JWT locally (no network call when the project
  // uses asymmetric JWT signing keys) and still refreshes an expired
  // session.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims?.sub ? { id: data.claims.sub } : null;

  const claims = data?.claims as Record<string, any> | undefined;
  const isAdmin = Boolean(
    claims?.is_admin === true ||
    claims?.app_metadata?.is_admin === true ||
    claims?.app_metadata?.role === "admin"
  );

  // Subdomain routing: if request is on admin.* subdomain, rewrite to /admin
  const host = request.headers.get("host") || "";
  const isAdminSubdomain = host.startsWith("admin.");

  if (isAdminSubdomain && !request.nextUrl.pathname.startsWith("/api")) {
    if (!request.nextUrl.pathname.startsWith("/admin")) {
      const url = request.nextUrl.clone();
      url.pathname = `/admin${request.nextUrl.pathname === "/" ? "" : request.nextUrl.pathname}`;
      return NextResponse.rewrite(url);
    }
  }

  // Protect admin routes — redirect to /admin/login if not signed in or not an admin
  const isAdminRoute =
    request.nextUrl.pathname === "/admin" ||
    request.nextUrl.pathname.startsWith("/admin/");
  const isLoginPage = request.nextUrl.pathname.startsWith("/admin/login");

  if (isAdminRoute && !isLoginPage) {
    if (!user || !isAdmin) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      return NextResponse.redirect(url);
    }
  }

  // Redirect signed-in admin from /admin/login to /admin
  if (isLoginPage && user && isAdmin) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    return NextResponse.redirect(url);
  }

  // If an administrator accesses customer dashboard or onboarding, bounce them to /admin
  if (
    (request.nextUrl.pathname.startsWith("/dashboard") ||
      request.nextUrl.pathname.startsWith("/onboarding")) &&
    user &&
    isAdmin
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    return NextResponse.redirect(url);
  }

  // Protect dashboard routes for regular users
  if (request.nextUrl.pathname.startsWith("/dashboard") && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/signup";
    return NextResponse.redirect(url);
  }

  // Redirect logged-in users from signup/root
  if (
    (request.nextUrl.pathname === "/signup" ||
      request.nextUrl.pathname === "/") &&
    user &&
    !isAdminSubdomain
  ) {
    const url = request.nextUrl.clone();
    url.pathname = isAdmin ? "/admin" : "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Routes needing auth decision and admin routing
  matcher: [
    "/",
    "/signup",
    "/dashboard",
    "/dashboard/:path*",
    "/onboarding/:path*",
    "/admin",
    "/admin/:path*",
  ],
};

