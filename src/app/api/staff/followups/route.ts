import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { z } from "zod";
import { createAdminClient } from "@/supabase/admin";
import { createStaffNotification } from "@/lib/fulfillment/service";

export const dynamic = "force-dynamic";

async function resolveCrmActor() {
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
    .select("id, is_admin, role, is_partner, is_campaign_manager, owner_name, business_name")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) return null;
  const isAdmin = Boolean(profile.is_admin || profile.role === "admin");
  const isPartner = Boolean(
    !isAdmin &&
      (profile.is_partner ||
        profile.is_campaign_manager ||
        profile.role === "partner" ||
        profile.role === "campaign_manager")
  );

  if (!isAdmin && !isPartner) return null;
  return {
    userId: user.id,
    role: (isAdmin ? "admin" : "partner") as "admin" | "partner",
    name: profile.owner_name || profile.business_name || (isAdmin ? "Admin" : "Partner"),
    admin,
  };
}

const createFollowupSchema = z.object({
  profileId: z.string().uuid(),
  dueAt: z.string(),
  followupType: z.enum(["day_30", "day_60", "day_90", "expiry_3d", "custom"]).default("custom"),
  notes: z.string().min(1).max(500),
});

export async function GET(request: Request) {
  const ctx = await resolveCrmActor();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const profileId = url.searchParams.get("profileId");

    let query = ctx.admin
      .from("crm_followups")
      .select("*")
      .order("due_at", { ascending: true });

    if (profileId) {
      query = query.eq("profile_id", profileId);
    }
    if (ctx.role === "partner") {
      query = query.eq("assigned_user_id", ctx.userId);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ followups: [], missingTable: true });
    }

    const rows = data || [];
    const profileIds = Array.from(new Set(rows.map((r: any) => r.profile_id)));
    let profileMap = new Map<string, any>();
    if (profileIds.length > 0) {
      const { data: profs } = await ctx.admin
        .from("profiles")
        .select("id, business_name, owner_name, phone, subscription_plan, membership_expires_at, referred_by")
        .in("id", profileIds);
      profileMap = new Map((profs || []).map((p: any) => [p.id, p]));
    }

    const followups = rows.map((r: any) => {
      const p = profileMap.get(r.profile_id);
      return {
        ...r,
        businessName: p?.business_name || p?.owner_name || "Customer",
        ownerName: p?.owner_name || "Owner",
        phone: p?.phone || null,
        subscriptionPlan: p?.subscription_plan || "free",
      };
    });

    return NextResponse.json({ followups });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load follow-ups" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const ctx = await resolveCrmActor();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = createFollowupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid follow-up details", details: parsed.error.issues }, { status: 400 });
    }

    const { profileId, dueAt, followupType, notes } = parsed.data;

    // Verify partner ownership if partner
    const { data: targetProfile } = await ctx.admin
      .from("profiles")
      .select("id, business_name, owner_name, referred_by")
      .eq("id", profileId)
      .maybeSingle();

    if (!targetProfile) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    if (ctx.role === "partner" && targetProfile.referred_by !== ctx.userId) {
      const { data: ref } = await ctx.admin
        .from("referrals")
        .select("id")
        .eq("campaign_manager_id", ctx.userId)
        .eq("referred_user_id", profileId)
        .maybeSingle();
      if (!ref) {
        return NextResponse.json({ error: "Forbidden: Not your referred customer" }, { status: 403 });
      }
    }

    const assignedRole = ctx.role === "partner" || targetProfile.referred_by ? "partner" : "admin";
    const assignedUserId = ctx.role === "partner" ? ctx.userId : targetProfile.referred_by || null;

    const { data: created, error } = await ctx.admin
      .from("crm_followups")
      .insert({
        profile_id: profileId,
        assigned_role: assignedRole,
        assigned_user_id: assignedUserId,
        followup_type: followupType,
        due_at: new Date(dueAt).toISOString(),
        status: "pending",
        notes,
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Mirror next_followup_at onto profiles for quick display
    await ctx.admin
      .from("profiles")
      .update({
        next_followup_at: new Date(dueAt).toISOString(),
        next_followup_note: notes,
      })
      .eq("id", profileId);

    // Notify Admin if scheduled for tomorrow or today, or if scheduled by a Partner
    const diffDays = Math.ceil((new Date(dueAt).getTime() - Date.now()) / 86_400_000);
    const bizName = targetProfile.business_name || targetProfile.owner_name || "Company";
    if (diffDays <= 1 || ctx.role === "partner") {
      await createStaffNotification(ctx.admin, {
        recipientRole: "admin",
        eventType: "followup_scheduled",
        severity: diffDays <= 1 ? "action_required" : "info",
        title: `Follow-up Scheduled: ${bizName}`,
        message: `${ctx.name} scheduled follow-up for ${new Date(dueAt).toLocaleDateString("en-IN")}: "${notes}"`,
        entityType: "followup",
        entityId: created.id,
        profileId,
      });
    }

    return NextResponse.json({ success: true, followup: created });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to schedule follow-up" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const ctx = await resolveCrmActor();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { followupId, status } = body;
    if (!followupId || !["completed", "dismissed", "pending"].includes(status)) {
      return NextResponse.json({ error: "followupId and valid status required" }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    let query = ctx.admin
      .from("crm_followups")
      .update({
        status,
        completed_by: status === "completed" ? ctx.userId : null,
        completed_by_role: status === "completed" ? ctx.role : null,
        completed_at: status === "completed" ? nowIso : null,
      })
      .eq("id", followupId);

    if (ctx.role === "partner") {
      query = query.eq("assigned_user_id", ctx.userId);
    }

    const { data, error } = await query.select("*").single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, followup: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update follow-up" }, { status: 500 });
  }
}
