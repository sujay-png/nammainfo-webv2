"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { RefreshCw, Package } from "lucide-react";
import { OrdersKpiGrid } from "@/admin/widgets/orders-kpi/ui/OrdersKpiGrid";
import { OrderFiltersBar } from "@/admin/features/order-filters/ui/OrderFiltersBar";
import { OrdersTable } from "@/admin/widgets/orders-table/ui/OrdersTable";
import { OrderDetailModal } from "@/admin/widgets/order-detail-modal/ui/OrderDetailModal";
import {
  fetchAdminOrders,
  updateAdminOrderStatus,
  deleteAdminOrder,
} from "@/admin/entities/order/api/order-api";
import type {
  AdminOrder,
  OrderStats,
  OrderFilters,
  OrderStatus,
  OrderFilterTab,
} from "@/admin/entities/order/model/types";

interface AdminOrdersViewProps {
  onOrderCountUpdate?: (count: number) => void;
}

export const AdminOrdersView: React.FC<AdminOrdersViewProps> = ({
  onOrderCountUpdate,
}) => {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [stats, setStats] = useState<OrderStats>({
    totalOrders: 0,
    underReviewCount: 0,
    inProductionCount: 0,
    deliveredCount: 0,
    totalRevenue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [filters, setFilters] = useState<OrderFilters>({
    search: "",
    tab: "all",
  });

  // Modal
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const loadOrders = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await fetchAdminOrders();
      setOrders(data.orders || []);
      setStats(data.stats);
      if (onOrderCountUpdate) {
        onOrderCountUpdate(data.stats.underReviewCount);
      }
    } catch (err) {
      console.error("Failed to load admin orders:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [onOrderCountUpdate]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Handle direct status change (from Table row quick action or Modal)
  const handleUpdateStatus = async (orderId: string, status: OrderStatus, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    try {
      await updateAdminOrderStatus(orderId, status);
      // Optimistically update local orders list
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status, updatedAt: new Date().toISOString() } : o))
      );
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder((prev) => (prev ? { ...prev, status } : null));
      }
      // Re-fetch stats in background
      loadOrders(true);
    } catch (err: any) {
      alert(err.message || "Failed to update order status");
    }
  };

  // Handle delete order
  const handleDeleteOrder = async (orderId: string) => {
    try {
      await deleteAdminOrder(orderId);
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      if (selectedOrder?.id === orderId) {
        setSelectedOrder(null);
        setIsDetailOpen(false);
      }
      loadOrders(true);
    } catch (err: any) {
      alert(err.message || "Failed to delete order");
    }
  };

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // 1. Status Filter
      if (filters.tab !== "all" && order.status !== filters.tab) {
        return false;
      }

      // 2. Search Filter
      if (filters.search) {
        const query = filters.search.toLowerCase().trim();
        const idMatch = order.id.toLowerCase().includes(query);
        const nameMatch = order.businessName.toLowerCase().includes(query);
        const ownerMatch = order.ownerName.toLowerCase().includes(query);
        const phoneMatch = Boolean(
          (order.phone && order.phone.includes(query)) ||
          (order.shippingAddress?.phone && order.shippingAddress.phone.includes(query))
        );
        const cityMatch = Boolean(
          order.shippingAddress?.city && order.shippingAddress.city.toLowerCase().includes(query)
        );
        const rzpMatch = Boolean(
          (order.razorpayPaymentId && order.razorpayPaymentId.toLowerCase().includes(query)) ||
          (order.razorpayOrderId && order.razorpayOrderId.toLowerCase().includes(query))
        );

        if (!idMatch && !nameMatch && !ownerMatch && !phoneMatch && !cityMatch && !rzpMatch) {
          return false;
        }
      }

      return true;
    });
  }, [orders, filters]);

  return (
    <div className="flex-1 overflow-y-auto">
      {/* View Header */}
      <div className="sticky top-0 z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-[var(--border)] bg-[var(--card)] px-6 py-4 gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-headline text-lg font-bold text-[var(--foreground)]">
              Card Orders & Fulfillment
            </h2>
            {stats.underReviewCount > 0 && (
              <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-amber-700 dark:text-amber-400 border border-amber-500/20">
                {stats.underReviewCount} pending review
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--muted-foreground)]">
            Review artwork files, monitor NFC card production, and manage doorstep delivery.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => loadOrders(true)}
            disabled={loading || refreshing}
            className="flex items-center gap-1.5 rounded-[5px] border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 space-y-6 p-6 max-w-7xl w-full mx-auto pb-16">
        {/* Top KPI Metrics Cards */}
        <OrdersKpiGrid
          stats={stats}
          loading={loading}
          activeFilter={filters.tab}
          onSelectFilter={(tab: OrderFilterTab) => setFilters((f) => ({ ...f, tab }))}
        />

        {/* Filter Bar with Search and Status Tabs */}
        <OrderFiltersBar
          filters={filters}
          onChange={setFilters}
          totalFiltered={filteredOrders.length}
        />

        {/* Orders Table */}
        <OrdersTable
          orders={filteredOrders}
          loading={loading}
          onSelectOrder={(order) => {
            setSelectedOrder(order);
            setIsDetailOpen(true);
          }}
          onUpdateStatus={(orderId, status, e) => handleUpdateStatus(orderId, status, e)}
        />
      </main>

      {/* Detail Modal */}
      <OrderDetailModal
        order={selectedOrder}
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedOrder(null);
        }}
        onUpdateStatus={async (orderId, status) => {
          await handleUpdateStatus(orderId, status);
        }}
        onDeleteOrder={async (orderId) => {
          await handleDeleteOrder(orderId);
        }}
      />
    </div>
  );
};
