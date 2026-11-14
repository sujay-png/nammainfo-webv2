import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/admin/shared/lib/admin-auth";
import { getWhatsAppMediaMetadata } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { mediaId: string } }
) {
  const authCheck = await requireAdminAuth(request);
  if (!authCheck.authorized) {
    return authCheck.response;
  }

  const mediaId = params.mediaId;
  if (!mediaId) {
    return NextResponse.json({ error: "mediaId is required" }, { status: 400 });
  }

  try {
    const metaInfo = await getWhatsAppMediaMetadata(mediaId);
    if (!metaInfo.success || !metaInfo.url) {
      return NextResponse.json(
        { error: metaInfo.error || "Media not found or expired on Meta servers" },
        { status: 404 }
      );
    }

    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    if (!accessToken) {
      return NextResponse.json({ error: "Access token missing" }, { status: 500 });
    }

    // Stream download directly from Meta CDN
    const mediaRes = await fetch(metaInfo.url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!mediaRes.ok) {
      return NextResponse.json(
        { error: `Meta media download failed with status ${mediaRes.status}` },
        { status: mediaRes.status }
      );
    }

    const contentType = metaInfo.mimeType || mediaRes.headers.get("content-type") || "application/octet-stream";
    const buffer = await mediaRes.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch (err) {
    console.error("[WhatsApp Media Proxy] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to retrieve media" },
      { status: 500 }
    );
  }
}

