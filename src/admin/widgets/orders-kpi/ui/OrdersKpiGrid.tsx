import React from "react";
import { Package, Clock, Cpu, CheckCircle2 } from "lucide-react";
import { StatCard } from "@/admin/shared/ui/StatCard";
import type { OrderStats, OrderFilterTab } from "@/admin/entities/order/model/types";

interface OrdersKpiGridProps {
  stats: OrderStats;
  loading?: boolean;
  activeFilter: OrderFilterTab;
  onSelectFilter: (filter: OrderFilterTab) => void;
}

export const OrdersKpiGrid: React.FC<OrdersKpiGridProps> = ({
  stats,
  loading = false,
  activeFilter,
  onSelectFilter,
}) => {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {/* 1. Total Orders */}
      <StatCard
        title="Total Orders"
        value={loading ? "—" : stats.totalOrders}
        subtitle={loading ? undefined : `₹${stats.totalRevenue.toLocaleString("en-IN")} revenue`}
        icon={<Package size={18} strokeWidth={1.8} />}
        isActive={activeFilter === "all"}
        onClick={() => onSelectFilter("all")}
      />

      {/* 2. Under Review */}
      <StatCard
        title="Under Review"
        value={loading ? "—" : stats.underReviewCount}
        subtitle="Pending design approval"
        icon={<Clock size={18} strokeWidth={1.8} />}
        isActive={activeFilter === "under_review"}
        onClick={() => onSelectFilter("under_review")}
        className={stats.underReviewCount > 0 ? "border-amber-500/40" : undefined}
      />

      {/* 3. In Production */}
      <StatCard
        title="In Production"
        value={loading ? "—" : stats.inProductionCount}
        subtitle="NFC encoding & print"
        icon={<Cpu size={18} strokeWidth={1.8} />}
        isActive={activeFilter === "on_work"}
        onClick={() => onSelectFilter("on_work")}
      />

      {/* 4. Delivered */}
      <StatCard
        title="Delivered"
        value={loading ? "—" : stats.deliveredCount}
        subtitle="Fulfilled & dispatched"
        icon={<CheckCircle2 size={18} strokeWidth={1.8} />}
        isActive={activeFilter === "delivered"}
        onClick={() => onSelectFilter("delivered")}
      />
    </div>
  );
};
