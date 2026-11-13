import React from "react";
import { CreditCard, Clock, CalendarX, FileText } from "lucide-react";
import { StatCard } from "@/admin/shared/ui/StatCard";
import type { AdminStats } from "@/admin/entities/company/model/types";

export type AdminViewFilter = "all" | "active_trials" | "upcoming_renewals" | "expired";

interface KpiMetricsGridProps {
  stats: AdminStats;
  loading?: boolean;
  activeView: AdminViewFilter;
  onSelectView: (view: AdminViewFilter) => void;
}

export const KpiMetricsGrid: React.FC<KpiMetricsGridProps> = ({
  stats,
  loading = false,
  activeView,
  onSelectView,
}) => {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {/* 1. Total Cards in Use */}
      <StatCard
        title="Total Cards in Use"
        value={loading ? "—" : stats.totalCardsInUse ?? stats.totalCardsIssued}
        subtitle={
          <div className="flex items-center justify-between w-full">
            <span>{stats.totalPrimaryCards ?? 0} Primary</span>
            <span>{stats.totalEmployeeIds ?? 0} Team IDs</span>
          </div>
        }
        icon={<CreditCard size={18} strokeWidth={1.8} />}
        isActive={activeView === "all"}
        onClick={() => onSelectView("all")}
      />

      {/* 2. Active Free Trials */}
      <StatCard
        title="Active Trials"
        value={loading ? "—" : stats.activeTrialsCount ?? 0}
        subtitle="100-day coverage"
        icon={<FileText size={18} strokeWidth={1.8} />}
        isActive={activeView === "active_trials"}
        onClick={() => onSelectView("active_trials")}
      />

      {/* 3. Upcoming Renewals (< 30 days) */}
      <StatCard
        title="Upcoming Renewals"
        value={loading ? "—" : stats.upcomingRenewalsCount ?? 0}
        subtitle="Expiring in next 30 days"
        icon={<Clock size={18} strokeWidth={1.8} />}
        isActive={activeView === "upcoming_renewals"}
        onClick={() => onSelectView("upcoming_renewals")}
      />

      {/* 4. Expired Cards */}
      <StatCard
        title="Expired Cards"
        value={loading ? "—" : stats.expiredCardsCount ?? 0}
        subtitle="Subscription expired"
        icon={<CalendarX size={18} strokeWidth={1.8} />}
        isActive={activeView === "expired"}
        onClick={() => onSelectView("expired")}
      />
    </div>
  );
};
