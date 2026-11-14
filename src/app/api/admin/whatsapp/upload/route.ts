import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/admin/shared/lib/admin-auth";
import { uploadWhatsAppMedia } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const authCheck = await requireAdminAuth(request);
  if (!authCheck.authorized) {
    return authCheck.response;
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const filename = (file as { name?: string }).name || "upload";
    const mimeType = file.type || "application/octet-stream";
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const uploadResult = await uploadWhatsAppMedia({
      fileBuffer: buffer,
      mimeType,
      filename,
    });

    if (!uploadResult.success || !uploadResult.mediaId) {
      return NextResponse.json(
        { error: uploadResult.error || "Failed to upload file to WhatsApp" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      mediaId: uploadResult.mediaId,
      filename,
      mimeType,
      size: file.size,
    });
  } catch (err) {
    console.error("[WhatsApp Upload API] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to process media upload" },
      { status: 500 }
    );
  }
}

