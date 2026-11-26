import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createAdminClient } from "@/supabase/admin";
import { runScheduledAlertSweep } from "@/lib/fulfillment/service";

export const dynamic = "force-dynamic";

async function resolveSessionRole() {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, is_admin, role, is_partner, is_campaign_manager")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) return null;
  const isAdmin = Boolean(profile.is_admin || profile.role === "admin");
  const isDesigner = !isAdmin && profile.role === "designer";
  const isPartner = Boolean(
    !isAdmin &&
      !isDesigner &&
      (profile.is_partner ||
        profile.is_campaign_manager ||
        profile.role === "partner" ||
        profile.role === "campaign_manager")
  );

  if (!isAdmin && !isDesigner && !isPartner) return null;

  return {
    userId: user.id,
    role: (isAdmin ? "admin" : isDesigner ? "designer" : "partner") as "admin" | "designer" | "partner",
    admin,
  };
}

export async function GET(request: Request) {
  const ctx = await resolveSessionRole();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const sweep = url.searchParams.get("sweep") === "1";
    if (sweep && (ctx.role === "admin" || ctx.role === "partner")) {
      await runScheduledAlertSweep(ctx.admin);
    }

    let query = ctx.admin
      .from("staff_notifications")
      .select("*")
      .eq("recipient_role", ctx.role)
      .order("created_at", { ascending: false })
      .limit(200);

    if (ctx.role === "partner") {
      query = query.eq("recipient_user_id", ctx.userId);
    }

    const { data, error } = await query;
    if (error) {
      // Graceful fallback if table hasn't been migrated yet
      return NextResponse.json({ notifications: [], unreadCount: 0, missingTable: true });
    }

    const notifications = data || [];
    const unreadCount = notifications.filter((n: any) => !n.is_read).length;

    return NextResponse.json({ notifications, unreadCount });
  } catch (err: any) {
    console.error("[Staff Notifications API] GET error:", err);
    return NextResponse.json({ notifications: [], unreadCount: 0 });
  }
}

export async function PATCH(request: Request) {
  const ctx = await resolveSessionRole();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { notificationId, markAllRead } = body;
    const nowIso = new Date().toISOString();

    if (markAllRead) {
      let query = ctx.admin
        .from("staff_notifications")
        .update({ is_read: true, read_at: nowIso })
        .eq("recipient_role", ctx.role)
        .eq("is_read", false);

      if (ctx.role === "partner") {
        query = query.eq("recipient_user_id", ctx.userId);
      }
      await query;
      return NextResponse.json({ success: true });
    }

    if (notificationId) {
      let query = ctx.admin
        .from("staff_notifications")
        .update({ is_read: true, read_at: nowIso })
        .eq("id", notificationId)
        .eq("recipient_role", ctx.role);

      if (ctx.role === "partner") {
        query = query.eq("recipient_user_id", ctx.userId);
      }
      await query;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "notificationId or markAllRead is required" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update notifications" }, { status: 500 });
  }
}
