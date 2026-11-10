import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "nammainfo_wa_2026";

/**
 * Meta WhatsApp Webhook verification (GET)
 * Meta calls this endpoint with hub.mode, hub.verify_token, hub.challenge
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("[WhatsApp Webhook] Verification successful");
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  console.warn("[WhatsApp Webhook] Verification failed", { mode, token });
  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

/**
 * Meta WhatsApp Webhook event notification (POST)
 * Receives delivery statuses, incoming messages, etc.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log("[WhatsApp Webhook] Event received:", JSON.stringify(body, null, 2));

    // Acknowledge receipt immediately with 200 OK so Meta doesn't retry
    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch (error) {
    console.error("[WhatsApp Webhook] Error processing event:", error);
    return NextResponse.json({ status: "ok" }, { status: 200 });
  }
}
