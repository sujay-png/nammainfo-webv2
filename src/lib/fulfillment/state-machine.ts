/**
 * Canonical Fulfillment State Machine, Role Permissions,
 * Partner Scope, and 100-Day Co-Termination Validity Helpers.
 *
 * Pure module (zero I/O) so it can be shared across server routes,
 * client components, and unit tests.
 */

export type StaffRole = "admin" | "designer" | "partner" | "customer" | "system";

export type FulfillmentStage =
  | "awaiting_customer"
  | "sent_to_designer"
  | "printed_ready"
  | "posted"
  | "delivered"
  | "cancelled";

export type FulfillmentJobType =
  | "pro_initial"
  | "free_trial"
  | "team_addon"
  | "primary_addon"
  | "reprint";

export type LegacyOrderStatus =
  | "under_review"
  | "on_work"
  | "card_designed"
  | "ready_to_dispatch"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export type CardProcessStepKey =
  | "greetings_sent"
  | "customer_responded_designing"
  | "card_printed_approved"
  | "card_posted"
  | "card_delivered"
  | "followup_1_done"
  | "followup_2_done"
  | "followup_3_done"
  | "pro_active";

export interface CardProcessEntry {
  completed?: boolean;
  updated_at?: string | null;
  updated_by_id?: string | null;
  updated_by_role?: StaffRole | string | null;
  updated_by_name?: string | null;
}

export type CardProcessMap = Record<string, CardProcessEntry>;

export const PARTNER_ALLOWED_MILESTONES: ReadonlySet<CardProcessStepKey> = new Set([
  "greetings_sent",
  "customer_responded_designing",
  "followup_1_done",
  "followup_2_done",
  "followup_3_done",
]);

export const DESIGNER_ALLOWED_MILESTONES: ReadonlySet<CardProcessStepKey> = new Set([
  "card_printed_approved",
  "card_posted",
  "card_delivered",
]);

export const DESIGNER_ALLOWED_TARGET_STAGES: ReadonlySet<FulfillmentStage> = new Set([
  "printed_ready",
  "posted",
  "delivered",
]);

export const FULFILLMENT_STAGE_ORDER: FulfillmentStage[] = [
  "awaiting_customer",
  "sent_to_designer",
  "printed_ready",
  "posted",
  "delivered",
];

export const FULFILLMENT_STAGE_META: Record<
  FulfillmentStage,
  { step: number; label: string; shortLabel: string; description: string }
> = {
  awaiting_customer: {
    step: 1,
    label: "Awaiting Customer / Review",
    shortLabel: "Under Review",
    description: "Order placed or trial activated. Gathering customer requirements.",
  },
  sent_to_designer: {
    step: 2,
    label: "Customer responded and card sent to designer",
    shortLabel: "In Production",
    description: "Customer requirements confirmed and forwarded to Designer Studio.",
  },
  printed_ready: {
    step: 3,
    label: "Card printed customer approved ready for dispatch",
    shortLabel: "Printed & Ready",
    description: "Physical NFC card printed and approved for courier dispatch.",
  },
  posted: {
    step: 4,
    label: "Card posted",
    shortLabel: "Posted",
    description: "Dispatched via courier (delivery within 5-7 working days).",
  },
  delivered: {
    step: 5,
    label: "Card delivered",
    shortLabel: "Delivered",
    description: "Physical card delivered to customer doorstep.",
  },
  cancelled: {
    step: 0,
    label: "Cancelled",
    shortLabel: "Cancelled",
    description: "Fulfillment job cancelled.",
  },
};

export function stageToLegacyOrderStatus(stage: FulfillmentStage): LegacyOrderStatus {
  switch (stage) {
    case "awaiting_customer":
      return "under_review";
    case "sent_to_designer":
      return "card_designed";
    case "printed_ready":
      return "ready_to_dispatch";
    case "posted":
      return "out_for_delivery";
    case "delivered":
      return "delivered";
    case "cancelled":
      return "cancelled";
  }
}

export function legacyOrderStatusToStage(status: string): FulfillmentStage {
  switch (status) {
    case "on_work":
    case "card_designed":
      return "sent_to_designer";
    case "ready_to_dispatch":
      return "printed_ready";
    case "out_for_delivery":
      return "posted";
    case "delivered":
      return "delivered";
    case "cancelled":
      return "cancelled";
    default:
      return "awaiting_customer";
  }
}

export function milestoneToStage(stepKey: CardProcessStepKey): FulfillmentStage | null {
  switch (stepKey) {
    case "customer_responded_designing":
      return "sent_to_designer";
    case "card_printed_approved":
      return "printed_ready";
    case "card_posted":
      return "posted";
    case "card_delivered":
      return "delivered";
    default:
      return null;
  }
}

export function stageToMilestoneKey(stage: FulfillmentStage): CardProcessStepKey | null {
  switch (stage) {
    case "sent_to_designer":
      return "customer_responded_designing";
    case "printed_ready":
      return "card_printed_approved";
    case "posted":
      return "card_posted";
    case "delivered":
      return "card_delivered";
    default:
      return null;
  }
}

/**
 * Checks whether a given actor role is allowed to toggle a company milestone step.
 */
export function canRoleToggleMilestone(role: StaffRole, stepKey: CardProcessStepKey): boolean {
  if (role === "admin" || role === "system") return true;
  if (role === "partner") return PARTNER_ALLOWED_MILESTONES.has(stepKey);
  if (role === "designer") return DESIGNER_ALLOWED_MILESTONES.has(stepKey);
  if (role === "customer") return stepKey === "card_delivered";
  return false;
}

/**
 * Checks whether a given actor role is allowed to transition a fulfillment job
 * from `fromStage` to `toStage`.
 */
export function canRoleTransitionStage(
  role: StaffRole,
  fromStage: FulfillmentStage,
  toStage: FulfillmentStage
): { allowed: boolean; reason?: string } {
  if (role === "admin" || role === "system") {
    return { allowed: true };
  }

  if (role === "designer") {
    if (fromStage === "awaiting_customer" || fromStage === "cancelled") {
      return {
        allowed: false,
        reason: "Job must be sent to designer by Admin before Designer can update fulfillment.",
      };
    }
    if (!DESIGNER_ALLOWED_TARGET_STAGES.has(toStage)) {
      return {
        allowed: false,
        reason: "Designers can only mark Card Printed, Card Posted, or Card Delivered.",
      };
    }
    return { allowed: true };
  }

  if (role === "partner") {
    if (toStage === "sent_to_designer" && fromStage === "awaiting_customer") {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: "Partners can only mark customer-side onboarding and follow-up milestones.",
    };
  }

  if (role === "customer") {
    if (toStage === "delivered" && (fromStage === "posted" || fromStage === "printed_ready")) {
      return { allowed: true };
    }
    return { allowed: false, reason: "Customers can only confirm delivery." };
  }

  return { allowed: false, reason: "Unauthorized role." };
}

/**
 * Updates a card_process JSONB map with role/actor attribution and cascades
 * stage completion cleanly when marking forward steps.
 */
export function applyMilestoneWithAttribution(
  existing: CardProcessMap | null | undefined,
  stepKey: CardProcessStepKey,
  completed: boolean,
  actor: { id?: string | null; role: StaffRole; name?: string | null },
  timestamp: string = new Date().toISOString()
): CardProcessMap {
  const next: CardProcessMap = { ...(existing || {}) };
  next[stepKey] = {
    completed,
    updated_at: completed ? timestamp : null,
    updated_by_id: actor.id || null,
    updated_by_role: actor.role,
    updated_by_name: actor.name || null,
  };
  return next;
}

/**
 * Dynamic 100-Day Co-Termination Validity Calculation.
 * Team & branch cards inherit the organization's `membership_expires_at`.
 * If <= 100 days remain (and > 0), returns `shouldWarn: true` with exact dynamic days left.
 */
export function getCoTerminationWarning(
  membershipExpiresAt: string | null | undefined,
  subscriptionPlan: string | null | undefined,
  nowMs: number = Date.now()
): {
  shouldWarn: boolean;
  isExpired: boolean;
  daysRemaining: number | null;
  expiresAtIso: string | null;
} {
  if (!membershipExpiresAt || subscriptionPlan === "free" || subscriptionPlan === "lifetime") {
    return {
      shouldWarn: false,
      isExpired: false,
      daysRemaining: null,
      expiresAtIso: membershipExpiresAt || null,
    };
  }

  const expiryMs = new Date(membershipExpiresAt).getTime();
  if (Number.isNaN(expiryMs)) {
    return { shouldWarn: false, isExpired: false, daysRemaining: null, expiresAtIso: null };
  }

  const diffMs = expiryMs - nowMs;
  const daysRemaining = Math.max(0, Math.ceil(diffMs / 86_400_000));
  const isExpired = diffMs <= 0;
  const shouldWarn = !isExpired && daysRemaining <= 100;

  return {
    shouldWarn,
    isExpired,
    daysRemaining,
    expiresAtIso: membershipExpiresAt,
  };
}
