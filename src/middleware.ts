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
  // session. getUser() hit Supabase Auth over the network on every single
  // request, which was a big part of the slowness.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims?.sub ? { id: data.claims.sub } : null;

  // Protect dashboard routes
  if (request.nextUrl.pathname.startsWith("/dashboard") && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/signup";
    return NextResponse.redirect(url);
  }

  // Redirect logged-in users from signup to dashboard
  if (
    (request.nextUrl.pathname === "/signup" ||
      request.nextUrl.pathname === "/") &&
    user
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Only the routes that actually need an auth decision. Public profile
  // pages (/<username>, /c/<id>, …) no longer pay for an auth check on
  // every visitor's request.
  matcher: ["/", "/signup", "/dashboard/:path*", "/onboarding/:path*"],
};
