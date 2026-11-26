import React from "react";
import { CreditCard, Clock, CheckCircle2, Truck } from "lucide-react";
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
  const underReview = stats.underReviewCount || 0;
  const inDesign = stats.cardDesignedCount ?? stats.inProductionCount ?? 0;
  const readyToDispatch = stats.readyToDispatchCount || 0;
  const outForDelivery = stats.outForDeliveryCount || 0;

  const reviewAndDesignCount = underReview + inDesign;
  const dispatchCount = readyToDispatch + outForDelivery;

  // Build exact dynamic subtitles reflecting the live status breakdown
  const reviewParts: string[] = [];
  if (underReview > 0) reviewParts.push(`${underReview} under review`);
  if (inDesign > 0) reviewParts.push(`${inDesign} sent to designer`);
  const reviewSubtitle = reviewParts.length > 0 ? reviewParts.join(" • ") : "No orders awaiting design";

  const dispatchParts: string[] = [];
  if (readyToDispatch > 0) dispatchParts.push(`${readyToDispatch} ready to dispatch`);
  if (outForDelivery > 0) dispatchParts.push(`${outForDelivery} out for delivery`);
  const dispatchSubtitle = dispatchParts.length > 0 ? dispatchParts.join(" • ") : "No orders in dispatch";

  const reviewTitle =
    underReview > 0 && inDesign === 0
      ? "Under Review"
      : inDesign > 0 && underReview === 0
      ? "Sent to Designer"
      : "Review & Design";

  const dispatchTitle =
    readyToDispatch > 0 && outForDelivery === 0
      ? "Ready to Dispatch"
      : outForDelivery > 0 && readyToDispatch === 0
      ? "Out for Delivery"
      : "Dispatch & Transit";

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {/* 1. Total Revenue */}
      <StatCard
        title="Revenue"
        value={loading ? "—" : `₹${stats.totalRevenue.toLocaleString("en-IN")}`}
        subtitle={`${stats.totalOrders} total order${stats.totalOrders === 1 ? "" : "s"} placed`}
        icon={<CreditCard size={18} strokeWidth={1.8} />}
        isActive={activeFilter === "all"}
        onClick={() => onSelectFilter("all")}
      />

      {/* 2. Dynamic Under Review / Sent to Designer */}
      <StatCard
        title={reviewTitle}
        value={loading ? "—" : reviewAndDesignCount}
        subtitle={reviewSubtitle}
        icon={<Clock size={18} strokeWidth={1.8} />}
        isActive={activeFilter === "under_review" || activeFilter === "card_designed"}
        onClick={() =>
          onSelectFilter(underReview > 0 ? "under_review" : "card_designed")
        }
        className={reviewAndDesignCount > 0 ? "border-amber-500/40" : undefined}
      />

      {/* 3. Dynamic Ready to Dispatch / Out for Delivery */}
      <StatCard
        title={dispatchTitle}
        value={loading ? "—" : dispatchCount}
        subtitle={dispatchSubtitle}
        icon={<Truck size={18} strokeWidth={1.8} />}
        isActive={activeFilter === "ready_to_dispatch" || activeFilter === "out_for_delivery"}
        onClick={() =>
          onSelectFilter(readyToDispatch > 0 ? "ready_to_dispatch" : "out_for_delivery")
        }
      />

      {/* 4. Delivered Orders */}
      <StatCard
        title="Delivered"
        value={loading ? "—" : stats.deliveredCount}
        subtitle="Completed & fulfilled cards"
        icon={<CheckCircle2 size={18} strokeWidth={1.8} />}
        isActive={activeFilter === "delivered"}
        onClick={() => onSelectFilter("delivered")}
      />
    </div>
  );
};
