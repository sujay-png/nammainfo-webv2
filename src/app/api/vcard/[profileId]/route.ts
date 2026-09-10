import { NextRequest, NextResponse } from "next/server";
import { createPublicClient } from "@/lib/supabase/server";
import { buildVCard, vcardFileName } from "@/lib/vcard";
import type { Profile } from "@/lib/supabase/types";

// vcards-js touches Node's http/https modules to fetch the avatar photo,
// so this route must run in the Node runtime, not the Edge runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  const { profileId } = await params;
  const supabase = createPublicClient();

  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      profileId
    );

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq(isUuid ? "id" : "slug", profileId)
    .maybeSingle();

  if (error || !profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Supabase's generic `.select("*")` result type doesn't always narrow to a
  // plain object for the spread below — cast to the concrete row type we
  // already know it is (we just null-checked it above).
  const profileRow = profile as Profile;

  let vcf: string;
  try {
    vcf = buildVCard(profileRow);
  } catch {
    // Avatar fetch/embed can fail (missing image, network hiccup) —
    // never block the actual contact card because of it.
    vcf = buildVCard({ ...profileRow, avatar_url: null });
  }

  return new NextResponse(vcf, {
    status: 200,
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `attachment; filename="${vcardFileName(profileRow)}"`,
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}
