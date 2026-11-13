import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/supabase/admin";
import { buildContactVCard, vcardFileName, vcardResponse } from "@/features/save-contact/lib/vcard";
import type { ContactRow } from "@/supabase/database-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  const { contactId } = await params;
  const isUuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!isUuidRe.test(contactId)) {
    return NextResponse.json({ error: "Invalid contact ID" }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (err: any) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const { data, error } = await admin
    .from("contacts")
    .select("*")
    .eq("id", contactId)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  const contact = data as ContactRow;
  const vcf = buildContactVCard(contact);
  return vcardResponse(vcf, vcardFileName(contact.name || "contact"));
}

