import { NextRequest, NextResponse } from "next/server";
import { createPublicClient } from "@/lib/supabase/server";
import { buildVCard, fetchVCardPhoto, vcardFileName, vcardResponse } from "@/lib/vcard";
import type { Profile } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  const { profileId } = await params;
  const supabase = createPublicClient();

  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(profileId);

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq(isUuid ? "id" : "slug", profileId)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }
  const profile = data as Profile;

  const origin = req.nextUrl.origin;
  const sourceUrl = profile.username ? `${origin}/${profile.username}` : undefined;
  const photo = await fetchVCardPhoto(profile.avatar_url || profile.logo_url);

  const vcf = buildVCard(profile, { sourceUrl, photo });
  return vcardResponse(vcf, vcardFileName(profile.owner_name || profile.business_name));
}
