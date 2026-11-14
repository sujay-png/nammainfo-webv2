import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/supabase/admin";
import { formatWhatsAppPhone } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "nammainfo_wa_2026";

/**
 * Meta WhatsApp Webhook verification (GET)
 * Meta calls this endpoint with hub.mode, hub.verify_token, hub.challenge
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = (searchParams.get("hub.mode") || searchParams.get("hub_mode") || "").trim();
  const token = (searchParams.get("hub.verify_token") || searchParams.get("hub_verify_token") || "").trim();
  const challenge = searchParams.get("hub.challenge") || searchParams.get("hub_challenge") || "";

  const envToken = (process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "").trim();
  const envTokenWithoutHash = envToken.includes("#") ? envToken.split("#")[0].trim() : "";
  const validTokens = [
    "nammainfo_wa_2026",
    "nammainfo@akshara@wrnxt@adi#2022",
    "nammainfo@akshara@wrnxt@adi",
    envToken,
    envTokenWithoutHash,
  ].filter(Boolean);

  if (mode === "subscribe" && validTokens.includes(token)) {
    console.log("[WhatsApp Webhook] Verification successful with token:", token);
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  console.warn("[WhatsApp Webhook] Verification failed", { mode, token, validTokens });
  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

/**
 * Meta WhatsApp Webhook event notification (POST)
 * Receives delivery statuses, incoming messages, media, etc.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.object !== "whatsapp_business_account" || !Array.isArray(body.entry)) {
      return NextResponse.json({ status: "ignored" }, { status: 200 });
    }

    let admin;
    try {
      admin = createAdminClient();
    } catch (e) {
      console.error("[WhatsApp Webhook] Failed to initialize admin Supabase client:", e);
      return NextResponse.json({ status: "ok" }, { status: 200 });
    }

    for (const entry of body.entry) {
      if (!Array.isArray(entry.changes)) continue;

      for (const change of entry.changes) {
        const val = change.value;
        if (!val) continue;

        // 1. Process Status Receipts (sent, delivered, read, failed)
        if (Array.isArray(val.statuses)) {
          for (const s of val.statuses) {
            const metaMessageId = s.id;
            const newStatus = s.status; // 'sent' | 'delivered' | 'read' | 'failed'
            const errorMsg = s.errors?.[0]?.title || s.errors?.[0]?.message || null;

            try {
              await admin
                .from("whatsapp_messages")
                .update({
                  status: newStatus,
                  ...(errorMsg ? { error_message: errorMsg } : {}),
                })
                .eq("meta_message_id", metaMessageId);
            } catch (statusErr) {
              console.warn("[WhatsApp Webhook] Error updating status:", statusErr);
            }
          }
        }

        // 2. Process Incoming Messages
        if (Array.isArray(val.messages)) {
          const contactsMap: Record<string, string> = {};
          if (Array.isArray(val.contacts)) {
            for (const c of val.contacts) {
              if (c.wa_id && c.profile?.name) {
                contactsMap[c.wa_id] = c.profile.name;
              }
            }
          }

          for (const msg of val.messages) {
            const rawFrom = msg.from || "";
            const phone = formatWhatsAppPhone(rawFrom);
            const metaId = msg.id;
            const msgType = msg.type || "text";
            const profilePushName = contactsMap[rawFrom] || null;

            // Check if sender matches an existing registered user / company
            let matchedCompanyName: string | null = null;
            let matchedContactName: string | null = profilePushName;

            try {
              // Match phone against profiles (exact or ending with last 10 digits)
              const last10 = phone.slice(-10);
              const { data: profileMatch } = await admin
                .from("profiles")
                .select("full_name, company_name, phone")
                .or(`phone.eq.${phone},phone.ilike.%${last10}`)
                .limit(1)
                .maybeSingle();

              if (profileMatch) {
                matchedCompanyName = profileMatch.company_name || null;
                matchedContactName = profileMatch.full_name || profilePushName;
              }
            } catch (lookupErr) {
              console.warn("[WhatsApp Webhook] Profile lookup error:", lookupErr);
            }

            let content: string | null = null;
            let mediaId: string | null = null;
            let mediaMime: string | null = null;
            let mediaFilename: string | null = null;
            let mediaSize: number | null = null;

            switch (msgType) {
              case "text":
                content = msg.text?.body || "";
                break;
              case "image":
                mediaId = msg.image?.id || null;
                mediaMime = msg.image?.mime_type || "image/jpeg";
                content = msg.image?.caption || null;
                break;
              case "document":
                mediaId = msg.document?.id || null;
                mediaMime = msg.document?.mime_type || "application/pdf";
                mediaFilename = msg.document?.filename || "document.pdf";
                content = msg.document?.caption || null;
                break;
              case "audio":
              case "voice":
                mediaId = msg.audio?.id || msg.voice?.id || null;
                mediaMime = msg.audio?.mime_type || msg.voice?.mime_type || "audio/ogg";
                content = msgType === "voice" ? "Voice message" : "Audio";
                break;
              case "video":
                mediaId = msg.video?.id || null;
                mediaMime = msg.video?.mime_type || "video/mp4";
                content = msg.video?.caption || "Video";
                break;
              case "location":
                content = msg.location?.name
                  ? `📍 ${msg.location.name}: ${msg.location.address || ""}`
                  : `📍 Location: ${msg.location?.latitude}, ${msg.location?.longitude}`;
                break;
              case "interactive":
                content =
                  msg.interactive?.button_reply?.title ||
                  msg.interactive?.list_reply?.title ||
                  "Interactive response";
                break;
              default:
                content = `[Unsupported message type: ${msgType}]`;
                break;
            }

            try {
              // Insert into whatsapp_messages
              await admin.from("whatsapp_messages").upsert(
                {
                  meta_message_id: metaId,
                  phone_number: phone,
                  contact_name: matchedContactName,
                  company_name: matchedCompanyName,
                  direction: "inbound",
                  message_type: msgType === "voice" ? "voice" : msgType,
                  content,
                  media_id: mediaId,
                  media_mime_type: mediaMime,
                  media_filename: mediaFilename,
                  media_size: mediaSize,
                  status: "received",
                  is_read: false,
                  metadata: msg,
                  created_at: msg.timestamp
                    ? new Date(Number(msg.timestamp) * 1000).toISOString()
                    : new Date().toISOString(),
                },
                { onConflict: "meta_message_id" }
              );
            } catch (insertErr) {
              console.error("[WhatsApp Webhook] Failed to insert inbound message:", insertErr);
            }
          }
        }
      }
    }

    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch (error) {
    console.error("[WhatsApp Webhook] General error:", error);
    return NextResponse.json({ status: "ok" }, { status: 200 });
  }
}
