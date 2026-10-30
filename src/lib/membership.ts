/**
 * One rule, used everywhere, for "is this account a paid member?".
 *
 * Paid = a paid/trial plan, OR the member flag, OR an expiry date on file.
 * Members who joined before plans existed have subscription_plan "free"
 * (the column default) but is_member = true and an expiry date, so the
 * plan name alone must never decide that someone is free.
 */
export type MembershipKind = "free" | "trial" | "pro" | "lifetime";

export interface MembershipInfo {
  kind: MembershipKind;
  /** On a paid or trial plan (even if it has since expired). */
  isPaid: boolean;
  /** Paid/trial and not expired, and not suspended: the public profile is live. */
  isActive: boolean;
  isFree: boolean;
  isTrial: boolean;
  isLifetime: boolean;
  isExpired: boolean;
  isSuspended: boolean;
  expiresAt: Date | null;
  /** Whole days left, or null when there is no end date. */
  daysLeft: number | null;
}

interface MembershipFields {
  subscription_plan?: string | null;
  is_member?: boolean | null;
  membership_expires_at?: string | null;
  status?: string | null;
}

const PAID_PLANS = new Set(["pro", "trial", "lifetime", "starter", "enterprise"]);
const DAY = 86_400_000;

export function getMembership(p: MembershipFields | null | undefined, now = Date.now()): MembershipInfo {
  const plan = (p?.subscription_plan ?? "free").toLowerCase();
  const expiresAt = p?.membership_expires_at ? new Date(p.membership_expires_at) : null;
  const validExpiry = expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : null;

  const isLifetime = plan === "lifetime" || (validExpiry ? validExpiry.getFullYear() >= 2090 : false);
  const isPaid = PAID_PLANS.has(plan) || p?.is_member === true || Boolean(validExpiry);
  const isTrial = plan === "trial";
  const isSuspended = p?.status === "suspended";
  const isExpired = isPaid && !isLifetime && validExpiry !== null && validExpiry.getTime() < now;

  const kind: MembershipKind = !isPaid ? "free" : isLifetime ? "lifetime" : isTrial ? "trial" : "pro";
  const daysLeft =
    validExpiry && !isLifetime ? Math.max(0, Math.ceil((validExpiry.getTime() - now) / DAY)) : null;

  return {
    kind,
    isPaid,
    isActive: isPaid && !isExpired && !isSuspended,
    isFree: !isPaid,
    isTrial,
    isLifetime,
    isExpired,
    isSuspended,
    expiresAt: validExpiry,
    daysLeft,
  };
}
