import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/admin/shared/lib/admin-auth";
import { createAdminClient } from "@/supabase/admin";
import {
  formatWhatsAppPhone,
  sendWhatsAppTextMessage,
  sendWhatsAppMediaMessage,
} from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/whatsapp/messages?phone=919876543210
 * Returns the chat history for a phone number and marks inbound messages as read.
 */
export async function GET(request: NextRequest) {
  const authCheck = await requireAdminAuth(request);
  if (!authCheck.authorized) {
    return authCheck.response;
  }

  const phoneParam = request.nextUrl.searchParams.get("phone");
  if (!phoneParam) {
    return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
  }

  const phone = formatWhatsAppPhone(phoneParam);

  try {
    const admin = createAdminClient();

    // Fetch messages for this phone ordered chronologically
    const { data: messages, error } = await admin
      .from("whatsapp_messages")
      .select("*")
      .eq("phone_number", phone)
      .order("created_at", { ascending: true })
      .limit(300);

    if (error) {
      console.error("[WhatsApp Messages GET] DB error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Mark inbound messages as read in the background
    await admin
      .from("whatsapp_messages")
      .update({ is_read: true })
      .eq("phone_number", phone)
      .eq("direction", "inbound")
      .eq("is_read", false);

    return NextResponse.json({ messages: messages || [] });
  } catch (err) {
    console.error("[WhatsApp Messages GET] Exception:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load messages" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/whatsapp/messages
 * Sends a message (text or media) to customer via WhatsApp Cloud API.
 */
export async function POST(request: NextRequest) {
  const authCheck = await requireAdminAuth(request);
  if (!authCheck.authorized) {
    return authCheck.response;
  }

  try {
    const body = await request.json();
    const { phone: rawPhone, text, type = "text", mediaId, mediaFilename, mediaCaption } = body;

    if (!rawPhone) {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
    }

    const phone = formatWhatsAppPhone(rawPhone);
    const admin = createAdminClient();

    // Look up company/contact name for metadata
    const last10 = phone.slice(-10);
    const { data: profile } = await admin
      .from("profiles")
      .select("full_name, company_name")
      .or(`phone.eq.${phone},phone.ilike.%${last10}`)
      .limit(1)
      .maybeSingle();

    let sendResult: { success: boolean; messageId?: string; error?: string };

    if (type === "text") {
      if (!text || !text.trim()) {
        return NextResponse.json({ error: "Text content cannot be empty" }, { status: 400 });
      }
      sendResult = await sendWhatsAppTextMessage({
        toPhone: phone,
        text: text.trim(),
      });
    } else if (type === "image" || type === "document" || type === "audio") {
      if (!mediaId) {
        return NextResponse.json({ error: "mediaId is required for media messages" }, { status: 400 });
      }
      sendResult = await sendWhatsAppMediaMessage({
        toPhone: phone,
        type,
        mediaId,
        caption: mediaCaption || text || undefined,
        filename: mediaFilename || (type === "document" ? "document.pdf" : undefined),
      });
    } else {
      return NextResponse.json({ error: `Unsupported message type: ${type}` }, { status: 400 });
    }

    if (!sendResult.success) {
      return NextResponse.json({ error: sendResult.error || "Failed to send message" }, { status: 400 });
    }

    // Insert into whatsapp_messages as outbound
    const { data: inserted, error: insertError } = await admin
      .from("whatsapp_messages")
      .insert({
        meta_message_id: sendResult.messageId || null,
        phone_number: phone,
        contact_name: profile?.full_name || null,
        company_name: profile?.company_name || null,
        direction: "outbound",
        message_type: type,
        content: type === "text" ? text.trim() : (mediaCaption || text || (type === "document" ? mediaFilename : type)),
        media_id: mediaId || null,
        media_filename: mediaFilename || null,
        status: "sent",
        is_read: true,
      })
      .select()
      .single();

    if (insertError) {
      console.warn("[WhatsApp Messages POST] Saved to WhatsApp but failed local DB insert:", insertError);
    }

    return NextResponse.json({
      success: true,
      messageId: sendResult.messageId,
      message: inserted,
    });
  } catch (err) {
    console.error("[WhatsApp Messages POST] Exception:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to process message send" },
      { status: 500 }
    );
  }
}

