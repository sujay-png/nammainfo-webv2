/**
 * Meta WhatsApp Cloud API helper for transactional notifications.
 */

interface SendTemplateParams {
  toPhone: string;
  templateName: string;
  languageCode?: string;
  bodyParameters?: (string | number)[];
}

export async function sendWhatsAppTemplate({
  toPhone,
  templateName,
  languageCode = "en",
  bodyParameters = [],
}: SendTemplateParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    console.warn("[WhatsApp] Missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN. Skipping send.");
    return { success: false, error: "WhatsApp credentials not configured in environment" };
  }

  // Format recipient phone number: remove non-digits, ensure country code 91 for 10-digit Indian numbers
  let formatted = toPhone.replace(/\D/g, "");
  if (formatted.length === 10) {
    formatted = `91${formatted}`;
  } else if (formatted.startsWith("0") && formatted.length === 11) {
    formatted = `91${formatted.slice(1)}`;
  }

  const payload: Record<string, unknown> = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: formatted,
    type: "template",
    template: {
      name: templateName,
      language: {
        code: languageCode,
      },
    },
  };

  if (bodyParameters.length > 0) {
    (payload.template as Record<string, unknown>).components = [
      {
        type: "body",
        parameters: bodyParameters.map((val) => ({
          type: "text",
          text: String(val),
        })),
      },
    ];
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error("[WhatsApp] API error response:", data);
      return { success: false, error: data?.error?.message || "Failed to send WhatsApp message" };
    }

    const messageId = data?.messages?.[0]?.id;
    console.log(`[WhatsApp] Template '${templateName}' sent to ${formatted}, ID: ${messageId}`);
    return { success: true, messageId };
  } catch (err) {
    console.error("[WhatsApp] Network exception sending message:", err);
    return { success: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

