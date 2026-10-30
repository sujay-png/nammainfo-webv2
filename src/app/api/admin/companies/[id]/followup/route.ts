import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/admin/shared/lib/admin-auth";
import { saveAdminNotes } from "@/admin/shared/lib/admin-notes";

const followUpSchema = z.object({
  status: z.enum(["unattended", "attended"]).optional(),
  notes: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdminAuth(request);
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const { id } = params;
    const body = await request.json();
    const parsed = followUpSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid follow-up parameters", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const updates = {
      ...(parsed.data.status !== undefined ? { follow_up_status: parsed.data.status } : {}),
      ...(parsed.data.notes !== undefined ? { follow_up_notes: parsed.data.notes } : {}),
    };

    // Stored in the admin-only notes table (see lib/admin-notes).
    const { error: updateError } = await saveAdminNotes(auth.adminSupabase, id, {
      companyStatus: parsed.data.status,
      companyNotes: parsed.data.notes,
    });

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, updates });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to update follow-up" },
      { status: 500 }
    );
  }
}
