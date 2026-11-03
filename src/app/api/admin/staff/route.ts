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
 * If the account already exists, safely reconciles and promotes them to staff.
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
    const cleanEmail = email.trim().toLowerCase();

    // 1. Generate clean, valid slug upfront before creating auth user
    //    so DB triggers reading raw_user_meta_data->>'slug' never receive null
    const cleanBase = (displayName || cleanEmail.split("@")[0])
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 16) || (assignedRole === "designer" ? "designer" : "admin");
    const randomSuffix = Math.random().toString(36).substring(2, 10);
    const generatedSlug = `${cleanBase}${randomSuffix}`;

    // 2. Check if user already exists in auth or profiles
    let userId: string | null = null;
    let existingSlug: string | null = null;

    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id, slug")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (existingProfile) {
      userId = existingProfile.id;
      existingSlug = existingProfile.slug;
      // Update password and metadata for existing auth user
      await supabase.auth.admin.updateUserById(existingProfile.id, {
        password,
        app_metadata: {
          role: assignedRole,
          is_admin: assignedRole === "admin",
        },
        user_metadata: {
          role: assignedRole,
          owner_name: displayName,
          business_name: displayName,
          full_name: displayName,
          name: displayName,
          slug: existingProfile.slug || generatedSlug,
        },
      });
    } else {
      // Create new verified user via Supabase Auth Admin API (No OTP required)
      const { data: createdAuth, error: authError } = await supabase.auth.admin.createUser({
        email: cleanEmail,
        password,
        email_confirm: true,
        app_metadata: {
          role: assignedRole,
          is_admin: assignedRole === "admin",
        },
        user_metadata: {
          role: assignedRole,
          owner_name: displayName,
          business_name: displayName,
          full_name: displayName,
          name: displayName,
          slug: generatedSlug,
        },
      });

      if (authError || !createdAuth?.user) {
        // If error indicates user exists, try to locate by email
        if (authError?.message?.toLowerCase().includes("already") || authError?.message?.toLowerCase().includes("registered")) {
          const { data: userList } = await supabase.auth.admin.listUsers();
          const match = userList?.users?.find((u) => u.email?.toLowerCase() === cleanEmail);
          if (match) {
            userId = match.id;
            await supabase.auth.admin.updateUserById(match.id, {
              password,
              app_metadata: {
                role: assignedRole,
                is_admin: assignedRole === "admin",
              },
              user_metadata: {
                role: assignedRole,
                owner_name: displayName,
                business_name: displayName,
                full_name: displayName,
                name: displayName,
                slug: generatedSlug,
              },
            });
          }
        }

        if (!userId) {
          console.error("[Staff API] Error creating auth user:", authError);
          return NextResponse.json(
            { error: authError?.message || "Failed to create user credentials" },
            { status: 400 }
          );
        }
      } else {
        userId = createdAuth.user.id;
      }
    }

    if (!userId) {
      return NextResponse.json({ error: "Failed to resolve staff user credentials" }, { status: 500 });
    }

    const staffSlug = existingSlug || generatedSlug;

    // 3. Upsert into profiles ensuring role, is_admin, and no customer subscription
    const { error: upsertErr } = await supabase
      .from("profiles")
      .upsert({
        id: userId,
        email: cleanEmail,
        owner_name: displayName,
        business_name: displayName,
        slug: staffSlug,
        is_admin: assignedRole === "admin",
        role: assignedRole,
        status: "active",
        subscription_plan: "none",
        primary_card_count: 0,
        is_member: false,
        trial_status: "none",
        membership_expires_at: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" });

    if (upsertErr) {
      console.error("[Staff API] Error updating staff profile:", upsertErr);
      return NextResponse.json(
        { error: upsertErr.message || "Failed to configure staff profile" },
        { status: 500 }
      );
    }

    // 4. Staff are operators, NOT customer accounts. Ensure no customer card exists.
    await supabase.from("cards").delete().eq("profile_id", userId);

    return NextResponse.json({
      success: true,
      user: {
        id: userId,
        email: cleanEmail,
        name: displayName,
        role: assignedRole,
      },
      message: `Account configured successfully for ${cleanEmail} as ${assignedRole.toUpperCase()}.`,
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
          subscription_plan: "none",
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (roleError) {
        console.error("[Staff API] Error updating role:", roleError);
        return NextResponse.json({ error: roleError.message }, { status: 500 });
      }

      await supabase.auth.admin.updateUserById(userId, {
        app_metadata: {
          role: newRole,
          is_admin: newRole === "admin",
        },
      });

      await supabase.from("cards").delete().eq("profile_id", userId);
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
