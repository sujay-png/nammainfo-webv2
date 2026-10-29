import { NextRequest, NextResponse } from "next/server";
import { createHash, randomUUID } from "crypto";
import { createAdminClient } from "@/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Hands out two one-time upload links (front + back of a business card)
 * for a visitor on someone's card page.
 *
 * The photos then go straight from the visitor's phone to Supabase Storage,
 * never through this server, so server cost stays ~zero. The bucket only
 * accepts images up to 500 KB (see the 20261026 migration); the phone
 * compresses each photo to ~80-180 KB before uploading.
 *
 * Abuse limits: 30 uploads per business and 10 per network every 10 minutes.
 */
const BUCKET = "business-cards";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const err = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

export async function POST(req: NextRequest) {
  let body: { ownerId?: string; employeeId?: string | null; format?: string };
  try {
    body = await req.json();
  } catch {
    return err("Invalid request");
  }
  const ownerId = body.ownerId ?? "";
  const employeeId = body.employeeId || null;
  const ext = body.format === "jpeg" ? "jpg" : "webp";
  if (!UUID.test(ownerId) || (employeeId && !UUID.test(employeeId))) return err("Invalid card");

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return err("Card upload is not set up on the server yet", 500);
  }

  // The card must exist (and the employee must belong to that business).
  const { data: owner } = await admin.from("profiles").select("id").eq("id", ownerId).maybeSingle();
  if (!owner) return err("Card not found", 404);
  if (employeeId) {
    const { data: emp } = await admin
      .from("employees")
      .select("id")
      .eq("id", employeeId)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (!emp) return err("Card not found", 404);
  }

  // Abuse limits
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
  const ipHash = createHash("sha256").update(`${ip}:${(process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").slice(-12)}`).digest("hex").slice(0, 32);
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const [{ count: perOwner }, { count: perIp }] = await Promise.all([
    admin.from("card_upload_tickets").select("id", { count: "exact", head: true }).eq("owner_id", ownerId).gte("created_at", since),
    admin.from("card_upload_tickets").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", since),
  ]);
  if ((perOwner ?? 0) >= 30 || (perIp ?? 0) >= 10) return err("Too many uploads right now. Please try again later.", 429);

  const key = randomUUID();
  const folder = `${ownerId}/${employeeId ?? "owner"}`;
  const frontPath = `${folder}/${key}-front.${ext}`;
  const backPath = `${folder}/${key}-back.${ext}`;

  const [front, back] = await Promise.all([
    admin.storage.from(BUCKET).createSignedUploadUrl(frontPath),
    admin.storage.from(BUCKET).createSignedUploadUrl(backPath),
  ]);
  if (front.error || back.error || !front.data || !back.data) {
    return err("Could not prepare the upload. Has the database update been run?", 500);
  }

  const { error: ticketError } = await admin.from("card_upload_tickets").insert({
    owner_id: ownerId,
    employee_id: employeeId,
    front_path: frontPath,
    back_path: backPath,
    ip_hash: ipHash,
  });
  if (ticketError) return err("Could not prepare the upload", 500);

  return NextResponse.json({
    front: { path: frontPath, token: front.data.token },
    back: { path: backPath, token: back.data.token },
  });
}
