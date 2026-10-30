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

  // Subdomain routing: if request is on admin.* subdomain (e.g. admin.nammainfo.in or admin.localhost)
  const host = request.headers.get("host") || "";
  const isAdminSubdomain =
    host.startsWith("admin.") || host.startsWith("admin.localhost");
  const pathname = request.nextUrl.pathname;

  if (isAdminSubdomain) {
    // If request has prefix /admin on admin subdomain, redirect to clean URL
    if (pathname === "/admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
    if (pathname === "/admin/login") {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    const isLogin = pathname === "/login";

    // Unauthenticated user attempting to access admin console
    if (!isLogin && !user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    // Signed-in user visiting /login -> redirect to home /
    if (isLogin && user) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }

    // Rewrite internal paths to /admin or /admin/login while keeping clean browser URL
    if (!pathname.startsWith("/api")) {
      const url = request.nextUrl.clone();
      if (pathname === "/") {
        url.pathname = "/admin";
        return NextResponse.rewrite(url);
      } else if (pathname === "/login") {
        url.pathname = "/admin/login";
        return NextResponse.rewrite(url);
      } else if (!pathname.startsWith("/admin")) {
        url.pathname = `/admin${pathname}`;
        return NextResponse.rewrite(url);
      }
    }

    return response;
  }

  // -------------------------------------------------------------
  // Main domain routing: nammainfo.in (or localhost)
  // -------------------------------------------------------------
  // Friendly aliases people type: nammainfo.in/login, /signin
  if (pathname === "/login" || pathname === "/signin") {
    const url = request.nextUrl.clone();
    url.pathname = user ? "/dashboard" : "/signup";
    url.search = user ? "" : "?mode=signin";
    return NextResponse.redirect(url);
  }

  const isAdminRoute =
    pathname === "/admin" || pathname.startsWith("/admin/");
  const isLoginPage = pathname.startsWith("/admin/login");

  if (isAdminRoute && !isLoginPage) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      return NextResponse.redirect(url);
    }
    // Signed-in customers don't belong in the admin console: send them to
    // their dashboard. (Staff = admin or designer; checked in the database
    // because designers have no admin claim in their login token.)
    if (!isAdmin) {
      const { data: staff } = await supabase
        .from("profiles")
        .select("is_admin, role")
        .eq("id", user.id)
        .maybeSingle();
      const isStaff = Boolean(staff?.is_admin || staff?.role === "admin" || staff?.role === "designer");
      if (!isStaff) {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard";
        url.search = "";
        return NextResponse.redirect(url);
      }
    }
  }

  // Redirect signed-in user from /admin/login to /admin
  if (isLoginPage && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    return NextResponse.redirect(url);
  }

  // If an administrator accesses customer dashboard or onboarding, bounce them to /admin
  if (
    (pathname.startsWith("/dashboard") ||
      pathname.startsWith("/onboarding")) &&
    user &&
    isAdmin
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    return NextResponse.redirect(url);
  }

  // Protect dashboard routes for regular users
  if (pathname.startsWith("/dashboard") && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/signup";
    return NextResponse.redirect(url);
  }

  // Redirect logged-in users from signup/root
  if (
    (pathname === "/signup" || pathname === "/") &&
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
    "/login",
    "/signin",
    "/signup",
    "/dashboard",
    "/dashboard/:path*",
    "/onboarding/:path*",
    "/admin",
    "/admin/:path*",
  ],
};

