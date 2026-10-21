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
  Sparkles,
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
  onUpdateStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  onDeleteOrder: (orderId: string) => Promise<void>;
}

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
  order,
  isOpen,
  onClose,
  onUpdateStatus,
  onDeleteOrder,
}) => {
  const [updating, setUpdating] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!order) return null;

  const handleStatusChange = async (newStatus: OrderStatus) => {
    if (newStatus === order.status) return;
    setUpdating(true);
    try {
      await onUpdateStatus(order.id, newStatus);
    } finally {
      setUpdating(false);
    }
  };

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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Order #${order.id.slice(0, 8)}`}
      description={`Placed on ${formattedDate}`}
      maxWidth="3xl"
    >
      <div className="space-y-6 text-xs text-[var(--foreground)]">
        {/* Status Lifecycle Selector */}
        <div className="space-y-2 rounded-[5px] border border-[var(--border)] bg-[var(--accent)]/30 p-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              Fulfillment Status
            </span>
            {updating && (
              <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[var(--muted-foreground)]">
                <Loader2 size={12} className="animate-spin" />
                <span>Updating status...</span>
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 pt-1">
            {/* Step 1: Under Review */}
            <button
              disabled={updating}
              onClick={() => handleStatusChange("under_review")}
              className={`p-3 rounded-[5px] border text-left transition-all ${
                order.status === "under_review"
                  ? "bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]"
                  : "border-[var(--border)] bg-[var(--card)] hover:bg-[var(--accent)] text-[var(--foreground)]"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[9px] uppercase tracking-wider opacity-70">Step 1</span>
                <Clock size={13} />
              </div>
              <p className="font-semibold text-xs">Under Review</p>
              <p className="text-[10px] opacity-75 mt-0.5 leading-snug">
                Customer can update design
              </p>
            </button>

            {/* Step 2: In Production */}
            <button
              disabled={updating}
              onClick={() => handleStatusChange("on_work")}
              className={`p-3 rounded-[5px] border text-left transition-all ${
                order.status === "on_work"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "border-[var(--border)] bg-[var(--card)] hover:bg-[var(--accent)] text-[var(--foreground)]"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[9px] uppercase tracking-wider opacity-70">Step 2</span>
                <Cpu size={13} />
              </div>
              <p className="font-semibold text-xs">In Production</p>
              <p className="text-[10px] opacity-75 mt-0.5 leading-snug">
                Card printing & NFC chip locked
              </p>
            </button>

            {/* Step 3: Delivered */}
            <button
              disabled={updating}
              onClick={() => handleStatusChange("delivered")}
              className={`p-3 rounded-[5px] border text-left transition-all ${
                order.status === "delivered"
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "border-[var(--border)] bg-[var(--card)] hover:bg-[var(--accent)] text-[var(--foreground)]"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[9px] uppercase tracking-wider opacity-70">Step 3</span>
                <CheckCircle2 size={13} />
              </div>
              <p className="font-semibold text-xs">Delivered</p>
              <p className="text-[10px] opacity-75 mt-0.5 leading-snug">
                Order complete & fulfilled
              </p>
            </button>
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

        {/* Card Artwork / Concierge Design Section */}
        <div className="rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              Card Artwork File
            </span>
            {order.designMode === "team_assist" ? (
              <span className="inline-flex items-center gap-1 font-mono text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
                <Sparkles size={12} />
                <span>Complimentary Concierge Requested</span>
              </span>
            ) : (
              <span className="font-mono text-[11px] text-[var(--muted-foreground)]">
                Custom File Uploaded
              </span>
            )}
          </div>

          {order.designMode === "team_assist" ? (
            <div className="p-3.5 rounded-[5px] bg-indigo-500/10 border border-indigo-500/20 space-y-1.5">
              <p className="font-semibold text-xs text-indigo-700 dark:text-indigo-400">
                Design Assistance Needed
              </p>
              <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                The customer selected our complimentary design concierge during checkout. Please call or WhatsApp their contact number ({order.phone || order.shippingAddress?.phone || "Phone on file"}) to gather their logo, typography, and card preferences before production.
              </p>
            </div>
          ) : order.designUrl ? (
            <div className="space-y-3">
              <div className="relative overflow-hidden rounded-[5px] border border-[var(--border)] bg-black/10 dark:bg-black/30 p-2 flex items-center justify-center">
                <img
                  src={order.designUrl}
                  alt="Customer Card Artwork"
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
                    download={`Card_Design_${order.id.slice(0, 8)}`}
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
              No custom design artwork file was uploaded. Standard company branding layout applies.
            </p>
          )}
        </div>

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
