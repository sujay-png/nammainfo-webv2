import { NextRequest, NextResponse } from "next/server";
import { requireStaffAuth } from "@/admin/shared/lib/admin-auth";
import { createAdminClient } from "@/supabase/admin";
import { formatWhatsAppPhone } from "@/lib/whatsapp";

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
  const authCheck = await requireStaffAuth(request);
  if (!authCheck.authorized) {
    return authCheck.response;
  }

  try {
    const admin = createAdminClient();

    // Fetch the recent messages to aggregate into conversation threads
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
      const phone = formatWhatsAppPhone(msg.phone_number);
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

    // Enrich conversations with missing contactName or companyName from profiles
    const missingInfoConvs = conversations.filter((c) => !c.contactName || !c.companyName);
    if (missingInfoConvs.length > 0) {
      try {
        const phoneQueries = missingInfoConvs.flatMap((c) => {
          const last10 = c.phoneNumber.slice(-10);
          return [`phone.eq.${c.phoneNumber}`, `phone.ilike.%${last10}`];
        });
        const { data: profiles } = await admin
          .from("profiles")
          .select("owner_name, business_name, phone")
          .or(phoneQueries.join(","));

        if (profiles && profiles.length > 0) {
          for (const conv of missingInfoConvs) {
            const last10 = conv.phoneNumber.slice(-10);
            const matched = profiles.find((p) => p.phone && (p.phone.includes(last10) || p.phone === conv.phoneNumber));
            if (matched) {
              if (!conv.contactName) conv.contactName = matched.owner_name || null;
              if (!conv.companyName) conv.companyName = matched.business_name || null;
            }
          }
        }
      } catch (enrichErr) {
        console.warn("[WhatsApp Conversations API] Profile enrichment warning:", enrichErr);
      }
    }

    return NextResponse.json({ conversations });
  } catch (err) {
    console.error("[WhatsApp Conversations API] Exception:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load conversations" },
      { status: 500 }
    );
  }
}
