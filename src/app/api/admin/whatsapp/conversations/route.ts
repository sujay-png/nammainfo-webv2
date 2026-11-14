import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/admin/shared/lib/admin-auth";
import { createAdminClient } from "@/supabase/admin";

export const dynamic = "force-dynamic";

export interface WhatsAppConversationSummary {
  phoneNumber: string;
  contactName: string | null;
  companyName: string | null;
  lastMessage: {
    content: string | null;
    messageType: string;
    direction: "inbound" | "outbound";
    createdAt: string;
    status: string;
  };
  unreadCount: number;
  lastInboundAt: string | null;
  isWindowActive: boolean;
  windowExpiresAt: string | null;
}

export async function GET(request: NextRequest) {
  const authCheck = await requireAdminAuth(request);
  if (!authCheck.authorized) {
    return authCheck.response;
  }

  try {
    const admin = createAdminClient();

    // Fetch the recent 500 messages to aggregate into conversation threads
    const { data: messages, error } = await admin
      .from("whatsapp_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000);

    if (error) {
      console.error("[WhatsApp Conversations API] DB error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const conversationsMap = new Map<string, WhatsAppConversationSummary>();
    const now = Date.now();
    const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

    for (const msg of messages || []) {
      const phone = msg.phone_number;
      if (!conversationsMap.has(phone)) {
        conversationsMap.set(phone, {
          phoneNumber: phone,
          contactName: msg.contact_name || null,
          companyName: msg.company_name || null,
          lastMessage: {
            content: msg.content,
            messageType: msg.message_type,
            direction: msg.direction,
            createdAt: msg.created_at,
            status: msg.status,
          },
          unreadCount: 0,
          lastInboundAt: null,
          isWindowActive: false,
          windowExpiresAt: null,
        });
      }

      const conv = conversationsMap.get(phone)!;

      // Keep latest non-null names
      if (!conv.contactName && msg.contact_name) conv.contactName = msg.contact_name;
      if (!conv.companyName && msg.company_name) conv.companyName = msg.company_name;

      // Count unread inbound
      if (msg.direction === "inbound" && !msg.is_read) {
        conv.unreadCount += 1;
      }

      // Track most recent inbound to determine 24h window
      if (msg.direction === "inbound" && !conv.lastInboundAt) {
        conv.lastInboundAt = msg.created_at;
        const inboundTime = new Date(msg.created_at).getTime();
        const diff = now - inboundTime;
        conv.isWindowActive = diff < TWENTY_FOUR_HOURS_MS;
        conv.windowExpiresAt = new Date(inboundTime + TWENTY_FOUR_HOURS_MS).toISOString();
      }
    }

    const conversations = Array.from(conversationsMap.values());

    return NextResponse.json({ conversations });
  } catch (err) {
    console.error("[WhatsApp Conversations API] Exception:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load conversations" },
      { status: 500 }
    );
  }
}

