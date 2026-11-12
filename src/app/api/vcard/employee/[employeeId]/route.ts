import { NextRequest, NextResponse } from "next/server";
import { createPublicClient } from "@/supabase/server";
import { buildEmployeeVCard, fetchVCardPhoto, vcardFileName, vcardResponse } from "@/features/save-contact/lib/vcard";
import type { Employee, Profile } from "@/supabase/database-types";
import { applyBranch } from "@/features/branches/lib/apply-branch";
import type { Branch } from "@/features/branches/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  const { employeeId } = await params;
  const supabase = createPublicClient();

  const { data: empRow } = await supabase
    .from("employees")
    .select("*")
    .eq("id", employeeId)
    .eq("is_active", true)
    .maybeSingle();
  const employee = empRow as Employee | null;
  if (!employee) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: ownerRow } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", employee.owner_id)
    .maybeSingle();
  let owner = ownerRow as Profile | null;
  if (!owner) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // A branch member's contact card carries the branch's address and phone.
  let branch: Branch | null = null;
  if (employee.branch_id) {
    const { data: b } = await supabase
      .from("branches")
      .select("*")
      .eq("id", employee.branch_id)
      .eq("is_active", true)
      .maybeSingle();
    branch = (b as unknown as Branch) ?? null;
    owner = applyBranch(owner, branch);
  }

  const origin = req.nextUrl.origin;
  const sourceUrl = owner.username
    ? `${origin}/${owner.username}/${branch ? `${branch.slug}/` : ""}${employee.slug}`
    : undefined;
  const photo = await fetchVCardPhoto(employee.avatar_url);

  const vcf = buildEmployeeVCard(employee, owner, { sourceUrl, photo });
  return vcardResponse(vcf, vcardFileName(employee.name));
}
