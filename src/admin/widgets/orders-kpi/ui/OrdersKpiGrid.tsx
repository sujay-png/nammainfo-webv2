import React from "react";
import { CreditCard, Clock, CheckCircle2 } from "lucide-react";
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
  const pendingCount = Math.max(0, stats.totalOrders - stats.deliveredCount);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {/* 1. Total Revenue */}
      <StatCard
        title="Revenue"
        value={loading ? "—" : `₹${stats.totalRevenue.toLocaleString("en-IN")}`}
        subtitle={`${stats.totalOrders} total orders placed`}
        icon={<CreditCard size={18} strokeWidth={1.8} />}
        isActive={activeFilter === "all"}
        onClick={() => onSelectFilter("all")}
      />

      {/* 2. Delivered Orders */}
      <StatCard
        title="Delivered"
        value={loading ? "—" : stats.deliveredCount}
        subtitle="Completed & fulfilled cards"
        icon={<CheckCircle2 size={18} strokeWidth={1.8} />}
        isActive={activeFilter === "delivered"}
        onClick={() => onSelectFilter("delivered")}
      />

      {/* 3. Pending Orders */}
      <StatCard
        title="Pending"
        value={loading ? "—" : pendingCount}
        subtitle="Awaiting design / dispatch"
        icon={<Clock size={18} strokeWidth={1.8} />}
        isActive={activeFilter === "under_review"}
        onClick={() => onSelectFilter("under_review")}
        className={pendingCount > 0 ? "border-amber-500/40" : undefined}
      />
    </div>
  );
};
