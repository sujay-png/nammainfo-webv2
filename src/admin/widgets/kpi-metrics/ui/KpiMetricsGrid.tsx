import React from "react";
import { CreditCard, Clock, CalendarX } from "lucide-react";
import { StatCard } from "@/admin/shared/ui/StatCard";
import type { AdminStats } from "@/admin/entities/company/model/types";

export type AdminViewFilter = "all" | "upcoming_renewals" | "expired";

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
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
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

      {/* 2. Upcoming Renewals (< 15 days) */}
      <StatCard
        title="Upcoming Renewals"
        value={loading ? "—" : stats.upcomingRenewalsCount ?? 0}
        subtitle="Expiring in next 15 days"
        icon={<Clock size={18} strokeWidth={1.8} />}
        isActive={activeView === "upcoming_renewals"}
        onClick={() => onSelectView("upcoming_renewals")}
      />

      {/* 3. Expired Cards */}
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
