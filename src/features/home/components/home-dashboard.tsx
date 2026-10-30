"use client";

import EmployeeGate from "@/components/auth/owner-or-employee-gate";
import EmployeeHome from "@/features/employee-dashboard/components/employee-home";

import { useEffect, useState } from "react";
import {
  CreditCard,
  Star,
  Users,
  TrendingUp,
  ChevronRight,
  User,
  BarChart3,
  UserPlus,
  CalendarClock,
  ArrowRight,
  Edit3,
  Scan,
  Settings,
  Clock,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/supabase/client";
import { getCurrentUser } from "@/supabase/current-user";
import { formatDistanceToNow, initials } from "@/lib/utils";
import type { Profile, Card, Review, Employee, Connection } from "@/supabase/database-types";
import UpgradeToProModal from "@/components/UpgradeToProModal";
import ApplyFreeTrialModal from "@/components/ApplyFreeTrialModal";

interface EnrichedConnection extends Connection {
  connected_profile?: {
    id: string;
    owner_name: string | null;
    business_name: string | null;
    job_title: string | null;
    avatar_url: string | null;
    logo_url: string | null;
    username: string | null;
    slug: string | null;
  } | null;
}

function ConnectionAvatar({
  name,
  photo,
}: {
  name: string;
  photo?: string | null;
}) {
  const [imgError, setImgError] = useState(false);

  if (photo && !imgError) {
    return (
      <img
        src={photo}
        alt={name}
        onError={() => setImgError(true)}
        className="h-8 w-8 rounded-full object-cover shrink-0 border border-[var(--border)]"
      />
    );
  }

  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--card)] border border-[var(--border)] text-[10px] font-semibold text-[var(--foreground)]">
      {initials(name)}
    </div>
  );
}
import RenewalModal from "@/components/RenewalModal";
import { calculateRenewalCost } from "@/lib/pricing";
import { calculateProfileCompletion } from "@/lib/profile-completion";

/* ------------------------------------------------------------------ */
/*  Stat card                                                          */
/* ------------------------------------------------------------------ */

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="mb-2 flex items-center gap-2 text-[var(--muted-foreground)]">
        <Icon size={16} strokeWidth={1.6} />
        <span className="font-mono text-[11px] uppercase tracking-wider">{label}</span>
      </div>
      <p className="font-headline text-2xl font-semibold text-[var(--foreground)]">
        {value}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Card validity (1 year from joining) + day countdown                */
/* ------------------------------------------------------------------ */

const VALIDITY_DAYS = 365;
const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function ValidityCard({
  profile,
  employeesCount,
  completionPct,
  onOpenUpgrade,
  onOpenRenewal,
  onOpenTrial,
}: {
  profile: Profile;
  employeesCount: number;
  completionPct: number;
  onOpenUpgrade: () => void;
  onOpenRenewal: () => void;
  onOpenTrial: () => void;
}) {
  const joined = startOfDay(new Date(profile.created_at));

  const isTrial = profile.subscription_plan === "trial";

  const isFree =
    !isTrial &&
    (profile.subscription_plan === "free" ||
      (!profile.is_member && !profile.membership_expires_at));

  const isLifetime =
    !isTrial &&
    (profile.subscription_plan === "lifetime" ||
      (profile.membership_expires_at
        ? new Date(profile.membership_expires_at).getFullYear() >= 2090
        : false));

  if (isFree) {
    const isProfileComplete = completionPct === 100;
    const isPendingApproval = profile.trial_status === "pending_approval";

    return (
      <div className="rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-4 sm:p-5 space-y-4 shadow-sm">
        {/* Top Header: Identity on left, Free Tier right-aligned */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[5px] bg-[var(--accent)] border border-[var(--border)] text-[var(--foreground)]">
              <CreditCard size={18} strokeWidth={1.7} />
            </div>
            <div>
              <span className="font-medium text-sm text-[var(--foreground)] block">
                Account Status
              </span>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                Member since {fmtDate(joined)}
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)] block">
              Free Tier
            </span>
            {isProfileComplete && (
              <span className="font-mono text-[10px] text-[var(--muted-foreground)] block mt-0.5">
                Profile 100% • Ready for Pro
              </span>
            )}
          </div>
        </div>

        {/* Pending Approval Notice */}
        {isPendingApproval && (
          <div className="flex items-center gap-2.5 p-3 rounded-[5px] bg-[var(--accent)]/40 border border-[var(--border)] text-[var(--foreground)] text-xs">
            <Clock size={15} className="text-[var(--muted-foreground)] shrink-0" />
            <span className="leading-snug">
              Your 100-Day Free Trial application is under review. Our team will verify and activate your trial shortly.
            </span>
          </div>
        )}

        {/* Dual Actions: Upgrade to Pro & Apply / Waiting for Approval */}
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={onOpenUpgrade}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-[5px] bg-[var(--primary)] text-[var(--primary-foreground)] text-xs font-semibold shadow-xs hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer"
          >
            <span>{isProfileComplete ? "Order Custom NFC Card & Upgrade" : "Upgrade to Pro"}</span>
            <ArrowRight size={14} />
          </button>

          {isPendingApproval ? (
            <button
              disabled
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-[5px] border border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] text-xs font-semibold cursor-not-allowed opacity-75"
            >
              <Clock size={14} className="text-[var(--muted-foreground)]" />
              <span>Waiting for Approval</span>
            </button>
          ) : (
            <button
              onClick={onOpenTrial}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-[5px] border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--accent)] text-[var(--foreground)] text-xs font-semibold shadow-xs hover:border-[var(--foreground)]/40 active:scale-[0.98] transition-all cursor-pointer"
            >
              <Clock size={14} className="text-[var(--muted-foreground)]" />
              <span>Apply for Free Trial</span>
            </button>
          )}
        </div>

        {/* Structured specs row - no wrapping glitches, crisp scannability */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-[var(--border)]">
          <div className="p-2.5 rounded-[5px] bg-[var(--accent)]/40 border border-[var(--border)]">
            <span className="block font-mono text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
              Subscription
            </span>
            <span className="block font-mono text-xs font-semibold text-[var(--foreground)] mt-0.5">
              Free (Digital)
            </span>
          </div>

          <div className="p-2.5 rounded-[5px] bg-[var(--accent)]/40 border border-[var(--border)]">
            <span className="block font-mono text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
              Validity
            </span>
            <span className="block font-mono text-xs font-semibold text-[var(--foreground)] mt-0.5">
              N/A
            </span>
          </div>

          <div className="col-span-2 sm:col-span-1 p-2.5 rounded-[5px] bg-[var(--accent)]/40 border border-[var(--border)]">
            <span className="block font-mono text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
              Physical Card
            </span>
            <span className="block font-mono text-xs font-semibold text-[var(--muted-foreground)] mt-0.5">
              Unclaimed
            </span>
          </div>
        </div>

        {/* Pro features callout */}
        <div className="p-3 rounded-[5px] bg-[var(--accent)]/30 border border-[var(--border)] text-xs text-[var(--muted-foreground)] leading-relaxed">
          {isProfileComplete ? (
            <>
              Your profile is 100% complete and ready for Pro. Upgrade to unlock your custom public URL (<code className="font-mono text-[11px] text-[var(--foreground)]">namma.info/{profile.username || "your-name"}</code>) and receive your personalized physical NFC smart business card with express doorstep delivery.
            </>
          ) : (
            <>
              Upgrade to unlock your custom public URL (<code className="font-mono text-[11px] text-[var(--foreground)]">namma.info/{profile.username || "your-name"}</code>) and receive your personalized physical NFC smart business card with express doorstep delivery.
            </>
          )}
        </div>
      </div>
    );
  }

  if (isLifetime) {
    const totalCards = 1 + employeesCount;
    return (
      <div className="rounded-[5px] border border-purple-500/30 bg-purple-500/5 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[5px] bg-purple-500/10 text-purple-600">
              <CalendarClock size={20} strokeWidth={1.6} />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--foreground)]">
                Member since {fmtDate(joined)}
              </p>
              <p className="font-mono text-[11px] text-purple-600 dark:text-purple-400 font-semibold">
                Lifetime Organization Access (Permanent)
              </p>
              <p className="font-mono text-[10px] text-[var(--muted-foreground)] mt-0.5">
                {totalCards} Total Cards (1 Primary + {employeesCount} Team)
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const expires = profile.membership_expires_at
    ? startOfDay(new Date(profile.membership_expires_at))
    : new Date(joined.getTime() + VALIDITY_DAYS * DAY_MS);

  const today = startOfDay(new Date());
  const daysLeft = Math.max(0, Math.round((expires.getTime() - today.getTime()) / DAY_MS));
  const totalDays = Math.max(1, Math.round((expires.getTime() - joined.getTime()) / DAY_MS));
  const pctLeft = Math.min(100, Math.max(0, (daysLeft / totalDays) * 100));
  const expired = daysLeft === 0;
  const endingSoon = !expired && daysLeft <= 15;

  const primaryCards = Number(profile.primary_card_count ?? 1);
  const totalCards = primaryCards + employeesCount;
  const renewalCost = calculateRenewalCost(primaryCards, employeesCount);

  const tone = expired
    ? "border-rose-500/30 bg-rose-500/5"
    : endingSoon
      ? "border-amber-500/30 bg-amber-500/5"
      : "border-[var(--border)] bg-[var(--card)]";
  const barColor = expired ? "bg-rose-500" : endingSoon ? "bg-amber-500" : "bg-[var(--foreground)]";

  return (
    <div className={`rounded-[5px] border p-4 space-y-3.5 ${tone}`}>
      {/* Top Header Row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[5px] bg-[var(--accent)] text-[var(--foreground)]">
            <CalendarClock size={19} strokeWidth={1.75} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-[var(--foreground)]">
                {isTrial ? "100-Day Free Trial" : "Pro Membership"}
              </span>
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded-[4px] font-mono text-[10px] font-medium border ${
                  expired
                    ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                    : isTrial
                      ? "bg-[var(--accent)] text-[var(--foreground)] border-[var(--border)] font-semibold"
                      : endingSoon
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                        : "bg-[var(--accent)] text-[var(--muted-foreground)] border-[var(--border)]"
                }`}
              >
                {expired ? "Expired" : isTrial ? "Free Trial" : endingSoon ? "Expiring Soon" : "Active"}
              </span>
            </div>
            <p className="mt-0.5 font-mono text-[11px] text-[var(--muted-foreground)]">
              {isTrial && profile.trial_approved_at
                ? `Started on ${fmtDate(new Date(profile.trial_approved_at))}`
                : `Member since ${fmtDate(joined)}`}
            </p>
          </div>
        </div>

        {/* Days Left Metric */}
        <div className="text-right shrink-0">
          <p
            className={`font-headline text-2xl font-bold leading-none ${
              expired
                ? "text-rose-600 dark:text-rose-400"
                : endingSoon || isTrial
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-[var(--foreground)]"
            }`}
          >
            {daysLeft}
          </p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
            {daysLeft === 1 ? "day left" : "days left"}
          </p>
        </div>
      </div>

      {/* Sleek Progress Bar */}
      <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--muted)]">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pctLeft}%` }}
        />
      </div>

      {/* Trial Extension Banner */}
      {isTrial && Number(profile.trial_extension_days ?? 0) > 0 && (
        <div className="p-3 rounded-[5px] bg-[var(--accent)] border border-[var(--border)] text-xs text-[var(--foreground)] space-y-1">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 size={15} className="text-[var(--foreground)] shrink-0" />
            <span>
              Your free trial plan has been extended for {profile.trial_extension_days}{" "}
              {profile.trial_extension_days === 1 ? "day" : "days"}!
            </span>
          </div>
          <p className="text-[11px] text-[var(--muted-foreground)] pl-5">
            Let us know how&apos;s your experience and ready to upgrade to Pro?
          </p>
        </div>
      )}

      {/* Structured Specs Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
        <div className="p-2.5 rounded-[5px] bg-[var(--accent)]/40 border border-[var(--border)]">
          <span className="block font-mono text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
            Valid Till
          </span>
          <span className="block font-mono text-xs font-semibold text-[var(--foreground)] mt-0.5">
            {fmtDate(expires)}
          </span>
        </div>

        <div className="p-2.5 rounded-[5px] bg-[var(--accent)]/40 border border-[var(--border)]">
          <span className="block font-mono text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
            {isTrial ? "Trial Card" : "Issued Cards"}
          </span>
          <span className="block font-mono text-xs font-semibold text-[var(--foreground)] mt-0.5">
            {isTrial
              ? "1 Active Primary"
              : `${totalCards} Total (${primaryCards} Primary${employeesCount > 0 ? ` + ${employeesCount} Team` : ""})`}
          </span>
        </div>

        <div className="col-span-2 sm:col-span-1 p-2.5 rounded-[5px] bg-[var(--accent)]/40 border border-[var(--border)]">
          <span className="block font-mono text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
            {isTrial ? "Plan Type" : "Annual Renewal"}
          </span>
          <span className="block font-mono text-xs font-semibold text-[var(--foreground)] mt-0.5">
            {isTrial ? "100-Day Free Trial" : `₹${renewalCost.totalAmount.toLocaleString("en-IN")}/yr`}
          </span>
        </div>
      </div>

      {/* Trial Action: Upgrade to Pro */}
      {isTrial ? (
        <div className="pt-2 border-t border-[var(--border)]">
          <button
            onClick={onOpenUpgrade}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-[5px] bg-[var(--primary)] text-[var(--primary-foreground)] text-xs font-semibold shadow-sm hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer"
          >
            <span>Upgrade to Pro Plan</span>
            <ArrowRight size={14} />
          </button>
        </div>
      ) : (
        /* Standard Pro Action only visible when Expired or Ending Soon */
        (expired || endingSoon) && (
          <div className="pt-2 border-t border-[var(--border)] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--muted-foreground)]">
                {expired
                  ? "Plan expired. Renew to maintain vanity URL & NFC cards."
                  : "Renew now to avoid service interruption."}
              </span>
              <span className="font-mono font-bold text-[var(--foreground)]">
                ₹{renewalCost.totalAmount.toLocaleString("en-IN")}
              </span>
            </div>

            <button
              onClick={onOpenRenewal}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-[5px] bg-[var(--primary)] text-[var(--primary-foreground)] text-xs font-semibold shadow-sm hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer"
            >
              <CreditCard size={14} />
              <span>Renew Plan ({totalCards} {totalCards === 1 ? "Card" : "Cards"})</span>
            </button>
          </div>
        )
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

function OwnerHomePage() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [card, setCard] = useState<Card | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [connections, setConnections] = useState<EnrichedConnection[]>([]);
  const [tapCount, setTapCount] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showRenewalModal, setShowRenewalModal] = useState(false);
  const [showTrialModal, setShowTrialModal] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const user = await getCurrentUser();
      if (!user) return;

      // Fetch all data in parallel
      const [profileRes, cardRes, reviewRes, employeeRes, connectionRes, reviewCountRes] =
        await Promise.all([
          supabase.from("profiles").select("*").eq("id", user.id).single(),
          supabase
            .from("cards")
            .select("*")
            .eq("profile_id", user.id)
            .eq("is_active", true)
            .maybeSingle(),
          supabase
            .from("reviews")
            .select("*")
            .eq("profile_id", user.id)
            .order("created_at", { ascending: false })
            .limit(5),
          supabase
            .from("employees")
            .select("*")
            .eq("owner_id", user.id)
            .eq("is_active", true)
            .order("created_at"),
          supabase
            .from("connections")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }),
          // Total review count — fetched in parallel instead of after the rest.
          supabase
            .from("reviews")
            .select("id", { count: "exact", head: true })
            .eq("profile_id", user.id),
        ]);

      if (profileRes.data) setProfile(profileRes.data as unknown as Profile);
      if (cardRes.data) {
        const c = cardRes.data as unknown as Card;
        setCard(c);
        setTapCount(c.tap_count || 0);
      }
      if (reviewRes.data) setReviews(reviewRes.data as unknown as Review[]);
      setReviewCount(reviewCountRes.count || 0);
      if (employeeRes.data) setEmployees(employeeRes.data as unknown as Employee[]);

      if (connectionRes.data) {
        const rawConns = connectionRes.data as Connection[];
        const targetIds = Array.from(
          new Set(rawConns.map((c) => c.connected_user_id).filter(Boolean))
        );
        let enrichedConns: EnrichedConnection[] = rawConns;
        if (targetIds.length > 0) {
          const { data: profs } = await supabase
            .from("profiles")
            .select("id, owner_name, business_name, job_title, avatar_url, logo_url, username, slug")
            .in("id", targetIds);

          const profMap = new Map((profs || []).map((p) => [p.id, p]));
          enrichedConns = rawConns.map((c) => ({
            ...c,
            connected_profile: profMap.get(c.connected_user_id) || null,
          }));
        }
        setConnections(enrichedConns);
      }

      setLoading(false);
    })();
  }, []);

  /* Loading skeleton */
  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-5 py-6">
        <div className="mb-6 h-8 w-48 skeleton rounded-[5px]" />
        <div className="grid grid-cols-2 gap-3 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 skeleton rounded-[5px]" />
          ))}
        </div>
        <div className="h-32 skeleton rounded-[5px] mb-4" />
        <div className="h-48 skeleton rounded-[5px]" />
      </div>
    );
  }

  if (!profile) return null;

  /* Derived data */
  const completionData = calculateProfileCompletion(profile);
  const completionItems = completionData.items;
  const completedCount = completionData.completedCount;
  const completionPct = completionData.percentage;
  const pendingItems = completionData.missingItems;

  const isFree =
    profile.subscription_plan === "free" ||
    (!profile.is_member && !profile.membership_expires_at);

  const avgRating =
    reviews.length > 0
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : "—";

  return (
    <div className="mx-auto max-w-lg px-5 py-6 space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="font-headline text-xl font-semibold text-[var(--foreground)]">
          {getGreeting()},{" "}
          {profile.owner_name?.split(" ")[0] || "there"}
        </h1>
        <p className="mt-0.5 font-mono text-xs text-[var(--muted-foreground)]">
          Here&apos;s what&apos;s happening with your business
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={CreditCard} label="Card Taps" value={tapCount} />
        <StatCard icon={Star} label="Reviews" value={reviewCount} />
        <StatCard icon={Users} label="Team" value={employees.length} />
        <StatCard icon={UserPlus} label="Connections" value={connections.length} />
      </div>

      {/* Card validity & Account Status */}
      <ValidityCard
        profile={profile}
        employeesCount={employees.length}
        completionPct={completionPct}
        onOpenUpgrade={() => setShowUpgradeModal(true)}
        onOpenRenewal={() => setShowRenewalModal(true)}
        onOpenTrial={() => setShowTrialModal(true)}
      />

      {/* Profile completion */}
      {completionPct < 100 && (
        <div className="rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User size={16} className="text-[var(--primary)]" strokeWidth={1.8} />
              <span className="text-sm font-medium text-[var(--foreground)]">
                Profile Completion
              </span>
            </div>
            <span className="font-mono text-xs font-semibold text-[var(--primary)]">
              {completionPct}%
            </span>
          </div>

          {/* Progress bar */}
          <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-[var(--muted)]">
            <div
              className="h-full rounded-full bg-[var(--primary)] transition-all duration-500"
              style={{ width: `${completionPct}%` }}
            />
          </div>

          {/* Pending items (show up to 3) */}
          <div className="space-y-2">
            {pendingItems.slice(0, 3).map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="flex items-center justify-between rounded-[5px] bg-[var(--muted)] px-3 py-2.5 transition-colors hover:bg-[var(--accent)]"
              >
                <span className="text-xs text-[var(--foreground)]">{item.label}</span>
                <ChevronRight size={14} className="text-[var(--muted-foreground)]" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
        <Link
          href="/dashboard/profile"
          className="flex flex-col items-center gap-2 rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-3.5 sm:p-4 transition-colors hover:bg-[var(--accent)]"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-[5px] bg-[var(--muted)]">
            <Edit3 size={18} className="text-[var(--foreground)]" strokeWidth={1.8} />
          </div>
          <span className="font-mono text-[10px] text-[var(--muted-foreground)]">
            Edit Profile
          </span>
        </Link>
        <Link
          href="/dashboard/scanner"
          className="flex flex-col items-center gap-2 rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-3.5 sm:p-4 transition-colors hover:bg-[var(--accent)]"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-[5px] bg-[var(--muted)]">
            <Scan size={18} className="text-[var(--foreground)]" strokeWidth={1.8} />
          </div>
          <span className="font-mono text-[10px] text-[var(--muted-foreground)]">
            Scan Card
          </span>
        </Link>
        <Link
          href="/dashboard/settings"
          className="flex flex-col items-center gap-2 rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-3.5 sm:p-4 transition-colors hover:bg-[var(--accent)]"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-[5px] bg-[var(--muted)]">
            <Settings size={18} className="text-[var(--foreground)]" strokeWidth={1.8} />
          </div>
          <span className="font-mono text-[10px] text-[var(--muted-foreground)]">
            Settings
          </span>
        </Link>
      </div>

      {/* Recent reviews */}
      {reviews.length > 0 && (
        <div className="rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Star size={16} className="text-[var(--primary)]" strokeWidth={1.6} />
              <span className="text-sm font-medium text-[var(--foreground)]">
                Recent Reviews
              </span>
            </div>
            <span className="font-mono text-xs text-[var(--muted-foreground)]">
              Avg {avgRating} ★
            </span>
          </div>

          <div className="space-y-3">
            {reviews.slice(0, 3).map((review) => (
              <div
                key={review.id}
                className="rounded-[5px] bg-[var(--muted)] px-3 py-3"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-[var(--foreground)]">
                    {review.reviewer_name}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-[11px] text-amber-500">
                      {"★".repeat(review.rating)}
                    </span>
                    <span className="font-mono text-[11px] text-[var(--muted-foreground)]">
                      {"★".repeat(5 - review.rating)}
                    </span>
                  </div>
                </div>
                {review.comment && (
                  <p className="text-xs text-[var(--muted-foreground)] line-clamp-2">
                    {review.comment}
                  </p>
                )}
                <p className="mt-1 font-mono text-[10px] text-[var(--muted-foreground)]">
                  {formatDistanceToNow(review.created_at)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Team overview */}
      {employees.length > 0 && (
        <div className="rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-[var(--primary)]" strokeWidth={1.6} />
              <span className="text-sm font-medium text-[var(--foreground)]">
                Your Team
              </span>
            </div>
            <span className="font-mono text-xs text-[var(--muted-foreground)]">
              {employees.length} member{employees.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="space-y-2">
            {employees.slice(0, 4).map((emp) => (
              <div
                key={emp.id}
                className="flex items-center gap-3 rounded-[5px] bg-[var(--muted)] px-3 py-2.5"
              >
                {emp.avatar_url ? (
                  <img
                    src={emp.avatar_url}
                    alt={emp.name}
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)] font-mono text-[10px] font-semibold text-[var(--foreground)]">
                    {initials(emp.name)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[var(--foreground)] truncate">
                    {emp.name}
                  </p>
                  <p className="font-mono text-[10px] text-[var(--muted-foreground)] truncate">
                    {emp.designation}
                  </p>
                </div>
              </div>
            ))}
            {employees.length > 4 && (
              <p className="text-center font-mono text-[10px] text-[var(--muted-foreground)] pt-1">
                +{employees.length - 4} more
              </p>
            )}
          </div>
        </div>
      )}

      {/* Activity timeline */}
      {connections.length > 0 && (
        <div className="rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-[var(--primary)]" strokeWidth={1.8} />
              <span className="text-sm font-medium text-[var(--foreground)]">
                Recent Connections
              </span>
            </div>
            {connections.length > 5 && (
              <Link
                href="/dashboard/saved"
                className="font-mono text-[11px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
              >
                View all ({connections.length})
              </Link>
            )}
          </div>
          <div className="space-y-2">
            {connections.slice(0, 5).map((conn) => {
              const prof = conn.connected_profile;
              const name = prof?.owner_name || prof?.business_name || "New Connection";
              const subtitle =
                prof?.owner_name && prof?.business_name
                  ? prof.business_name
                  : prof?.job_title || null;
              const photo = prof?.avatar_url || prof?.logo_url;
              const targetUrl = prof?.username
                ? `/${prof.username}`
                : prof?.slug
                  ? `/${prof.slug}`
                  : `/dashboard/saved`;

              return (
                <Link
                  key={conn.id}
                  href={targetUrl}
                  className="flex items-center justify-between rounded-[5px] bg-[var(--muted)] px-3 py-2.5 transition-colors hover:bg-[var(--accent)] group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <ConnectionAvatar name={name} photo={photo} />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-[var(--foreground)] group-hover:text-[var(--primary)] transition-colors">
                        {name}
                      </p>
                      {subtitle && (
                        <p className="truncate text-[10px] text-[var(--muted-foreground)]">
                          {subtitle}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="font-mono text-[10px] text-[var(--muted-foreground)] shrink-0 ml-3">
                    {formatDistanceToNow(conn.created_at)}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Business stats */}
      {(profile.years_in_business || profile.clients_served || profile.coverage_area) && (
        <div className="rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="mb-3 flex items-center gap-2">
            <BarChart3 size={16} className="text-[var(--primary)]" strokeWidth={1.6} />
            <span className="text-sm font-medium text-[var(--foreground)]">
              Business Stats
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {profile.years_in_business && (
              <div className="text-center">
                <p className="font-headline text-lg font-semibold text-[var(--foreground)]">
                  {profile.years_in_business}
                </p>
                <p className="font-mono text-[10px] text-[var(--muted-foreground)]">
                  Years
                </p>
              </div>
            )}
            {profile.clients_served && (
              <div className="text-center">
                <p className="font-headline text-lg font-semibold text-[var(--foreground)]">
                  {profile.clients_served}+
                </p>
                <p className="font-mono text-[10px] text-[var(--muted-foreground)]">
                  Clients
                </p>
              </div>
            )}
            {profile.coverage_area && (
              <div className="text-center">
                <p className="text-sm font-medium text-[var(--foreground)] truncate">
                  {profile.coverage_area}
                </p>
                <p className="font-mono text-[10px] text-[var(--muted-foreground)]">
                  Area
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upgrade to Pro & Order NFC Card Modal */}
      <UpgradeToProModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        profile={profile}
      />

      {/* 100-Day Free Trial Application Modal */}
      <ApplyFreeTrialModal
        isOpen={showTrialModal}
        onClose={() => setShowTrialModal(false)}
        profile={profile}
        completionPct={completionPct}
        onSuccess={() => {
          setShowTrialModal(false);
          window.location.reload();
        }}
      />

      {/* Annual Organization Renewal Modal */}
      {profile && (
        <RenewalModal
          isOpen={showRenewalModal}
          onClose={() => setShowRenewalModal(false)}
          profile={profile}
          employeesCount={employees.length}
          onSuccess={() => {
            setShowRenewalModal(false);
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Greeting helper                                                    */
/* ------------------------------------------------------------------ */

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function HomePage() {
  return <EmployeeGate owner={<OwnerHomePage />} employee={<EmployeeHome />} />;
}
