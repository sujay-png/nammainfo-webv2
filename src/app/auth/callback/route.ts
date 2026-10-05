import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Supabase Auth callback handler.
 *
 * When a user clicks a magic link, email confirmation link, or password
 * reset link, Supabase redirects them here with a `code` query param.
 * We exchange that code for a session, then redirect the user to the
 * intended destination (passed via the `next` query param).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // If there's no code or the exchange failed, redirect to an error page
  return NextResponse.redirect(
    `${origin}/signup?error=Could+not+verify+the+link.+Please+try+again.`
  );
}
