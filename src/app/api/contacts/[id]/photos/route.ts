import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { randomUUID } from "crypto";
import { createAdminClient } from "@/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "business-cards";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: contactId } = await params;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(contactId);
  if (!isUuid) {
    return NextResponse.json({ error: "Invalid contact ID" }, { status: 400 });
  }

  // Auth verification
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Server storage not configured" }, { status: 500 });
  }

  // Fetch contact
  const { data: contact, error: fetchErr } = await admin
    .from("contacts")
    .select("id, owner_id, employee_id, card_front_path, card_back_path")
    .eq("id", contactId)
    .maybeSingle();

  if (fetchErr || !contact) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  // Check ownership
  if (contact.owner_id !== user.id) {
    const { data: emp } = await admin
      .from("employees")
      .select("id")
      .eq("owner_id", contact.owner_id)
      .eq("user_id", user.id)
      .eq("login_enabled", true)
      .maybeSingle();

    if (!emp) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Parse form data
  const formData = await req.formData();
  const frontFile = formData.get("front") as File | null;
  const backFile = formData.get("back") as File | null;

  if (!frontFile && !backFile) {
    return NextResponse.json({ error: "Please select an image to upload" }, { status: 400 });
  }

  const folder = `${contact.owner_id}/${contact.employee_id || "owner"}`;
  let newFrontPath = contact.card_front_path;
  let newBackPath = contact.card_back_path;

  if (frontFile) {
    const ext = frontFile.type.includes("jpeg") || frontFile.type.includes("jpg") ? "jpg" : "webp";
    const frontPath = `${folder}/${randomUUID()}-front.${ext}`;
    const buffer = Buffer.from(await frontFile.arrayBuffer());
    const { error: uploadErr } = await admin.storage
      .from(BUCKET)
      .upload(frontPath, buffer, {
        contentType: frontFile.type || "image/webp",
        upsert: true,
      });

    if (uploadErr) {
      console.error("[Contact Photo Upload] Front error:", uploadErr);
      return NextResponse.json({ error: "Failed to upload front photo" }, { status: 500 });
    }
    newFrontPath = frontPath;
  }

  if (backFile) {
    const ext = backFile.type.includes("jpeg") || backFile.type.includes("jpg") ? "jpg" : "webp";
    const backPath = `${folder}/${randomUUID()}-back.${ext}`;
    const buffer = Buffer.from(await backFile.arrayBuffer());
    const { error: uploadErr } = await admin.storage
      .from(BUCKET)
      .upload(backPath, buffer, {
        contentType: backFile.type || "image/webp",
        upsert: true,
      });

    if (uploadErr) {
      console.error("[Contact Photo Upload] Back error:", uploadErr);
      return NextResponse.json({ error: "Failed to upload back photo" }, { status: 500 });
    }
    newBackPath = backPath;
  }

  // Update contact via update_contact_card_photo RPC
  const { error: rpcErr } = await admin.rpc("update_contact_card_photo", {
    p_contact_id: contactId,
    p_front_path: newFrontPath,
    p_back_path: newBackPath,
  });

  if (rpcErr) {
    console.error("[Contact Photo Upload] RPC update error:", rpcErr);
    return NextResponse.json({ error: "Failed to update contact card photos" }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    card_front_path: newFrontPath,
    card_back_path: newBackPath,
  });
}

