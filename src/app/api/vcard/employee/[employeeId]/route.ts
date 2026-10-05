import { NextRequest, NextResponse } from "next/server";
import { createPublicClient } from "@/lib/supabase/server";
import { buildEmployeeVCard, fetchVCardPhoto, vcardFileName, vcardResponse } from "@/lib/vcard";
import type { Employee, Profile } from "@/lib/supabase/types";

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
  const owner = ownerRow as Profile | null;
  if (!owner) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const origin = req.nextUrl.origin;
  const sourceUrl = owner.username ? `${origin}/${owner.username}/${employee.slug}` : undefined;
  const photo = await fetchVCardPhoto(employee.avatar_url);

  const vcf = buildEmployeeVCard(employee, owner, { sourceUrl, photo });
  return vcardResponse(vcf, vcardFileName(employee.name));
}
