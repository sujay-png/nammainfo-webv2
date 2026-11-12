import { NextRequest, NextResponse } from "next/server";
import { createPublicClient } from "@/supabase/server";
import { buildVCard, fetchVCardPhoto, vcardFileName, vcardResponse } from "@/features/save-contact/lib/vcard";
import type { Profile } from "@/supabase/database-types";
import { applyBranch } from "@/features/branches/lib/apply-branch";
import type { Branch } from "@/features/branches/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  const { profileId } = await params;
  const supabase = createPublicClient();

  const isUuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const isUuid = isUuidRe.test(profileId);

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq(isUuid ? "id" : "slug", profileId)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }
  let profile = data as Profile;

  // ?branch=<id>: the branch's phone, email, address and photo.
  let branch: Branch | null = null;
  const branchId = req.nextUrl.searchParams.get("branch");
  if (branchId && isUuidRe.test(branchId)) {
    const { data: b } = await supabase
      .from("branches")
      .select("*")
      .eq("id", branchId)
      .eq("owner_id", profile.id)
      .eq("is_active", true)
      .maybeSingle();
    branch = (b as unknown as Branch) ?? null;
    profile = applyBranch(profile, branch);
  }

  const origin = req.nextUrl.origin;
  const sourceUrl = profile.username
    ? `${origin}/${profile.username}${branch ? `/${branch.slug}` : ""}`
    : undefined;
  const photo = await fetchVCardPhoto(
    (branch?.logo_url ? branch.logo_url : profile.avatar_url) || profile.logo_url
  );

  const vcf = buildVCard(profile, { sourceUrl, photo });
  return vcardResponse(vcf, vcardFileName(profile.owner_name || profile.business_name));
}
