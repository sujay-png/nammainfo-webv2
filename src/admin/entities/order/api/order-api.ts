import type { AdminOrder, OrderStats, OrderStatus } from "../model/types";

export interface OrdersResponse {
  orders: AdminOrder[];
  stats: OrderStats;
}

let ordersCache: { data: OrdersResponse; timestamp: number } | null = null;
const ORDERS_CACHE_TTL_MS = 30_000; // 30 seconds

export function invalidateOrdersCache() {
  ordersCache = null;
}

export async function fetchAdminOrders(forceRefresh = false): Promise<OrdersResponse> {
  if (!forceRefresh && ordersCache && Date.now() - ordersCache.timestamp < ORDERS_CACHE_TTL_MS) {
    return ordersCache.data;
  }

  const res = await fetch("/api/admin/orders", {
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to load orders");
  }

  const data: OrdersResponse = await res.json();
  ordersCache = { data, timestamp: Date.now() };
  return data;
}

export async function updateAdminOrderStatus(
  orderId: string,
  status: OrderStatus
): Promise<{ success: boolean; orderId: string; status: OrderStatus }> {
  const res = await fetch("/api/admin/orders", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId, status }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to update order status");
  }

  invalidateOrdersCache();
  return res.json();
}

export async function deleteAdminOrder(orderId: string): Promise<boolean> {
  const res = await fetch(`/api/admin/orders?id=${encodeURIComponent(orderId)}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to delete order");
  }

  invalidateOrdersCache();
  return true;
}
