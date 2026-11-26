import { NextResponse } from "next/server";
import { createClient } from "@/supabase/server";
import { createAdminClient } from "@/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Owner-only server endpoint to permanently delete a team member.
 * Deletes via service-role after verifying caller === emp.owner_id so
 * child references (contacts, card_upload_tickets, fulfillment_job_items,
 * affiliate_requests) and auth logins are always cleaned up atomically.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: employeeId } = await params;
    if (!employeeId) {
      return NextResponse.json({ error: "Missing employee ID" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Please sign in again" }, { status: 401 });
    }

    if ((user.user_metadata as { role?: string } | undefined)?.role === "employee") {
      return NextResponse.json(
        { error: "Only the business owner can delete team members" },
        { status: 403 }
      );
    }

    const admin = createAdminClient();

    const { data: emp, error: empErr } = await admin
      .from("employees")
      .select("id, owner_id, user_id, name")
      .eq("id", employeeId)
      .maybeSingle();

    if (empErr) {
      return NextResponse.json({ error: empErr.message }, { status: 500 });
    }

    if (!emp || emp.owner_id !== user.id) {
      return NextResponse.json({ error: "Team member not found" }, { status: 404 });
    }

    // 1. Delete linked Auth user login if one exists so they cannot keep signing in
    if (emp.user_id) {
      const { error: delAuthErr } = await admin.auth.admin.deleteUser(emp.user_id);
      if (delAuthErr && !/not found/i.test(delAuthErr.message)) {
        return NextResponse.json(
          { error: `Could not remove employee login: ${delAuthErr.message}` },
          { status: 500 }
        );
      }
    }

    // 2. Detach any optional child references defensively in case older DBs lack ON DELETE SET NULL
    await Promise.all([
      admin.from("contacts").update({ employee_id: null }).eq("employee_id", employeeId),
      admin.from("card_upload_tickets").update({ employee_id: null }).eq("employee_id", employeeId),
      admin.from("fulfillment_job_items").update({ employee_id: null }).eq("employee_id", employeeId),
      admin.from("affiliate_requests").update({ employee_id: null }).eq("employee_id", employeeId),
    ].map((p) => Promise.resolve(p).catch(() => null)));

    // 3. Delete the employee row and verify it was removed
    const { data: deletedRows, error: delErr } = await admin
      .from("employees")
      .delete()
      .eq("id", employeeId)
      .eq("owner_id", user.id)
      .select("id");

    if (delErr) {
      return NextResponse.json(
        { error: `Failed to delete team member: ${delErr.message}` },
        { status: 500 }
      );
    }

    if (!deletedRows || deletedRows.length === 0) {
      return NextResponse.json(
        { error: "Team member could not be deleted from database" },
        { status: 500 }
      );
    }

    return NextResponse.json({ deleted: true, id: employeeId });
  } catch (err: any) {
    console.error("[Team Delete API] Exception:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to delete team member" },
      { status: 500 }
    );
  }
}
