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
  const role =
    claims?.app_metadata?.role ||
    claims?.user_metadata?.role ||
    (claims?.is_admin ? "admin" : null);

  let isAdmin = Boolean(
    claims?.is_admin === true ||
    claims?.app_metadata?.is_admin === true ||
    role === "admin"
  );

  let isStaff = Boolean(
    isAdmin ||
    role === "designer" ||
    claims?.app_metadata?.role === "designer" ||
    claims?.user_metadata?.role === "designer"
  );

  let isPartner = Boolean(
    role === "partner" ||
    role === "campaign_manager" ||
    claims?.is_partner === true ||
    claims?.is_campaign_manager === true ||
    claims?.app_metadata?.is_partner === true ||
    claims?.app_metadata?.is_campaign_manager === true ||
    claims?.user_metadata?.is_partner === true ||
    claims?.user_metadata?.is_campaign_manager === true
  );

  // Subdomain routing: if request is on admin.* or partner.* subdomain
  const host = request.headers.get("host") || "";
  const isAdminSubdomain =
    host.startsWith("admin.") || host.startsWith("admin.localhost");
  const isPartnerSubdomain =
    host.startsWith("partner.") ||
    host.startsWith("partner.localhost") ||
    host.startsWith("campaign.") ||
    host.startsWith("campaign.localhost");
  const pathname = request.nextUrl.pathname;

  // Check partner & admin status from DB if needed
  if (
    user &&
    (isPartnerSubdomain ||
      pathname.startsWith("/partner") ||
      pathname.startsWith("/campaign"))
  ) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("is_partner, is_campaign_manager, role, is_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (prof?.is_admin || prof?.role === "admin") {
      isAdmin = true;
    }

    if (
      (prof as any)?.is_partner ||
      prof?.is_campaign_manager ||
      prof?.role === "partner" ||
      prof?.role === "campaign_manager"
    ) {
      isPartner = true;
    }
  }

  // Partner Subdomain Routing (e.g. partner.nammainfo.in or partner.localhost)
  if (isPartnerSubdomain) {
    if (pathname === "/partner" || pathname === "/campaign") {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }

    const isLogin = pathname === "/login" || pathname === "/signin" || pathname === "/partner/login";

    // Unauthenticated on partner subdomain -> redirect to clean /login
    if (!isLogin && !user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    // Authenticated admin attempting to access partner portal -> redirect to admin console
    if (user && isAdmin && !isPartner) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin";
      return NextResponse.redirect(url);
    }

    // Authenticated regular user without partner privileges -> redirect to dashboard
    if (user && !isPartner) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }

    // Authenticated partner on login page -> redirect to home /
    if (isLogin && user && isPartner) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }

    // Rewrite internal paths to /partner
    if (!pathname.startsWith("/api")) {
      const url = request.nextUrl.clone();
      if (pathname === "/") {
        url.pathname = "/partner";
        return NextResponse.rewrite(url);
      } else if (isLogin) {
        url.pathname = "/partner/login";
        return NextResponse.rewrite(url);
      } else if (!pathname.startsWith("/partner")) {
        url.pathname = `/partner${pathname}`;
        return NextResponse.rewrite(url);
      }
    }

    return response;
  }

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
    // Check staff role if user is signed in
    if (user && !isStaff) {
      const { data: staff } = await supabase
        .from("profiles")
        .select("is_admin, role")
        .eq("id", user.id)
        .maybeSingle();
      if (staff?.is_admin || staff?.role === "admin") {
        isAdmin = true;
        isStaff = true;
      } else if (staff?.role === "designer") {
        isStaff = true;
      }
    }

    const url = request.nextUrl.clone();
    url.pathname = user ? (isStaff ? "/admin" : "/dashboard") : "/signup";
    url.search = user ? "" : "?mode=signin";
    return NextResponse.redirect(url);
  }

  const isAdminRoute =
    pathname === "/admin" || pathname.startsWith("/admin/");
  const isLoginPage = pathname.startsWith("/admin/login");

  // Verify staff status from database if not already determined from claims
  if (user && !isStaff && (isAdminRoute || pathname.startsWith("/dashboard") || pathname.startsWith("/onboarding") || pathname === "/signup" || pathname === "/")) {
    const { data: staff } = await supabase
      .from("profiles")
      .select("is_admin, role")
      .eq("id", user.id)
      .maybeSingle();
    if (staff?.is_admin || staff?.role === "admin") {
      isAdmin = true;
      isStaff = true;
    } else if (staff?.role === "designer") {
      isStaff = true;
    }
  }

  if (isAdminRoute && !isLoginPage) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      return NextResponse.redirect(url);
    }
    // Signed-in customers don't belong in the admin console: send them to their dashboard
    if (!isStaff) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  // Redirect signed-in user from /admin/login to appropriate view
  if (isLoginPage && user) {
    const url = request.nextUrl.clone();
    url.pathname = isStaff ? "/admin" : "/dashboard";
    return NextResponse.redirect(url);
  }

  // If a staff member (Admin or Designer) accesses customer dashboard or onboarding, bounce them to /admin
  if (
    (pathname.startsWith("/dashboard") ||
      pathname.startsWith("/onboarding")) &&
    user &&
    isStaff
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    return NextResponse.redirect(url);
  }

  // Redirect legacy /campaign routes to /partner
  if (pathname === "/campaign" || pathname.startsWith("/campaign/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(/^\/campaign/, "/partner");
    return NextResponse.redirect(url);
  }

  // Protect /partner routes for partners (allowing /partner/login)
  const isPartnerRoute =
    pathname === "/partner" || pathname.startsWith("/partner/");

  if (isPartnerRoute && pathname !== "/partner/login") {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/partner/login";
      return NextResponse.redirect(url);
    }
    // Admin is NOT allowed in Partner Portal -> redirect to /admin
    if (isAdmin && !isPartner) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin";
      return NextResponse.redirect(url);
    }
    if (!isPartner) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  // Redirect signed-in users on /partner/login
  if (pathname === "/partner/login" && user) {
    if (isAdmin && !isPartner) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin";
      return NextResponse.redirect(url);
    }
    if (isPartner) {
      const url = request.nextUrl.clone();
      url.pathname = "/partner";
      return NextResponse.redirect(url);
    }
  }

  // Protect dashboard routes for regular users
  if (pathname.startsWith("/dashboard") && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/signup";
    url.search = "?mode=signin";
    return NextResponse.redirect(url);
  }

  // Redirect logged-in users from signup/root
  if (
    (pathname === "/signup" || pathname === "/") &&
    user &&
    !isAdminSubdomain &&
    !isPartnerSubdomain
  ) {
    const url = request.nextUrl.clone();
    url.pathname = isStaff ? "/admin" : "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Routes needing auth decision and admin/partner routing
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
    "/partner",
    "/partner/:path*",
    "/campaign",
    "/campaign/:path*",
  ],
};

