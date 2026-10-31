import { createClient } from "@/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

/**
 * Supabase Auth callback: password-reset, email-confirmation and magic
 * links land here, get turned into a signed-in session, and continue to
 * `next` (e.g. /reset-password).
 *
 * Two link styles are accepted:
 * - ?token_hash=...&type=recovery  (recommended email template: works when
 *   the email is opened on a different phone/browser than the one that
 *   asked for it)
 * - ?code=...                      (Supabase's default; only works in the
 *   same browser that asked for the link)
 */
const OTP_TYPES: EmailOtpType[] = ["recovery", "signup", "invite", "magiclink", "email_change", "email"];

function safeNext(raw: string | null, fallback: string) {
  // Only allow paths on this site (no open redirects to other domains).
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : fallback;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const isRecovery = type === "recovery" || searchParams.get("next") === "/reset-password";
  const next = safeNext(searchParams.get("next"), isRecovery ? "/reset-password" : "/dashboard");

  const supabase = await createClient();

  if (tokenHash && type && OTP_TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  // Expired, already used, or opened in another browser.
  if (isRecovery) {
    return NextResponse.redirect(`${origin}/forgot-password?expired=1`);
  }
  return NextResponse.redirect(
    `${origin}/signup?error=This+link+has+expired+or+was+already+used.+Please+try+again.`
  );
}
