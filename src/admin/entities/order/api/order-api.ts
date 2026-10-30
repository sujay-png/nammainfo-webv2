import type { AdminOrder, OrderStats, OrderStatus } from "../model/types";

export interface OrdersResponse {
  orders: AdminOrder[];
  stats: OrderStats;
}

export async function fetchAdminOrders(): Promise<OrdersResponse> {
  const res = await fetch("/api/admin/orders", {
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to load orders");
  }

  return res.json();
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

  return true;
}
