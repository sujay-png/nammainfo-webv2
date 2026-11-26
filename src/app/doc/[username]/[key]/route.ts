import { NextRequest, NextResponse } from "next/server";
import { createPublicClient } from "@/supabase/server";
import { cleanCustomButtons, docKeys } from "@/features/custom-links/types";

export const dynamic = "force-dynamic";

/**
 * Short, branded links for documents on a card, used in WhatsApp greetings:
 *
 *   nammainfo.in/doc/akshara/brochure  → the brochure file
 *   nammainfo.in/doc/akshara/menu      → the "Menu" custom button (file or link)
 *
 * Redirects to the real file, so the link keeps working if the owner
 * replaces the file. Unknown names go to the business's card.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ username: string; key: string }> }) {
  const { username, key } = await params;
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("profiles")
    .select("username, brochure_url, custom_buttons")
    .eq("username", username)
    .maybeSingle();
  const row = data as { username: string; brochure_url: string | null; custom_buttons?: unknown } | null;
  if (!row) return NextResponse.redirect(new URL("/", req.url), 302);

  const k = key.toLowerCase();
  let target: string | null = null;
  if (k === "brochure") target = row.brochure_url;
  else {
    const buttons = cleanCustomButtons(row.custom_buttons);
    const keys = docKeys(buttons);
    target = buttons.find((b) => keys.get(b.id) === k)?.url ?? null;
  }
  if (!target || !/^https?:\/\//i.test(target)) {
    return NextResponse.redirect(new URL(`/${row.username}`, req.url), 302);
  }
  return NextResponse.redirect(target, 302);
}
