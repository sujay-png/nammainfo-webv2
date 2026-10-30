import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/admin/shared/lib/admin-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/staff
 * Lists all staff accounts (Admins & Designers).
 */
export async function GET(request: Request) {
  const auth = await requireAdminAuth(request);
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const supabase = auth.adminSupabase;

    // Fetch profiles that have is_admin = true or role in ('admin', 'designer')
    const { data: staffList, error } = await supabase
      .from("profiles")
      .select("id, email, owner_name, business_name, role, is_admin, created_at, status")
      .or("is_admin.eq.true,role.in.(admin,designer)")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[Staff API] Error fetching staff:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const formatted = (staffList || []).map((s: any) => ({
      id: s.id,
      email: s.email,
      name: s.owner_name || s.business_name || "Staff Member",
      role: s.role || (s.is_admin ? "admin" : "designer"),
      isAdmin: Boolean(s.is_admin || s.role === "admin"),
      createdAt: s.created_at,
      status: s.status || "active",
    }));

    return NextResponse.json({ staff: formatted });
  } catch (err: any) {
    console.error("[Staff API] Exception in GET:", err);
    return NextResponse.json(
      { error: err.message || "Failed to load staff accounts" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/staff
 * Creates a new staff account (Admin or Designer) with pre-verified email.
 */
export async function POST(request: Request) {
  const auth = await requireAdminAuth(request);
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const supabase = auth.adminSupabase;
    const body = await request.json();
    const { email, password, role, name } = body;

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "A valid email address is required" }, { status: 400 });
    }

    if (!password || password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const assignedRole: "admin" | "designer" = role === "designer" ? "designer" : "admin";
    const displayName = (name || "").trim() || (assignedRole === "designer" ? "Card Designer" : "Platform Admin");

    // 1. Create verified user via Supabase Auth Admin API (No OTP required)
    const { data: createdAuth, error: authError } = await supabase.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: {
        role: assignedRole,
        owner_name: displayName,
        business_name: displayName,
      },
    });

    if (authError || !createdAuth?.user) {
      console.error("[Staff API] Error creating auth user:", authError);
      return NextResponse.json(
        { error: authError?.message || "Failed to create user credentials" },
        { status: 400 }
      );
    }

    const userId = createdAuth.user.id;

    // 2. Upsert profile with staff role
    const { error: profileError } = await supabase
      .from("profiles")
      .upsert({
        id: userId,
        email: email.trim().toLowerCase(),
        owner_name: displayName,
        business_name: displayName,
        is_admin: assignedRole === "admin",
        role: assignedRole,
        status: "active",
        subscription_plan: "pro",
        updated_at: new Date().toISOString(),
      });

    if (profileError) {
      console.error("[Staff API] Error creating profile:", profileError);
      // Clean up created auth user if profile creation fails
      await supabase.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: profileError.message || "Failed to initialize staff profile" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: userId,
        email: email.trim().toLowerCase(),
        name: displayName,
        role: assignedRole,
      },
      message: `Account created successfully for ${email} as ${assignedRole.toUpperCase()}.`,
    });
  } catch (err: any) {
    console.error("[Staff API] Exception in POST:", err);
    return NextResponse.json(
      { error: err.message || "Failed to create staff account" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/staff
 * Updates a staff account's password directly without OTP.
 */
export async function PATCH(request: Request) {
  const auth = await requireAdminAuth(request);
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const supabase = auth.adminSupabase;
    const body = await request.json();
    const { userId, newPassword, newRole } = body;

    if (!userId) {
      return NextResponse.json({ error: "Staff User ID is required" }, { status: 400 });
    }

    // 1. Update password if provided
    if (newPassword) {
      if (newPassword.length < 6) {
        return NextResponse.json(
          { error: "Password must be at least 6 characters long" },
          { status: 400 }
        );
      }

      const { error: pwdError } = await supabase.auth.admin.updateUserById(userId, {
        password: newPassword,
      });

      if (pwdError) {
        console.error("[Staff API] Error updating password:", pwdError);
        return NextResponse.json({ error: pwdError.message }, { status: 500 });
      }
    }

    // 2. Update role if provided
    if (newRole && (newRole === "admin" || newRole === "designer")) {
      const { error: roleError } = await supabase
        .from("profiles")
        .update({
          role: newRole,
          is_admin: newRole === "admin",
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (roleError) {
        console.error("[Staff API] Error updating role:", roleError);
        return NextResponse.json({ error: roleError.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      message: "Staff account updated successfully.",
    });
  } catch (err: any) {
    console.error("[Staff API] Exception in PATCH:", err);
    return NextResponse.json(
      { error: err.message || "Failed to update staff account" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/staff
 * Deletes a staff account.
 */
export async function DELETE(request: Request) {
  const auth = await requireAdminAuth(request);
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const supabase = auth.adminSupabase;
    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get("id");

    if (!targetUserId) {
      return NextResponse.json({ error: "Staff ID is required" }, { status: 400 });
    }

    // Prevent administrator from deleting themselves
    if (targetUserId === auth.userId) {
      return NextResponse.json(
        { error: "You cannot delete your own logged-in administrator account." },
        { status: 400 }
      );
    }

    // 1. Delete profile
    await supabase.from("profiles").delete().eq("id", targetUserId);

    // 2. Delete user from auth
    const { error: authErr } = await supabase.auth.admin.deleteUser(targetUserId);
    if (authErr) {
      console.warn("[Staff API] Warning deleting auth user:", authErr.message);
    }

    return NextResponse.json({
      success: true,
      message: "Staff account removed successfully.",
    });
  } catch (err: any) {
    console.error("[Staff API] Exception in DELETE:", err);
    return NextResponse.json(
      { error: err.message || "Failed to delete staff account" },
      { status: 500 }
    );
  }
}

