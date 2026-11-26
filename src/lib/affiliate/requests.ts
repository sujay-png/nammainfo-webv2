export type AffiliateStatus = "none" | "pending" | "approved" | "rejected";
export type ApplicantType = "owner" | "employee";
export type AffiliateDecision = "approve" | "reject";

export interface AffiliateEligibilityInput {
  isAdmin?: boolean | null;
  role?: string | null;
  isPartner?: boolean | null;
  isCampaignManager?: boolean | null;
  affiliateStatus?: string | null;
}

export function normalizeAffiliateStatus(raw: string | null | undefined): AffiliateStatus {
  if (raw === "pending" || raw === "approved" || raw === "rejected") {
    return raw;
  }
  return "none";
}

export function isActivePartnerAccount(input: {
  is_partner?: boolean | null;
  is_campaign_manager?: boolean | null;
  role?: string | null;
}): boolean {
  return Boolean(
    input.is_partner ||
      input.is_campaign_manager ||
      input.role === "partner" ||
      input.role === "campaign_manager"
  );
}

/**
 * Determine whether a signed-in user can submit an affiliate request.
 */
export function canSubmitAffiliateRequest(input: AffiliateEligibilityInput): {
  ok: boolean;
  reason?: string;
} {
  if (input.isAdmin || input.role === "admin" || input.role === "designer") {
    return { ok: false, reason: "Staff accounts cannot apply as customer/employee affiliates." };
  }
  if (
    input.isPartner ||
    input.isCampaignManager ||
    input.role === "partner" ||
    input.role === "campaign_manager"
  ) {
    return { ok: false, reason: "This account is already an active Partner." };
  }
  const status = normalizeAffiliateStatus(input.affiliateStatus);
  if (status === "pending") {
    return { ok: false, reason: "Your Affiliate application is already under review." };
  }
  return { ok: true };
}

/**
 * Validate and build state transition for Admin Approve / Reject actions.
 */
export function resolveAffiliateDecisionTransition(
  currentStatus: string,
  decision: AffiliateDecision,
  rejectionReason?: string | null
): {
  ok: boolean;
  error?: string;
  nextStatus?: "approved" | "rejected";
  nextAffiliateStatus?: AffiliateStatus;
  cleanedReason?: string | null;
} {
  if (decision !== "approve" && decision !== "reject") {
    return { ok: false, error: "Invalid decision action. Expected approve or reject." };
  }
  if (currentStatus === "approved" && decision === "approve") {
    return { ok: false, error: "This affiliate request is already approved." };
  }
  if (currentStatus === "rejected" && decision === "reject") {
    return { ok: false, error: "This affiliate request is already rejected." };
  }
  if (decision === "approve") {
    return {
      ok: true,
      nextStatus: "approved",
      nextAffiliateStatus: "approved",
      cleanedReason: null,
    };
  }
  const trimmed = (rejectionReason ?? "").trim();
  return {
    ok: true,
    nextStatus: "rejected",
    nextAffiliateStatus: "rejected",
    cleanedReason: trimmed || null,
  };
}

/**
 * Build the referral token passed via `?ref=` on public card links.
 * - For employee profiles, use `emp_<employeeId>` when the employee is a Partner
 *   (or `emp_<employeeId>` fallback with company context when needed).
 */
export function buildEmployeeReferralRef(params: {
  employeeId: string;
  employeeIsPartner?: boolean;
  ownerHandle?: string | null;
}): string | null {
  if (params.employeeIsPartner && params.employeeId) {
    return `emp_${params.employeeId}`;
  }
  if (params.ownerHandle) {
    return params.ownerHandle;
  }
  return params.employeeId ? `emp_${params.employeeId}` : null;
}

/**
 * Build target URL for the 1-click Partner Console quick link.
 */
export function getPartnerQuickDestination(params: {
  hostname: string;
  tokenHash?: string | null;
}): string {
  const host = (params.hostname || "").toLowerCase();
  const isProdMainDomain =
    host === "nammainfo.in" ||
    host === "www.nammainfo.in";

  if (isProdMainDomain && params.tokenHash) {
    return `https://partner.nammainfo.in/auth/callback?token_hash=${encodeURIComponent(
      params.tokenHash
    )}&type=magiclink&next=/`;
  }

  return "/partner";
}
