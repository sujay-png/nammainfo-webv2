import React from "react";
import {
  Package,
  Clock,
  Cpu,
  CheckCircle2,
  ExternalLink,
  MapPin,
  Phone,
  MessageCircle,
  FileText,
  CreditCard,
  ChevronRight,
  Eye,
} from "lucide-react";
import type { AdminOrder, OrderStatus } from "@/admin/entities/order/model/types";

interface OrdersTableProps {
  orders: AdminOrder[];
  loading: boolean;
  onSelectOrder: (order: AdminOrder) => void;
  onUpdateStatus: (orderId: string, status: OrderStatus, e: React.MouseEvent) => void;
}

export const OrdersTable: React.FC<OrdersTableProps> = ({
  orders,
  loading,
  onSelectOrder,
  onUpdateStatus,
}) => {
  if (loading) {
    return (
      <div className="space-y-3 rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-6">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="flex h-16 animate-pulse items-center justify-between rounded-[5px] bg-[var(--accent)] px-4"
          />
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-[5px] border border-dashed border-[var(--border)] bg-[var(--card)] py-16 text-center">
        <Package size={36} className="text-[var(--muted-foreground)] opacity-40 mb-3" />
        <h4 className="font-headline text-base font-semibold text-[var(--foreground)]">
          No orders found
        </h4>
        <p className="mt-1 text-xs text-[var(--muted-foreground)] max-w-sm">
          No orders match the selected filters or search query.
        </p>
      </div>
    );
  }

  const renderStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case "under_review":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[5px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 font-mono text-[10px] font-semibold uppercase tracking-wider">
            <Clock size={11} />
            <span>Under Review</span>
          </span>
        );
      case "on_work":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[5px] bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20 font-mono text-[10px] font-semibold uppercase tracking-wider">
            <Cpu size={11} />
            <span>In Production</span>
          </span>
        );
      case "delivered":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[5px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-mono text-[10px] font-semibold uppercase tracking-wider">
            <CheckCircle2 size={11} />
            <span>Delivered</span>
          </span>
        );
      default:
        return null;
    }
  };

  const getCleanPhone = (phone?: string | null) => {
    if (!phone) return null;
    const clean = phone.replace(/[^0-9]/g, "");
    return clean.length === 10 ? `91${clean}` : clean;
  };

  return (
    <div className="overflow-hidden rounded-[5px] border border-[var(--border)] bg-[var(--card)]">
      {/* Desktop Table View */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[var(--border)] bg-[var(--accent)]/50 font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
            <tr>
              <th scope="col" className="px-5 py-3">Order & Company</th>
              <th scope="col" className="px-4 py-3">Item & Amount</th>
              <th scope="col" className="px-4 py-3">Card Artwork</th>
              <th scope="col" className="px-4 py-3">Destination</th>
              <th scope="col" className="px-4 py-3">Status</th>
              <th scope="col" className="px-5 py-3 text-right">Quick Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {orders.map((order) => {
              const formattedDate = new Date(order.createdAt).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              });
              const cleanPhone = getCleanPhone(order.phone || order.shippingAddress?.phone);

              return (
                <tr
                  key={order.id}
                  onClick={() => onSelectOrder(order)}
                  className="cursor-pointer transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800/50"
                >
                  {/* Order & Company */}
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[5px] bg-[var(--accent)] font-headline text-xs font-bold text-[var(--foreground)] border border-[var(--border)]">
                        {order.avatarUrl ? (
                          <img
                            src={order.avatarUrl}
                            alt=""
                            className="h-full w-full rounded-[5px] object-cover"
                          />
                        ) : (
                          order.businessName.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-[var(--foreground)]">
                          {order.businessName}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-[10px] text-[var(--muted-foreground)]">
                            ID: #{order.id.slice(0, 8)}
                          </span>
                          <span className="text-[var(--border)]">•</span>
                          <span className="text-[11px] text-[var(--muted-foreground)]">
                            {formattedDate}
                          </span>
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Item & Amount */}
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <div>
                      <p className="font-semibold text-[var(--foreground)]">
                        {order.orderType === "pro_initial"
                          ? "Pro Smart Card"
                          : order.orderType === "team_addon"
                          ? `Team Cards (${order.cardQuantity})`
                          : "Membership Renewal"}
                      </p>
                      <p className="font-mono text-[11px] font-bold text-[var(--foreground)] mt-0.5">
                        ₹{Number(order.totalAmount).toLocaleString("en-IN")}
                      </p>
                    </div>
                  </td>

                  {/* Artwork / Card Details File */}
                  <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                    {order.shippingAddress?.cardDetails?.mode === "custom_details" || (!order.designUrl && order.designMode === "team_assist") ? (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[5px] bg-[var(--accent)] text-[var(--foreground)] border border-[var(--border)] font-mono text-[10px] font-semibold">
                        <FileText size={11} className="text-[var(--muted-foreground)]" />
                        <span>Custom Details</span>
                      </div>
                    ) : order.designUrl ? (
                      <div className="flex items-center gap-2.5">
                        <a
                          href={order.designUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group relative block h-9 w-12 shrink-0 overflow-hidden rounded-[5px] border border-[var(--border)] bg-white/5 hover:border-[var(--foreground)] transition-colors"
                          title="Open visiting card / artwork"
                        >
                          <img
                            src={order.designUrl}
                            alt="Card Print"
                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          />
                        </a>
                        <a
                          href={order.designUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--foreground)] hover:underline"
                        >
                          <span>Visiting Card</span>
                          <ExternalLink size={10} className="text-[var(--muted-foreground)]" />
                        </a>
                      </div>
                    ) : (
                      <span className="text-[11px] text-[var(--muted-foreground)]">Standard Profile</span>
                    )}
                  </td>

                  {/* Destination & Contact */}
                  <td className="px-4 py-3.5">
                    <div className="min-w-0 max-w-[200px]">
                      <div className="flex items-center gap-1.5 font-medium text-[var(--foreground)] truncate">
                        <MapPin size={11} className="text-[var(--muted-foreground)] shrink-0" />
                        <span className="truncate">
                          {order.shippingAddress?.city || "Unknown City"}
                          {order.shippingAddress?.pincode ? ` (${order.shippingAddress.pincode})` : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1" onClick={(e) => e.stopPropagation()}>
                        {order.phone && (
                          <a
                            href={`tel:${order.phone}`}
                            className="inline-flex items-center gap-1 text-[11px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                            title="Call recipient"
                          >
                            <Phone size={10} />
                            <span>{order.phone}</span>
                          </a>
                        )}
                        {cleanPhone && (
                          <a
                            href={`https://wa.me/${cleanPhone}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-emerald-600 dark:text-emerald-400 hover:opacity-80 transition-opacity"
                            title="Message on WhatsApp"
                          >
                            <MessageCircle size={12} />
                          </a>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Status Badge */}
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    {renderStatusBadge(order.status)}
                  </td>

                  {/* Quick Action Controller */}
                  <td className="px-5 py-3.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      {order.status === "under_review" && (
                        <button
                          onClick={(e) => onUpdateStatus(order.id, "on_work", e)}
                          className="rounded-[5px] bg-[var(--foreground)] px-2.5 py-1 text-[11px] font-medium text-[var(--background)] hover:opacity-90 transition-opacity"
                        >
                          Start Production
                        </button>
                      )}
                      {order.status === "on_work" && (
                        <button
                          onClick={(e) => onUpdateStatus(order.id, "delivered", e)}
                          className="rounded-[5px] border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                        >
                          Mark Delivered
                        </button>
                      )}
                      <button
                        onClick={() => onSelectOrder(order)}
                        className="rounded-[5px] p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] transition-colors"
                        title="View details"
                      >
                        <ChevronRight size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card List View */}
      <div className="divide-y divide-[var(--border)] lg:hidden">
        {orders.map((order) => {
          const formattedDate = new Date(order.createdAt).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          });
          const cleanPhone = getCleanPhone(order.phone || order.shippingAddress?.phone);

          return (
            <div
              key={order.id}
              onClick={() => onSelectOrder(order)}
              className="p-4 space-y-3 cursor-pointer hover:bg-[var(--accent)]/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h5 className="font-semibold text-sm text-[var(--foreground)]">
                    {order.businessName}
                  </h5>
                  <div className="flex items-center gap-2 mt-0.5 font-mono text-[10px] text-[var(--muted-foreground)]">
                    <span>#{order.id.slice(0, 8)}</span>
                    <span>•</span>
                    <span>{formattedDate}</span>
                  </div>
                </div>
                <div>{renderStatusBadge(order.status)}</div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1 border-t border-[var(--border)]/50">
                <span className="text-[var(--muted-foreground)]">
                  {order.orderType === "pro_initial"
                    ? "Pro Card"
                    : `Team Cards (${order.cardQuantity})`}
                </span>
                <span className="font-mono font-bold text-[var(--foreground)]">
                  ₹{Number(order.totalAmount).toLocaleString("en-IN")}
                </span>
              </div>

              {/* Artwork & Shipping Summary */}
              <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)]">
                <div className="flex items-center gap-1.5">
                  <MapPin size={12} className="text-[var(--muted-foreground)]" />
                  <span className="truncate max-w-[150px]">
                    {order.shippingAddress?.city || "Address on file"}
                  </span>
                </div>
                {order.shippingAddress?.cardDetails?.mode === "custom_details" || (!order.designUrl && order.designMode === "team_assist") ? (
                  <span className="text-[var(--foreground)] font-mono text-[10px] font-semibold">
                    Custom Details
                  </span>
                ) : order.designUrl ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-mono text-[10px]">
                    Visiting Card
                  </span>
                ) : null}
              </div>

              {/* Quick Action Button */}
              <div
                className="flex items-center justify-between pt-2 border-t border-[var(--border)]/50"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-2">
                  {order.phone && (
                    <a
                      href={`tel:${order.phone}`}
                      className="inline-flex items-center gap-1 rounded-[5px] border border-[var(--border)] px-2.5 py-1 text-[11px] text-[var(--foreground)]"
                    >
                      <Phone size={10} />
                      <span>Call</span>
                    </a>
                  )}
                  {cleanPhone && (
                    <a
                      href={`https://wa.me/${cleanPhone}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-[5px] border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-700 dark:text-emerald-400"
                    >
                      <MessageCircle size={10} />
                      <span>WhatsApp</span>
                    </a>
                  )}
                </div>

                {order.status === "under_review" && (
                  <button
                    onClick={(e) => onUpdateStatus(order.id, "on_work", e)}
                    className="rounded-[5px] bg-[var(--foreground)] px-3 py-1 text-[11px] font-medium text-[var(--background)]"
                  >
                    Start Production
                  </button>
                )}
                {order.status === "on_work" && (
                  <button
                    onClick={(e) => onUpdateStatus(order.id, "delivered", e)}
                    className="rounded-[5px] border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400"
                  >
                    Mark Delivered
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
