"use client";

import { useEffect, useState } from "react";
import {
  CreditCard,
  Star,
  Users,
  Eye,
  TrendingUp,
  CheckCircle2,
  ChevronRight,
  Activity,
  Zap,
  BarChart3,
  UserPlus,
  CalendarClock,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatDistanceToNow, initials } from "@/lib/utils";
import type { Profile, Card, Review, Employee, Connection } from "@/lib/supabase/types";

/* ------------------------------------------------------------------ */
/*  Profile-completion helpers                                         */
/* ------------------------------------------------------------------ */

interface CompletionItem {
  label: string;
  done: boolean;
  href: string;
}

function getCompletionItems(profile: Profile, card: Card | null): CompletionItem[] {
  return [
    { label: "Add business name", done: !!profile.business_name, href: "/dashboard/profile" },
    { label: "Upload logo", done: !!profile.logo_url, href: "/dashboard/profile" },
    { label: "Upload cover photo", done: !!profile.cover_url, href: "/dashboard/profile" },
    { label: "Write a bio", done: !!profile.bio, href: "/dashboard/profile" },
    { label: "Add phone number", done: !!profile.phone, href: "/dashboard/profile" },
    { label: "Add email", done: !!profile.email, href: "/dashboard/profile" },
    { label: "Set username", done: !!profile.username, href: "/dashboard/profile" },
    { label: "Add services", done: profile.services?.length > 0, href: "/dashboard/profile" },
    { label: "Add social links", done: profile.social_links?.length > 0, href: "/dashboard/profile" },
    { label: "Activate a card", done: !!card?.is_active, href: "/dashboard/scanner" },
  ];
}

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
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
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

function ValidityCard({ profile }: { profile: Profile }) {
  const joined = startOfDay(new Date(profile.created_at));
  // A renewal sets membership_expires_at; otherwise the card is valid for
  // 365 days from the day they joined.
  const expires = profile.membership_expires_at
    ? startOfDay(new Date(profile.membership_expires_at))
    : new Date(joined.getTime() + VALIDITY_DAYS * DAY_MS);

  const today = startOfDay(new Date());
  const daysLeft = Math.max(0, Math.round((expires.getTime() - today.getTime()) / DAY_MS));
  const totalDays = Math.max(1, Math.round((expires.getTime() - joined.getTime()) / DAY_MS));
  const pctLeft = Math.min(100, Math.max(0, (daysLeft / totalDays) * 100));
  const expired = daysLeft === 0;
  const endingSoon = !expired && daysLeft <= 30;

  const tone = expired
    ? "border-red-500/30 bg-red-500/5"
    : endingSoon
      ? "border-amber-500/30 bg-amber-500/5"
      : "border-[var(--border)] bg-[var(--card)]";
  const barColor = expired ? "bg-red-500" : endingSoon ? "bg-amber-500" : "bg-[var(--primary)]";

  return (
    <div className={`rounded-2xl border p-4 ${tone}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--muted)] text-[var(--foreground)]">
            <CalendarClock size={20} strokeWidth={1.6} />
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--foreground)]">
              Member since {fmtDate(joined)}
            </p>
            <p className="font-mono text-[11px] text-[var(--muted-foreground)]">
              {expired ? `Expired on ${fmtDate(expires)}` : `Valid till ${fmtDate(expires)}`}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p
            className={`font-headline text-2xl font-semibold leading-none ${
              expired ? "text-red-500" : endingSoon ? "text-amber-600 dark:text-amber-400" : "text-[var(--foreground)]"
            }`}
          >
            {daysLeft}
          </p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
            {daysLeft === 1 ? "day left" : "days left"}
          </p>
        </div>
      </div>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--muted)]">
        <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pctLeft}%` }} />
      </div>

      {(expired || endingSoon) && (
        <Link
          href="/dashboard/settings"
          className="mt-3 inline-flex rounded-lg bg-[var(--primary)] px-3 py-1.5 font-mono text-[11px] font-medium text-[var(--primary-foreground)]"
        >
          {expired ? "Renew card" : "Renew now"}
        </Link>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export default function HomePage() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [card, setCard] = useState<Card | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [tapCount, setTapCount] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch all data in parallel
      const [profileRes, cardRes, reviewRes, employeeRes, connectionRes] =
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
        ]);

      if (profileRes.data) setProfile(profileRes.data as unknown as Profile);
      if (cardRes.data) {
        const c = cardRes.data as unknown as Card;
        setCard(c);
        setTapCount(c.tap_count || 0);
      }
      if (reviewRes.data) {
        setReviews(reviewRes.data as unknown as Review[]);
        // Get total count
        const { count } = await supabase
          .from("reviews")
          .select("*", { count: "exact", head: true })
          .eq("profile_id", user.id);
        setReviewCount(count || 0);
      }
      if (employeeRes.data) setEmployees(employeeRes.data as unknown as Employee[]);
      if (connectionRes.data) setConnections(connectionRes.data as unknown as Connection[]);

      setLoading(false);
    })();
  }, []);

  /* Loading skeleton */
  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-5 py-6">
        <div className="mb-6 h-8 w-48 skeleton rounded-lg" />
        <div className="grid grid-cols-2 gap-3 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 skeleton rounded-2xl" />
          ))}
        </div>
        <div className="h-32 skeleton rounded-2xl mb-4" />
        <div className="h-48 skeleton rounded-2xl" />
      </div>
    );
  }

  if (!profile) return null;

  /* Derived data */
  const completionItems = getCompletionItems(profile, card);
  const completedCount = completionItems.filter((i) => i.done).length;
  const completionPct = Math.round((completedCount / completionItems.length) * 100);
  const pendingItems = completionItems.filter((i) => !i.done);

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
        <StatCard icon={Eye} label="Connections" value={connections.length} />
      </div>

      {/* Card validity — 1 year from the day they joined */}
      <ValidityCard profile={profile} />

      {/* Profile completion */}
      {completionPct < 100 && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap size={16} className="text-[var(--primary)]" strokeWidth={1.6} />
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
                className="flex items-center justify-between rounded-xl bg-[var(--muted)] px-3 py-2.5 transition-colors hover:bg-[var(--accent)]"
              >
                <span className="text-xs text-[var(--foreground)]">{item.label}</span>
                <ChevronRight size={14} className="text-[var(--muted-foreground)]" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-3">
        <Link
          href="/dashboard/profile"
          className="flex flex-col items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 transition-colors hover:bg-[var(--accent)]"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--muted)]">
            <UserPlus size={18} className="text-[var(--foreground)]" strokeWidth={1.6} />
          </div>
          <span className="font-mono text-[10px] text-[var(--muted-foreground)]">
            Edit Profile
          </span>
        </Link>
        <Link
          href="/dashboard/scanner"
          className="flex flex-col items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 transition-colors hover:bg-[var(--accent)]"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--muted)]">
            <BarChart3 size={18} className="text-[var(--foreground)]" strokeWidth={1.6} />
          </div>
          <span className="font-mono text-[10px] text-[var(--muted-foreground)]">
            Scan Card
          </span>
        </Link>
        <Link
          href="/dashboard/settings"
          className="flex flex-col items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 transition-colors hover:bg-[var(--accent)]"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--muted)]">
            <TrendingUp size={18} className="text-[var(--foreground)]" strokeWidth={1.6} />
          </div>
          <span className="font-mono text-[10px] text-[var(--muted-foreground)]">
            Settings
          </span>
        </Link>
      </div>

      {/* Recent reviews */}
      {reviews.length > 0 && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
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
                className="rounded-xl bg-[var(--muted)] px-3 py-3"
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
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
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
                className="flex items-center gap-3 rounded-xl bg-[var(--muted)] px-3 py-2.5"
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
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="mb-3 flex items-center gap-2">
            <Activity size={16} className="text-[var(--primary)]" strokeWidth={1.6} />
            <span className="text-sm font-medium text-[var(--foreground)]">
              Recent Connections
            </span>
          </div>
          <div className="space-y-2">
            {connections.slice(0, 5).map((conn) => (
              <div
                key={conn.id}
                className="flex items-center justify-between rounded-xl bg-[var(--muted)] px-3 py-2.5"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2
                    size={14}
                    className="text-green-500"
                    strokeWidth={1.6}
                  />
                  <span className="text-xs text-[var(--foreground)]">
                    New connection
                  </span>
                </div>
                <span className="font-mono text-[10px] text-[var(--muted-foreground)]">
                  {formatDistanceToNow(conn.created_at)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Business stats */}
      {(profile.years_in_business || profile.clients_served || profile.coverage_area) && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
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
