import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/admin/shared/lib/admin-auth";

const suspendSchema = z.object({
  status: z.enum(["active", "suspended", "expired", "pending"]),
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
    const parsed = suspendSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid status provided", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { status } = parsed.data;
    const supabase = auth.adminSupabase;

    // 1. Update profile status
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ status })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    // 2. Cascade card activation/deactivation
    const isCardActive = status === "active";
    await supabase
      .from("cards")
      .update({ is_active: isCardActive })
      .eq("profile_id", id);

    // 3. Cascade employee profiles activation/deactivation
    await supabase
      .from("employees")
      .update({ is_active: isCardActive })
      .eq("owner_id", id);

    return NextResponse.json({
      success: true,
      status,
      message: `Account status updated to ${status}`,
    });
  } catch (err: any) {
    console.error("[Admin API] Error updating status:", err);
    return NextResponse.json(
      { error: err.message || "Failed to update status" },
      { status: 500 }
    );
  }
}
