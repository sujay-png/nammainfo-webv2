import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/admin/shared/lib/admin-auth";

const bulkEmployeeSchema = z.object({
  action: z.enum(["set_lifetime", "sync_company", "assign_all_premium", "custom_date", "set_pro", "set_free"]),
  customExpiryDate: z.string().optional(),
  employeeIds: z.array(z.string()).optional(),
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
    const { id: companyId } = params;
    const body = await request.json();
    const parsed = bulkEmployeeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid action", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const supabase = auth.adminSupabase;

    let targetExpiry: string | null = null;
    let isPremium = true;
    let status = "active";

    if (parsed.data.action === "set_free") {
      isPremium = false;
      status = "unassigned";
      targetExpiry = null;
    } else if (parsed.data.action === "sync_company") {
      const { data: comp } = await supabase
        .from("profiles")
        .select("membership_expires_at")
        .eq("id", companyId)
        .single();
      targetExpiry = comp?.membership_expires_at || null;
    } else if (parsed.data.action === "set_lifetime") {
      targetExpiry = "2099-12-31T23:59:59.000Z";
    } else if (parsed.data.action === "set_pro" || parsed.data.action === "custom_date") {
      if (parsed.data.customExpiryDate) {
        targetExpiry = new Date(parsed.data.customExpiryDate).toISOString();
      } else {
        targetExpiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
      }
    }

    const updates: Record<string, any> = {
      is_premium: isPremium,
      status,
      is_active: status !== "suspended",
      subscription_expires_at: targetExpiry,
    };

    let query = supabase.from("employees").update(updates);
    if (parsed.data.employeeIds && parsed.data.employeeIds.length > 0) {
      query = query.in("id", parsed.data.employeeIds).eq("owner_id", companyId);
    } else {
      query = query.eq("owner_id", companyId);
    }

    const { error: updateError } = await query;

    if (updateError) {
      console.error("[Admin API] Failed bulk employee update:", updateError);
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Bulk updated employees for company ${companyId}`,
    });
  } catch (err: any) {
    console.error("[Admin API] Unexpected error in bulk employee update:", err);
    return NextResponse.json(
      { error: err.message || "Failed bulk update" },
      { status: 500 }
    );
  }
}
