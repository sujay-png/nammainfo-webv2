"use client";

import React, { useState } from "react";
import {
  Package,
  Clock,
  Cpu,
  CheckCircle2,
  MapPin,
  Phone,
  MessageCircle,
  Mail,
  ExternalLink,
  Download,
  CreditCard,
  Building2,
  FileText,
  MessageSquare,
  Image as ImageIcon,
  Loader2,
  Copy,
  Check,
  Trash2,
} from "lucide-react";
import { Modal } from "@/admin/shared/ui/Modal";
import type { AdminOrder, OrderStatus } from "@/admin/entities/order/model/types";

interface OrderDetailModalProps {
  order: AdminOrder | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateStatus?: (orderId: string, status: OrderStatus) => Promise<void>;
  onDeleteOrder: (orderId: string) => Promise<void>;
}

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
  order,
  isOpen,
  onClose,
  onDeleteOrder,
}) => {
  const [updating, setUpdating] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!order) return null;

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this order? This action cannot be undone.")) return;
    setUpdating(true);
    try {
      await onDeleteOrder(order.id);
      onClose();
    } finally {
      setUpdating(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const getCleanPhone = (phone?: string | null) => {
    if (!phone) return null;
    const clean = phone.replace(/[^0-9]/g, "");
    return clean.length === 10 ? `91${clean}` : clean;
  };

  const cleanPhone = getCleanPhone(order.phone || order.shippingAddress?.phone);
  const formattedDate = new Date(order.createdAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const getFulfillmentInfo = (status: OrderStatus) => {
    switch (status) {
      case "under_review":
        return {
          step: 1,
          label: "Under Review",
          description: "Order placed. Customer requirements gathered and specs under review.",
        };
      case "card_designed":
      case "on_work":
        return {
          step: 2,
          label: "Card Designed",
          description: "Design completed and queued for physical NFC card printing.",
        };
      case "ready_to_dispatch":
        return {
          step: 3,
          label: "Ready for Dispatch",
          description: "Physical card printed and customer design approved for courier dispatch.",
        };
      case "out_for_delivery":
        return {
          step: 4,
          label: "Out for Delivery",
          description: "Dispatched via courier (delivery within 5–7 working days).",
        };
      case "delivered":
        return {
          step: 5,
          label: "Delivered",
          description: "Physical card delivered to customer doorstep.",
        };
      case "cancelled":
        return {
          step: 0,
          label: "Cancelled",
          description: "Order has been cancelled.",
        };
      default:
        return {
          step: 1,
          label: status,
          description: "Fulfillment in progress.",
        };
    }
  };

  const currentFulfillment = getFulfillmentInfo(order.status);

  const STAGES = [
    { key: "under_review", step: 1, label: "Under Review" },
    { key: "card_designed", step: 2, label: "Card Designed" },
    { key: "ready_to_dispatch", step: 3, label: "Ready to Dispatch" },
    { key: "out_for_delivery", step: 4, label: "Out for Delivery" },
    { key: "delivered", step: 5, label: "Delivered" },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Order #${order.id.slice(0, 8)}`}
      description={`Placed on ${formattedDate}`}
      maxWidth="3xl"
    >
      <div className="space-y-6 text-xs text-[var(--foreground)]">
        {/* Fulfillment Status Display (Dynamically updated from Company Lifecycle Milestones) */}
        <div className="space-y-3 rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                Fulfillment Status
              </span>
              <span className="rounded-[4px] border border-[var(--border)] bg-[var(--accent)] px-2 py-0.5 font-mono text-[10px] font-semibold text-[var(--foreground)] uppercase">
                {currentFulfillment.label}
              </span>
            </div>
            <span className="text-[11px] text-[var(--muted-foreground)] font-mono">
              Stage {currentFulfillment.step} of 5
            </span>
          </div>

          {/* Stepper Pipeline Indicators */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 pt-1">
            {STAGES.map((s) => {
              const isPast = currentFulfillment.step > s.step;
              const isCurrent = currentFulfillment.step === s.step;
              return (
                <div
                  key={s.key}
                  className={`rounded-[5px] border p-2 text-center transition-all ${
                    isCurrent
                      ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)] shadow-xs"
                      : isPast
                      ? "border-[var(--border)] bg-[var(--accent)] text-[var(--foreground)]"
                      : "border-[var(--border)]/60 bg-[var(--card)] text-[var(--muted-foreground)] opacity-50"
                  }`}
                >
                  <div className="flex items-center justify-center gap-1 mb-0.5">
                    {isPast ? (
                      <Check size={11} strokeWidth={2.8} />
                    ) : (
                      <span className="font-mono text-[9px] uppercase opacity-75">
                        #{s.step}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] font-semibold truncate leading-tight">
                    {s.label}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="rounded-[4px] border border-[var(--border)] bg-[var(--accent)]/50 p-2.5 flex items-start gap-2">
            <Clock size={13} className="text-[var(--muted-foreground)] shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-[var(--foreground)]">
                {currentFulfillment.description}
              </p>
              <p className="text-[11px] text-[var(--muted-foreground)]">
                Status updates dynamically as milestones are completed in the company&apos;s <strong>Status</strong> tab in company details.
              </p>
            </div>
          </div>
        </div>

        {/* 2-Column Grid: Customer Info & Payment Details */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Company / Customer Profile */}
          <div className="space-y-3 rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              <Building2 size={13} />
              <span>Customer Details</span>
            </div>

            <div>
              <p className="font-headline text-sm font-bold text-[var(--foreground)]">
                {order.businessName}
              </p>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                Owner: <span className="text-[var(--foreground)] font-medium">{order.ownerName}</span>
              </p>
            </div>

            <div className="space-y-1.5 pt-1 text-xs">
              {order.email && (
                <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
                  <Mail size={12} className="shrink-0" />
                  <span className="truncate">{order.email}</span>
                </div>
              )}
              {order.phone && (
                <div className="flex items-center gap-2 text-[var(--foreground)]">
                  <Phone size={12} className="text-[var(--muted-foreground)] shrink-0" />
                  <span>{order.phone}</span>
                </div>
              )}
            </div>

            {/* Quick Contact Actions */}
            <div className="flex items-center gap-2 pt-2 border-t border-[var(--border)]">
              {order.phone && (
                <a
                  href={`tel:${order.phone}`}
                  className="inline-flex items-center gap-1.5 rounded-[5px] border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors"
                >
                  <Phone size={12} />
                  <span>Call Customer</span>
                </a>
              )}
              {cleanPhone && (
                <a
                  href={`https://wa.me/${cleanPhone}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-[5px] border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                >
                  <MessageCircle size={12} />
                  <span>WhatsApp</span>
                </a>
              )}
            </div>
          </div>

          {/* Payment & Order Summary */}
          <div className="space-y-3 rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              <CreditCard size={13} />
              <span>Order & Payment</span>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[var(--muted-foreground)]">Order Type</span>
                <span className="font-semibold text-[var(--foreground)]">
                  {order.orderType === "pro_initial"
                    ? "Custom NFC Smart Card"
                    : order.orderType === "team_addon"
                    ? `Team Member Cards (${order.cardQuantity} Cards)`
                    : "Membership Renewal"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--muted-foreground)]">Card Quantity</span>
                <span className="font-mono font-medium text-[var(--foreground)]">
                  {order.cardQuantity} {order.cardQuantity === 1 ? "Card" : "Cards"}
                </span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-[var(--border)]">
                <span className="font-semibold text-[var(--foreground)]">Total Amount Paid</span>
                <span className="font-mono text-base font-bold text-[var(--foreground)]">
                  ₹{Number(order.totalAmount).toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            {/* Razorpay IDs */}
            <div className="space-y-1 pt-2 border-t border-[var(--border)] font-mono text-[11px] text-[var(--muted-foreground)]">
              {order.razorpayPaymentId && (
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">Pay ID: {order.razorpayPaymentId}</span>
                  <button
                    onClick={() => copyToClipboard(order.razorpayPaymentId!, "pay_id")}
                    className="p-1 hover:text-[var(--foreground)]"
                    title="Copy Payment ID"
                  >
                    {copiedKey === "pay_id" ? <Check size={12} /> : <Copy size={12} />}
                  </button>
                </div>
              )}
              {order.razorpayOrderId && (
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">Rzp Order: {order.razorpayOrderId}</span>
                  <button
                    onClick={() => copyToClipboard(order.razorpayOrderId!, "rzp_id")}
                    className="p-1 hover:text-[var(--foreground)]"
                    title="Copy Razorpay Order ID"
                  >
                    {copiedKey === "rzp_id" ? <Check size={12} /> : <Copy size={12} />}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Card Artwork / Custom Card Details Section */}
        {(() => {
          const cardDetails = order.cardDetails || order.shippingAddress?.cardDetails;
          const isCustomDetails = cardDetails?.mode === "custom_details" || (!order.designUrl && order.designMode === "team_assist");

          return (
            <div className="rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                  Card Production Specifications
                </span>
                {isCustomDetails ? (
                  <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold text-[var(--foreground)] px-2 py-0.5 rounded-[4px] bg-[var(--accent)] border border-[var(--border)]">
                    <FileText size={12} className="text-[var(--muted-foreground)]" />
                    <span>Custom Details Provided</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold text-[var(--foreground)] px-2 py-0.5 rounded-[4px] bg-[var(--accent)] border border-[var(--border)]">
                    <CreditCard size={12} className="text-[var(--muted-foreground)]" />
                    <span>Existing Visiting Card Uploaded</span>
                  </span>
                )}
              </div>

              {isCustomDetails ? (
                <div className="space-y-3 pt-1">
                  {/* Card Business Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-[5px] bg-[var(--accent)]/40 border border-[var(--border)]">
                      <span className="block font-mono text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
                        Company Name on Card
                      </span>
                      <span className="block font-semibold text-[var(--foreground)] mt-0.5">
                        {cardDetails?.companyName || order.businessName || "—"}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-[5px] bg-[var(--accent)]/40 border border-[var(--border)]">
                      <span className="block font-mono text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
                        Owner / Contact Name
                      </span>
                      <span className="block font-semibold text-[var(--foreground)] mt-0.5">
                        {cardDetails?.ownerName || order.ownerName || "—"}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-[5px] bg-[var(--accent)]/40 border border-[var(--border)]">
                      <span className="block font-mono text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
                        Contact Number on Card
                      </span>
                      <a
                        href={`tel:${cardDetails?.contactNumber || order.phone || ""}`}
                        className="font-mono font-semibold text-[var(--foreground)] hover:underline mt-0.5 inline-flex items-center gap-1.5"
                      >
                        <Phone size={12} className="text-[var(--muted-foreground)]" />
                        <span>{cardDetails?.contactNumber || order.phone || "—"}</span>
                      </a>
                    </div>

                    <div className="p-2.5 rounded-[5px] bg-[var(--accent)]/40 border border-[var(--border)]">
                      <span className="block font-mono text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
                        Company Address on Card
                      </span>
                      <span className="block text-[var(--foreground)] mt-0.5">
                        {cardDetails?.companyAddress || order.shippingAddress?.street || "—"}
                      </span>
                    </div>
                  </div>

                  {/* Uploaded Logo (if available) */}
                  {(cardDetails?.logoUrl || order.designUrl) && (
                    <div className="p-3 rounded-[5px] bg-[var(--accent)]/30 border border-[var(--border)] flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={cardDetails?.logoUrl || order.designUrl || ""}
                          alt="Company Logo"
                          className="h-10 w-10 object-contain rounded-[4px] border border-[var(--border)] bg-black/10 p-1 shrink-0"
                        />
                        <div>
                          <span className="block text-xs font-semibold text-[var(--foreground)]">
                            Company Logo Attached
                          </span>
                          <span className="block font-mono text-[10px] text-[var(--muted-foreground)]">
                            Use this logo vector/raster for card engraving
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <a
                          href={cardDetails?.logoUrl || order.designUrl || ""}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-[5px] border border-[var(--border)] bg-[var(--background)] px-2.5 py-1 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--accent)]"
                        >
                          <ExternalLink size={11} />
                          <span>View</span>
                        </a>
                        <a
                          href={cardDetails?.logoUrl || order.designUrl || ""}
                          download="Company_Logo"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-[5px] bg-[var(--foreground)] px-2.5 py-1 text-xs font-medium text-[var(--background)] hover:opacity-90"
                        >
                          <Download size={11} />
                          <span>Download</span>
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Customer Suggestions / Notes */}
                  {cardDetails?.designNotes && (
                    <div className="p-3 rounded-[5px] bg-[var(--accent)]/30 border border-[var(--border)] space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--foreground)]">
                        <MessageSquare size={13} className="text-[var(--primary)] shrink-0" />
                        <span>Customer Suggestions & Preferences:</span>
                      </div>
                      <p className="text-xs text-[var(--foreground)] pl-5 leading-relaxed bg-[var(--card)] p-2 rounded-[4px] border border-[var(--border)]">
                        &quot;{cardDetails.designNotes}&quot;
                      </p>
                    </div>
                  )}
                </div>
              ) : order.designUrl ? (
                <div className="space-y-3">
                  <div className="relative overflow-hidden rounded-[5px] border border-[var(--border)] bg-black/10 dark:bg-black/30 p-2 flex items-center justify-center">
                    <img
                      src={order.designUrl}
                      alt="Customer Visiting Card"
                      className="max-h-64 object-contain rounded-[4px]"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[11px] text-[var(--muted-foreground)] truncate max-w-sm">
                      {order.designUrl}
                    </span>
                    <div className="flex items-center gap-2">
                      <a
                        href={order.designUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-[5px] border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors"
                      >
                        <ExternalLink size={12} />
                        <span>Open in New Tab</span>
                      </a>
                      <a
                        href={order.designUrl}
                        download={`Visiting_Card_${order.id.slice(0, 8)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-[5px] bg-[var(--foreground)] px-3 py-1.5 text-xs font-medium text-[var(--background)] hover:opacity-90 transition-opacity"
                      >
                        <Download size={12} />
                        <span>Download File</span>
                      </a>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[var(--muted-foreground)]">
                  No visiting card file was uploaded. Standard company branding layout applies.
                </p>
              )}
            </div>
          );
        })()}

        {/* Courier Shipping Address */}
        <div className="rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-4 space-y-2">
          <div className="flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
            <MapPin size={13} />
            <span>Courier Shipping Address</span>
          </div>

          <div className="p-3 rounded-[5px] bg-[var(--accent)]/30 border border-[var(--border)] space-y-1">
            <p className="font-semibold text-xs text-[var(--foreground)]">
              {order.shippingAddress?.fullName || order.ownerName}
              {order.shippingAddress?.phone && ` • ${order.shippingAddress.phone}`}
            </p>
            <p className="text-xs text-[var(--muted-foreground)]">
              {order.shippingAddress?.street || "No street address specified"}
            </p>
            <p className="text-xs text-[var(--muted-foreground)]">
              {order.shippingAddress?.city && `${order.shippingAddress.city}, `}
              {order.shippingAddress?.state && `${order.shippingAddress.state} `}
              {order.shippingAddress?.pincode && `- ${order.shippingAddress.pincode}`}
            </p>
            {order.shippingAddress?.notes && (
              <p className="text-[11px] text-[var(--muted-foreground)] pt-1 italic">
                Notes: &quot;{order.shippingAddress.notes}&quot;
              </p>
            )}
          </div>
        </div>

        {/* Modal Bottom Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-[var(--border)]">
          <button
            onClick={handleDelete}
            disabled={updating}
            className="inline-flex items-center gap-1.5 rounded-[5px] px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 size={13} />
            <span>Delete Order</span>
          </button>

          <button
            onClick={onClose}
            className="rounded-[5px] bg-[var(--foreground)] px-4 py-1.5 text-xs font-medium text-[var(--background)] hover:opacity-90 transition-opacity"
          >
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
};
