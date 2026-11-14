/**
 * Meta WhatsApp Cloud API helper for transactional notifications.
 */

interface SendTemplateParams {
  toPhone: string;
  templateName: string;
  languageCode?: string;
  bodyParameters?: (string | number)[];
  buttonParameters?: (string | number)[];
}

export async function sendWhatsAppTemplate({
  toPhone,
  templateName,
  languageCode = "en_IN",
  bodyParameters = [],
  buttonParameters = [],
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

  const components: Record<string, unknown>[] = [];

  if (bodyParameters.length > 0) {
    components.push({
      type: "body",
      parameters: bodyParameters.map((val) => ({
        type: "text",
        text: String(val),
      })),
    });
  }

  if (buttonParameters.length > 0) {
    buttonParameters.forEach((val, idx) => {
      components.push({
        type: "button",
        sub_type: "url",
        index: String(idx),
        parameters: [
          {
            type: "text",
            text: String(val),
          },
        ],
      });
    });
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
      ...(components.length > 0 ? { components } : {}),
    },
  };

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    let data = await res.json();
    if (!res.ok && data?.error?.code === 132001) {
      // Translation missing: retry with alternate language between en_IN and en
      const fallbackLang = languageCode === "en_IN" ? "en" : "en_IN";
      (payload.template as Record<string, unknown>).language = { code: fallbackLang };
      const fallbackRes = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const fallbackData = await fallbackRes.json();
      if (fallbackRes.ok) {
        data = fallbackData;
      }
    }

    if (data?.error) {
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

/**
 * Format any phone number into Meta WhatsApp standard format (e.g. 919876543210)
 */
export function formatWhatsAppPhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 10) {
    return `91${cleaned}`;
  }
  if (cleaned.startsWith("0") && cleaned.length === 11) {
    return `91${cleaned.slice(1)}`;
  }
  return cleaned;
}

/**
 * Send a free-form text message via WhatsApp Cloud API within the 24h customer service window.
 */
export async function sendWhatsAppTextMessage({
  toPhone,
  text,
}: {
  toPhone: string;
  text: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    return { success: false, error: "WhatsApp credentials not configured" };
  }

  const formatted = formatWhatsAppPhone(toPhone);

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: formatted,
    type: "text",
    text: {
      preview_url: true,
      body: text,
    },
  };

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
    if (!res.ok || data?.error) {
      console.error("[WhatsApp] Text message failed:", data);
      return { success: false, error: data?.error?.message || "Failed to send text message" };
    }

    const messageId = data?.messages?.[0]?.id;
    return { success: true, messageId };
  } catch (err) {
    console.error("[WhatsApp] Text send exception:", err);
    return { success: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

export interface SendMediaParams {
  toPhone: string;
  type: "image" | "document" | "audio";
  mediaId?: string;
  mediaUrl?: string;
  caption?: string;
  filename?: string;
}

/**
 * Send an image, document/pdf, or audio message via WhatsApp Cloud API.
 */
export async function sendWhatsAppMediaMessage({
  toPhone,
  type,
  mediaId,
  mediaUrl,
  caption,
  filename,
}: SendMediaParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    return { success: false, error: "WhatsApp credentials not configured" };
  }

  const formatted = formatWhatsAppPhone(toPhone);

  const mediaPayload: Record<string, unknown> = {};
  if (mediaId) {
    mediaPayload.id = mediaId;
  } else if (mediaUrl) {
    mediaPayload.link = mediaUrl;
  } else {
    return { success: false, error: "Either mediaId or mediaUrl is required" };
  }

  if (caption && (type === "image" || type === "document")) {
    mediaPayload.caption = caption;
  }
  if (filename && type === "document") {
    mediaPayload.filename = filename;
  }

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: formatted,
    type,
    [type]: mediaPayload,
  };

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
    if (!res.ok || data?.error) {
      console.error("[WhatsApp] Media message failed:", data);
      return { success: false, error: data?.error?.message || "Failed to send media message" };
    }

    const messageId = data?.messages?.[0]?.id;
    return { success: true, messageId };
  } catch (err) {
    console.error("[WhatsApp] Media send exception:", err);
    return { success: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

/**
 * Upload a media file directly to Meta WhatsApp Cloud API storage.
 * Returns the Meta mediaId which can then be used in sendWhatsAppMediaMessage.
 */
export async function uploadWhatsAppMedia({
  fileBuffer,
  mimeType,
  filename,
}: {
  fileBuffer: Blob | Buffer;
  mimeType: string;
  filename: string;
}): Promise<{ success: boolean; mediaId?: string; error?: string }> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    return { success: false, error: "WhatsApp credentials not configured" };
  }

  try {
    const formData = new FormData();
    formData.append("messaging_product", "whatsapp");
    formData.append("type", mimeType);

    const blob = fileBuffer instanceof Blob ? fileBuffer : new Blob([new Uint8Array(fileBuffer)], { type: mimeType });
    formData.append("file", blob, filename);

    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/media`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    });

    const data = await res.json();
    if (!res.ok || data?.error) {
      console.error("[WhatsApp] Media upload failed:", data);
      return { success: false, error: data?.error?.message || "Failed to upload media to WhatsApp" };
    }

    return { success: true, mediaId: data.id };
  } catch (err) {
    console.error("[WhatsApp] Media upload exception:", err);
    return { success: false, error: err instanceof Error ? err.message : "Upload error" };
  }
}

/**
 * Get the download URL and metadata for an incoming WhatsApp media attachment.
 */
export async function getWhatsAppMediaMetadata(mediaId: string): Promise<{
  success: boolean;
  url?: string;
  mimeType?: string;
  fileSize?: number;
  error?: string;
}> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!accessToken) {
    return { success: false, error: "WhatsApp access token missing" };
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await res.json();
    if (!res.ok || data?.error) {
      return { success: false, error: data?.error?.message || "Failed to get media metadata" };
    }

    return {
      success: true,
      url: data.url,
      mimeType: data.mime_type,
      fileSize: data.file_size,
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Network error" };
  }
}


