import type { SupabaseClient } from "@supabase/supabase-js";
import { buildPublicCardUrl } from "@/admin/shared/lib/card-urls";
import { saveAdminNotes } from "@/admin/shared/lib/admin-notes";
import {
  applyMilestoneWithAttribution,
  canRoleToggleMilestone,
  canRoleTransitionStage,
  milestoneToStage,
  stageToLegacyOrderStatus,
  stageToMilestoneKey,
  type CardProcessMap,
  type CardProcessStepKey,
  type FulfillmentJobType,
  type FulfillmentStage,
  type StaffRole,
} from "./state-machine";

export interface ActorInfo {
  id: string;
  role: StaffRole;
  name?: string | null;
}

export interface StaffNotificationInput {
  recipientRole: "admin" | "designer" | "partner";
  recipientUserId?: string | null;
  eventType: string;
  severity?: "info" | "action_required" | "urgent";
  title: string;
  message: string;
  entityType?: string | null;
  entityId?: string | null;
  profileId?: string | null;
  dedupeKey?: string | null;
}

/**
 * Safely records a notification in `staff_notifications`.
 * Swallows missing-table or duplicate dedupe errors so primary workflows never fail.
 */
export async function createStaffNotification(
  admin: SupabaseClient,
  input: StaffNotificationInput
): Promise<void> {
  try {
    const payload = {
      recipient_role: input.recipientRole,
      recipient_user_id: input.recipientUserId ?? null,
      event_type: input.eventType,
      severity: input.severity ?? "info",
      title: input.title,
      message: input.message,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      profile_id: input.profileId ?? null,
      dedupe_key: input.dedupeKey ?? null,
    };

    if (input.dedupeKey) {
      await admin
        .from("staff_notifications")
        .upsert(payload, { onConflict: "dedupe_key", ignoreDuplicates: true });
    } else {
      await admin.from("staff_notifications").insert(payload);
    }
  } catch (err) {
    console.warn("[Fulfillment] Notification insert skipped:", err);
  }
}

export async function resolveActorName(
  admin: SupabaseClient,
  userId: string,
  fallbackRole: StaffRole
): Promise<string> {
  try {
    const { data } = await admin
      .from("profiles")
      .select("owner_name, business_name, email")
      .eq("id", userId)
      .maybeSingle();
    if (data?.owner_name) return data.owner_name;
    if (data?.business_name) return data.business_name;
    if (data?.email) return data.email.split("@")[0];
  } catch {
    // ignore
  }
  return fallbackRole.charAt(0).toUpperCase() + fallbackRole.slice(1);
}

/**
 * Creates a canonical `fulfillment_jobs` record + initial `fulfillment_job_items`
 * when a Razorpay payment succeeds (`pro_initial`, `team_addon`, `primary_addon`).
 */
export async function createFulfillmentJobForOrder(
  admin: SupabaseClient,
  params: {
    profileId: string;
    orderId: string;
    orderType: "pro_initial" | "team_addon" | "primary_card_addon";
    cardQuantity: number;
    designUrl?: string | null;
    designMode?: string | null;
    shippingAddress?: Record<string, unknown> | null;
  }
): Promise<string | null> {
  try {
    const jobType: FulfillmentJobType =
      params.orderType === "team_addon"
        ? "team_addon"
        : params.orderType === "primary_card_addon"
        ? "primary_addon"
        : "pro_initial";

    const shipping = (params.shippingAddress || {}) as Record<string, any>;
    const cardDetails = (shipping.cardDetails || {}) as Record<string, any>;
    const templateUrl =
      params.designUrl ||
      cardDetails.fileUrl ||
      null;

    const { data: profile } = await admin
      .from("profiles")
      .select("id, business_name, owner_name, phone, slug, username, avatar_url, default_card_template_url")
      .eq("id", params.profileId)
      .maybeSingle();

    const effectiveTemplate = templateUrl || profile?.default_card_template_url || null;

    const { data: job, error } = await admin
      .from("fulfillment_jobs")
      .insert({
        profile_id: params.profileId,
        order_id: params.orderId,
        job_type: jobType,
        stage: "awaiting_customer",
        card_quantity: Math.max(1, params.cardQuantity),
        master_template_url: effectiveTemplate,
        design_notes: cardDetails.designNotes || null,
        shipping_address: shipping,
        last_updated_by_role: "system",
        last_updated_by_name: "Checkout",
      })
      .select("id")
      .single();

    if (error || !job) {
      console.warn("[Fulfillment] Could not create fulfillment_job:", error?.message);
      return null;
    }

    // Save reusable master template on company profile if one was provided during team_addon or pro_initial
    if (templateUrl && !profile?.default_card_template_url) {
      await admin
        .from("profiles")
        .update({
          default_card_template_url: templateUrl,
          ...(cardDetails.designNotes ? { default_card_design_notes: String(cardDetails.designNotes) } : {}),
        })
        .eq("id", params.profileId);
    }

    const ownerSlug = profile?.username || profile?.slug || params.profileId;
    if (jobType === "pro_initial" || jobType === "primary_addon") {
      await admin.from("fulfillment_job_items").insert({
        job_id: job.id,
        profile_id: params.profileId,
        target_type: "primary",
        display_name: profile?.business_name || profile?.owner_name || "Primary Business Card",
        designation: profile?.owner_name ? `Owner: ${profile.owner_name}` : "Primary Card",
        phone: profile?.phone || shipping.phone || null,
        photo_url: profile?.avatar_url || null,
        public_card_url: buildPublicCardUrl(ownerSlug),
        design_mode: effectiveTemplate ? "custom_upload" : "team_assist",
        design_file_url: effectiveTemplate,
        design_notes: cardDetails.designNotes || null,
      });
    }

    await admin.from("fulfillment_events").insert({
      job_id: job.id,
      actor_role: "customer",
      actor_name: profile?.owner_name || profile?.business_name || "Customer",
      from_stage: null,
      to_stage: "awaiting_customer",
      note: `Created from ${jobType} payment (${params.cardQuantity} card${params.cardQuantity === 1 ? "" : "s"}).`,
    });

    return job.id;
  } catch (err) {
    console.warn("[Fulfillment] createFulfillmentJobForOrder skipped:", err);
    return null;
  }
}

/**
 * Creates a canonical `fulfillment_jobs` record + primary item when a 100-Day Free Trial is approved,
 * and seeds Day 30 / 60 / 90 CRM follow-ups.
 */
export async function createFulfillmentAndFollowupsForTrial(
  admin: SupabaseClient,
  profileId: string,
  approvedAtIso: string
): Promise<void> {
  try {
    const { data: profile } = await admin
      .from("profiles")
      .select("id, business_name, owner_name, phone, slug, username, avatar_url, referred_by, default_card_template_url")
      .eq("id", profileId)
      .maybeSingle();

    if (!profile) return;

    const { data: existingJob } = await admin
      .from("fulfillment_jobs")
      .select("id")
      .eq("profile_id", profileId)
      .eq("job_type", "free_trial")
      .maybeSingle();

    if (!existingJob) {
      const { data: job } = await admin
        .from("fulfillment_jobs")
        .insert({
          profile_id: profileId,
          job_type: "free_trial",
          stage: "awaiting_customer",
          card_quantity: 1,
          master_template_url: profile.default_card_template_url || null,
          last_updated_by_role: "admin",
          last_updated_by_name: "Trial Approved",
        })
        .select("id")
        .single();

      if (job) {
        const ownerSlug = profile.username || profile.slug || profileId;
        await admin.from("fulfillment_job_items").insert({
          job_id: job.id,
          profile_id: profileId,
          target_type: "primary",
          display_name: profile.business_name || profile.owner_name || "Free Trial Card",
          designation: profile.owner_name ? `Owner: ${profile.owner_name}` : "Trial Primary Card",
          phone: profile.phone || null,
          photo_url: profile.avatar_url || null,
          public_card_url: buildPublicCardUrl(ownerSlug),
          design_mode: profile.default_card_template_url ? "company_template" : "team_assist",
          design_file_url: profile.default_card_template_url || null,
        });
      }
    }

    // Seed Day 30, Day 60, Day 90 follow-ups
    const baseMs = new Date(approvedAtIso).getTime();
    const assignedRole = profile.referred_by ? "partner" : "admin";
    const followups = [
      { type: "day_30", days: 30, note: "Day 30 Free Trial milestone check-in" },
      { type: "day_60", days: 60, note: "Day 60 Free Trial review & team check-in" },
      { type: "day_90", days: 90, note: "Day 90 Pre-expiry Pro conversion follow-up" },
    ];

    const { data: existingFollowups } = await admin
      .from("crm_followups")
      .select("followup_type")
      .eq("profile_id", profileId);
    const existingTypes = new Set((existingFollowups || []).map((f: any) => f.followup_type));

    const toInsert = followups
      .filter((f) => !existingTypes.has(f.type))
      .map((f) => ({
        profile_id: profileId,
        assigned_role: assignedRole,
        assigned_user_id: profile.referred_by || null,
        followup_type: f.type,
        due_at: new Date(baseMs + f.days * 86_400_000).toISOString(),
        status: "pending",
        notes: f.note,
      }));

    if (toInsert.length > 0) {
      await admin.from("crm_followups").insert(toInsert);
    }
  } catch (err) {
    console.warn("[Fulfillment] createFulfillmentAndFollowupsForTrial skipped:", err);
  }
}

/**
 * Transitions a `fulfillment_jobs` row to a new stage, enforcing role permissions,
 * recording audit trail (`fulfillment_events`), syncing `orders` and `profiles.card_process`,
 * and emitting notifications.
 */
export async function transitionFulfillmentJobStage(
  admin: SupabaseClient,
  params: {
    jobId: string;
    toStage: FulfillmentStage;
    actor: ActorInfo;
    courierName?: string | null;
    trackingNumber?: string | null;
    note?: string | null;
  }
): Promise<{ ok: true; job: any } | { ok: false; status: number; error: string }> {
  const { data: job, error: jobErr } = await admin
    .from("fulfillment_jobs")
    .select("*")
    .eq("id", params.jobId)
    .maybeSingle();

  if (jobErr || !job) {
    return { ok: false, status: 404, error: "Fulfillment job not found." };
  }

  const fromStage = (job.stage || "awaiting_customer") as FulfillmentStage;
  const check = canRoleTransitionStage(params.actor.role, fromStage, params.toStage);
  if (!check.allowed) {
    return { ok: false, status: 403, error: check.reason || "Permission denied for this stage." };
  }

  const nowIso = new Date().toISOString();
  const actorName = params.actor.name || (await resolveActorName(admin, params.actor.id, params.actor.role));

  const patch: Record<string, any> = {
    stage: params.toStage,
    updated_at: nowIso,
    last_updated_by: params.actor.id || null,
    last_updated_by_role: params.actor.role,
    last_updated_by_name: actorName,
  };

  if (params.toStage === "sent_to_designer" && !job.sent_to_designer_at) {
    patch.sent_to_designer_at = nowIso;
  }
  if (params.toStage === "printed_ready") {
    patch.printed_at = nowIso;
  }
  if (params.toStage === "posted") {
    patch.posted_at = nowIso;
    if (params.courierName !== undefined) patch.courier_name = params.courierName || null;
    if (params.trackingNumber !== undefined) patch.tracking_number = params.trackingNumber || null;
  }
  if (params.toStage === "delivered") {
    patch.delivered_at = nowIso;
  }

  const { data: updatedJob, error: updErr } = await admin
    .from("fulfillment_jobs")
    .update(patch)
    .eq("id", params.jobId)
    .select("*")
    .single();

  if (updErr) {
    return { ok: false, status: 500, error: updErr.message };
  }

  // Mark items printed when job reaches printed_ready or beyond
  if (
    params.toStage === "printed_ready" ||
    params.toStage === "posted" ||
    params.toStage === "delivered"
  ) {
    await admin
      .from("fulfillment_job_items")
      .update({ is_printed: true, updated_at: nowIso })
      .eq("job_id", params.jobId);
  }

  // Sync linked legacy order row
  if (job.order_id) {
    await admin
      .from("orders")
      .update({
        status: stageToLegacyOrderStatus(params.toStage),
        updated_at: nowIso,
      })
      .eq("id", job.order_id);
  }

  // Sync company profile `card_process` with actor attribution
  const milestoneKey = stageToMilestoneKey(params.toStage);
  if (milestoneKey) {
    const { data: prof } = await admin
      .from("profiles")
      .select("id, business_name, owner_name, referred_by, card_process")
      .eq("id", job.profile_id)
      .maybeSingle();

    if (prof) {
      const nextProcess = applyMilestoneWithAttribution(
        (prof.card_process || {}) as CardProcessMap,
        milestoneKey,
        true,
        { id: params.actor.id, role: params.actor.role, name: actorName },
        nowIso
      );
      await admin
        .from("profiles")
        .update({ card_process: nextProcess })
        .eq("id", job.profile_id);

      const bizName = prof.business_name || prof.owner_name || "Customer";
      if (params.toStage === "sent_to_designer") {
        await createStaffNotification(admin, {
          recipientRole: "designer",
          eventType: "job_sent_to_designer",
          severity: "action_required",
          title: "New Card Ready for Design & Print",
          message: `${bizName} (${job.job_type === "free_trial" ? "Free Trial" : job.job_type.replace("_", " ")}, ${job.card_quantity} card${job.card_quantity === 1 ? "" : "s"}) sent to Designer by ${actorName}.`,
          entityType: "fulfillment_job",
          entityId: job.id,
          profileId: job.profile_id,
        });
      } else if (
        params.actor.role === "designer" &&
        (params.toStage === "printed_ready" || params.toStage === "posted" || params.toStage === "delivered")
      ) {
        const label =
          params.toStage === "printed_ready"
            ? "Card Printed & Ready"
            : params.toStage === "posted"
            ? "Card Posted"
            : "Card Delivered";
        await createStaffNotification(admin, {
          recipientRole: "admin",
          eventType: `designer_marked_${params.toStage}`,
          severity: "info",
          title: `${label}: ${bizName}`,
          message: `Designer (${actorName}) marked ${bizName} (${job.card_quantity} card${job.card_quantity === 1 ? "" : "s"}) as ${label}${params.trackingNumber ? ` (AWB: ${params.trackingNumber})` : ""}.`,
          entityType: "fulfillment_job",
          entityId: job.id,
          profileId: job.profile_id,
        });

        if (prof.referred_by && (params.toStage === "posted" || params.toStage === "delivered")) {
          await createStaffNotification(admin, {
            recipientRole: "partner",
            recipientUserId: prof.referred_by,
            eventType: `partner_card_${params.toStage}`,
            severity: "info",
            title: `${label}: ${bizName}`,
            message: `Your referred customer ${bizName}'s physical card was marked ${label}.`,
            entityType: "profile",
            entityId: job.profile_id,
            profileId: job.profile_id,
          });
        }
      }
    }
  }

  // Record audit event
  await admin.from("fulfillment_events").insert({
    job_id: params.jobId,
    actor_id: params.actor.id || null,
    actor_role: params.actor.role,
    actor_name: actorName,
    from_stage: fromStage,
    to_stage: params.toStage,
    note: params.note || (params.trackingNumber ? `Courier: ${params.courierName || "Courier"} • ${params.trackingNumber}` : null),
  });

  return { ok: true, job: updatedJob };
}

/**
 * Updates a company lifecycle milestone from Admin or Partner, enforcing role permissions,
 * syncing `fulfillment_jobs` & `orders`, storing attribution in `profiles.card_process`,
 * and sending cross-role notifications.
 */
export async function syncMilestoneChange(
  admin: SupabaseClient,
  params: {
    profileId: string;
    stepKey: CardProcessStepKey;
    completed: boolean;
    actor: ActorInfo;
    date?: string;
  }
): Promise<
  | { ok: true; cardProcess: CardProcessMap }
  | { ok: false; status: number; error: string }
> {
  if (!canRoleToggleMilestone(params.actor.role, params.stepKey)) {
    return {
      ok: false,
      status: 403,
      error: `Role '${params.actor.role}' is not permitted to update '${params.stepKey}'.`,
    };
  }

  const { data: profile, error: profErr } = await admin
    .from("profiles")
    .select("id, business_name, owner_name, subscription_plan, is_member, membership_expires_at, status, referred_by, card_process, default_card_template_url, avatar_url, phone, slug, username")
    .eq("id", params.profileId)
    .maybeSingle();

  if (profErr || !profile) {
    return { ok: false, status: 404, error: "Company profile not found." };
  }

  const actorName = params.actor.name || (await resolveActorName(admin, params.actor.id, params.actor.role));
  const nowIso = params.completed ? params.date || new Date().toISOString() : new Date().toISOString();

  const existingProcess =
    profile.card_process && typeof profile.card_process === "object"
      ? (profile.card_process as CardProcessMap)
      : {};

  const updatedProcess = applyMilestoneWithAttribution(
    existingProcess,
    params.stepKey,
    params.completed,
    { id: params.actor.id, role: params.actor.role, name: actorName },
    nowIso
  );

  // Persist to profiles.card_process (with admin notes fallback if migration not yet run)
  const { error: updErr } = await admin
    .from("profiles")
    .update({ card_process: updatedProcess })
    .eq("id", params.profileId);

  if (updErr) {
    const marker = `__CARD_PROCESS_JSON__:${JSON.stringify(updatedProcess)}`;
    await admin
      .from("profile_admin_notes")
      .upsert(
        {
          profile_id: params.profileId,
          follow_up_notes: marker,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "profile_id" }
      );
  }

  // Sync fulfillment_jobs + orders when marking card production stages
  const targetStage = milestoneToStage(params.stepKey);
  if (targetStage && params.completed) {
    const { data: activeJobs } = await admin
      .from("fulfillment_jobs")
      .select("id, stage, order_id, job_type, card_quantity")
      .eq("profile_id", params.profileId)
      .neq("stage", "cancelled")
      .order("created_at", { ascending: false });

    const jobs = activeJobs || [];
    if (jobs.length === 0 && targetStage === "sent_to_designer") {
      // Auto-create a fulfillment job if company has none yet (e.g. legacy Pro or Trial)
      const ownerSlug = profile.username || profile.slug || profile.id;
      const { data: createdJob } = await admin
        .from("fulfillment_jobs")
        .insert({
          profile_id: params.profileId,
          job_type: profile.subscription_plan === "trial" ? "free_trial" : "pro_initial",
          stage: "sent_to_designer",
          card_quantity: 1,
          master_template_url: profile.default_card_template_url || null,
          sent_to_designer_at: nowIso,
          last_updated_by: params.actor.id || null,
          last_updated_by_role: params.actor.role,
          last_updated_by_name: actorName,
        })
        .select("id")
        .single();

      if (createdJob) {
        await admin.from("fulfillment_job_items").insert({
          job_id: createdJob.id,
          profile_id: params.profileId,
          target_type: "primary",
          display_name: profile.business_name || profile.owner_name || "Primary Card",
          designation: profile.owner_name ? `Owner: ${profile.owner_name}` : "Primary Card",
          phone: profile.phone || null,
          photo_url: profile.avatar_url || null,
          public_card_url: buildPublicCardUrl(ownerSlug),
          design_mode: profile.default_card_template_url ? "company_template" : "team_assist",
          design_file_url: profile.default_card_template_url || null,
        });
      }
    } else {
      // Advance open jobs not yet past targetStage
      for (const j of jobs) {
        const shouldAdvance =
          (targetStage === "sent_to_designer" && j.stage === "awaiting_customer") ||
          (targetStage === "printed_ready" && ["awaiting_customer", "sent_to_designer"].includes(j.stage)) ||
          (targetStage === "posted" && ["awaiting_customer", "sent_to_designer", "printed_ready"].includes(j.stage)) ||
          (targetStage === "delivered" && j.stage !== "delivered");

        if (shouldAdvance) {
          await transitionFulfillmentJobStage(admin, {
            jobId: j.id,
            toStage: targetStage,
            actor: { id: params.actor.id, role: params.actor.role, name: actorName },
            note: `Synced from milestone '${params.stepKey}'`,
          });
        }
      }
    }

    // Legacy orders fallback sync (for environments before migration runs)
    const legacyStatus = stageToLegacyOrderStatus(targetStage);
    if (targetStage === "sent_to_designer") {
      await admin
        .from("orders")
        .update({ status: legacyStatus, updated_at: nowIso })
        .eq("profile_id", params.profileId)
        .eq("status", "under_review");
    } else if (targetStage === "printed_ready") {
      await admin
        .from("orders")
        .update({ status: legacyStatus, updated_at: nowIso })
        .eq("profile_id", params.profileId)
        .in("status", ["under_review", "card_designed", "on_work"]);
    } else if (targetStage === "posted") {
      await admin
        .from("orders")
        .update({ status: legacyStatus, updated_at: nowIso })
        .eq("profile_id", params.profileId)
        .in("status", ["under_review", "card_designed", "ready_to_dispatch", "on_work"]);
    } else if (targetStage === "delivered") {
      await admin
        .from("orders")
        .update({ status: legacyStatus, updated_at: nowIso })
        .eq("profile_id", params.profileId)
        .neq("status", "cancelled");
    }
  }

  // Sync CRM follow-up completion
  if (
    params.stepKey === "followup_1_done" ||
    params.stepKey === "followup_2_done" ||
    params.stepKey === "followup_3_done"
  ) {
    const milestoneNum =
      params.stepKey === "followup_1_done" ? 1 : params.stepKey === "followup_2_done" ? 2 : 3;
    const followupType =
      params.stepKey === "followup_1_done"
        ? "day_30"
        : params.stepKey === "followup_2_done"
        ? "day_60"
        : "day_90";

    await saveAdminNotes(admin, params.profileId, {
      milestone: params.completed ? milestoneNum : Math.max(0, milestoneNum - 1),
      status: params.completed ? "attended" : "unattended",
      notes: params.completed
        ? `Follow-up ${milestoneNum} marked attended by ${actorName} (${params.actor.role}) on ${new Date().toLocaleDateString("en-IN")}.`
        : "",
    });

    try {
      await admin
        .from("crm_followups")
        .update({
          status: params.completed ? "completed" : "pending",
          completed_by: params.completed ? params.actor.id : null,
          completed_by_role: params.completed ? params.actor.role : null,
          completed_at: params.completed ? nowIso : null,
        })
        .eq("profile_id", params.profileId)
        .eq("followup_type", followupType);
    } catch {
      // ignore if table not yet migrated
    }
  }

  // Notify Admin whenever Partner updates a milestone
  const bizName = profile.business_name || profile.owner_name || "Customer";
  if (params.actor.role === "partner" && params.completed) {
    await createStaffNotification(admin, {
      recipientRole: "admin",
      eventType: "partner_milestone_updated",
      severity: "info",
      title: `Partner Updated: ${bizName}`,
      message: `Partner (${actorName}) marked "${params.stepKey.replace(/_/g, " ")}" completed for ${bizName}.`,
      entityType: "profile",
      entityId: params.profileId,
      profileId: params.profileId,
    });
  }

  // Ensure Designer gets notified even if fulfillment_jobs wasn't present
  if (params.stepKey === "customer_responded_designing" && params.completed) {
    await createStaffNotification(admin, {
      recipientRole: "designer",
      eventType: "card_sent_to_designer",
      severity: "action_required",
      title: `Sent to Designer: ${bizName}`,
      message: `${bizName} (${profile.subscription_plan === "trial" ? "Free Trial" : "Pro"}) marked ready and sent to Designer by ${actorName}.`,
      entityType: "profile",
      entityId: params.profileId,
      profileId: params.profileId,
      dedupeKey: `sent_to_designer_${params.profileId}_${nowIso.slice(0, 13)}`,
    });
  }

  return { ok: true, cardProcess: updatedProcess };
}

/**
 * Scans for accounts expiring within 3 days and CRM follow-ups due today/tomorrow,
 * inserting deduplicated `staff_notifications` for Admin & Partner.
 */
export async function runScheduledAlertSweep(admin: SupabaseClient): Promise<{
  expiryAlertsCreated: number;
  followupAlertsCreated: number;
}> {
  let expiryAlertsCreated = 0;
  let followupAlertsCreated = 0;
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const threeDaysAhead = new Date(now.getTime() + 3 * 86_400_000);
  const tomorrowEnd = new Date(now.getTime() + 2 * 86_400_000);

  try {
    // 0. New organic customer signups in last 24 hours
    const { data: recentSignups } = await admin
      .from("profiles")
      .select("id, business_name, owner_name, email, role, is_admin, subscription_plan, created_at")
      .gte("created_at", oneDayAgo.toISOString());

    for (const s of recentSignups || []) {
      if (s.is_admin || s.role === "admin" || s.role === "designer") continue;
      const bizName = s.business_name || s.owner_name || s.email || "New Account";
      await createStaffNotification(admin, {
        recipientRole: "admin",
        eventType: "new_signup",
        severity: "info",
        title: `New Signup: ${bizName}`,
        message: `${bizName} created a ${s.subscription_plan === "pro" ? "Pro" : s.subscription_plan === "trial" ? "Free Trial" : "Free"} account.`,
        entityType: "profile",
        entityId: s.id,
        profileId: s.id,
        dedupeKey: `new_signup_admin_${s.id}`,
      });
    }
    // 1. Accounts expiring within 3 days
    const { data: expiringProfiles } = await admin
      .from("profiles")
      .select("id, business_name, owner_name, subscription_plan, membership_expires_at, referred_by")
      .in("subscription_plan", ["pro", "trial"])
      .gte("membership_expires_at", now.toISOString())
      .lte("membership_expires_at", threeDaysAhead.toISOString());

    for (const p of expiringProfiles || []) {
      const expDateStr = String(p.membership_expires_at).slice(0, 10);
      const daysLeft = Math.max(
        0,
        Math.ceil((new Date(p.membership_expires_at).getTime() - now.getTime()) / 86_400_000)
      );
      const bizName = p.business_name || p.owner_name || "Customer";
      const planLabel = p.subscription_plan === "trial" ? "Free Trial" : "Pro Plan";

      await createStaffNotification(admin, {
        recipientRole: "admin",
        eventType: "expiry_within_3_days",
        severity: "urgent",
        title: `Expiring in ${daysLeft}d: ${bizName}`,
        message: `${bizName}'s ${planLabel} expires on ${new Date(p.membership_expires_at).toLocaleDateString("en-IN")} (${daysLeft} day${daysLeft === 1 ? "" : "s"} left).`,
        entityType: "profile",
        entityId: p.id,
        profileId: p.id,
        dedupeKey: `expiry_3d_admin_${p.id}_${expDateStr}`,
      });
      expiryAlertsCreated++;

      if (p.referred_by) {
        await createStaffNotification(admin, {
          recipientRole: "partner",
          recipientUserId: p.referred_by,
          eventType: "expiry_within_3_days",
          severity: "urgent",
          title: `Referral Expiring in ${daysLeft}d: ${bizName}`,
          message: `Your referred customer ${bizName} (${planLabel}) expires on ${new Date(p.membership_expires_at).toLocaleDateString("en-IN")}. Follow up to renew.`,
          entityType: "profile",
          entityId: p.id,
          profileId: p.id,
          dedupeKey: `expiry_3d_partner_${p.id}_${expDateStr}`,
        });
      }
    }

    // 2. Follow-ups due today or tomorrow
    const { data: dueFollowups } = await admin
      .from("crm_followups")
      .select("id, profile_id, assigned_role, assigned_user_id, followup_type, due_at, notes")
      .eq("status", "pending")
      .lte("due_at", tomorrowEnd.toISOString());

    if (dueFollowups && dueFollowups.length > 0) {
      const profIds = Array.from(new Set(dueFollowups.map((f: any) => f.profile_id)));
      const { data: profs } = await admin
        .from("profiles")
        .select("id, business_name, owner_name")
        .in("id", profIds);
      const profMap = new Map((profs || []).map((p: any) => [p.id, p]));

      const todayStr = now.toISOString().slice(0, 10);
      const tomorrowStr = new Date(now.getTime() + 86_400_000).toISOString().slice(0, 10);

      for (const f of dueFollowups) {
        const p = profMap.get(f.profile_id);
        const bizName = p?.business_name || p?.owner_name || "Company";
        const dueDay = String(f.due_at).slice(0, 10);
        const whenLabel =
          dueDay === tomorrowStr ? "Tomorrow" : dueDay === todayStr ? "Today" : "Overdue";

        await createStaffNotification(admin, {
          recipientRole: "admin",
          eventType: "followup_due",
          severity: whenLabel === "Overdue" || whenLabel === "Today" ? "urgent" : "action_required",
          title: `Follow-up ${whenLabel}: ${bizName}`,
          message: `${f.notes || f.followup_type.replace(/_/g, " ")} scheduled for ${new Date(f.due_at).toLocaleDateString("en-IN")}.`,
          entityType: "followup",
          entityId: f.id,
          profileId: f.profile_id,
          dedupeKey: `followup_admin_${f.id}_${todayStr}`,
        });

        if (f.assigned_role === "partner" && f.assigned_user_id) {
          await createStaffNotification(admin, {
            recipientRole: "partner",
            recipientUserId: f.assigned_user_id,
            eventType: "followup_due",
            severity: whenLabel === "Overdue" || whenLabel === "Today" ? "urgent" : "action_required",
            title: `Follow-up ${whenLabel}: ${bizName}`,
            message: `${f.notes || f.followup_type.replace(/_/g, " ")} due ${whenLabel.toLowerCase()}.`,
            entityType: "followup",
            entityId: f.id,
            profileId: f.profile_id,
            dedupeKey: `followup_partner_${f.id}_${todayStr}`,
          });
        }
        followupAlertsCreated++;
      }
    }
  } catch (err) {
    console.warn("[Fulfillment] runScheduledAlertSweep warning:", err);
  }

  return { expiryAlertsCreated, followupAlertsCreated };
}
