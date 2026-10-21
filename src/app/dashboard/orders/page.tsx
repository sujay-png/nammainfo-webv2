"use client";

import React, { useState, useEffect } from "react";
import {
  Package,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  MapPin,
  CreditCard,
  ExternalLink,
  Trash2,
  ArrowLeft,
  Upload,
  RefreshCw,
  Truck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface OrderItem {
  id: string;
  order_type: "pro_initial" | "team_addon" | "renewal";
  card_quantity: number;
  unit_price: number;
  total_amount: number;
  status: "under_review" | "on_work" | "delivered" | "cancelled";
  design_url: string | null;
  design_mode: "uploaded" | "team_assist";
  shipping_address: {
    fullName?: string;
    phone?: string;
    street?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  razorpay_payment_id: string | null;
  created_at: string;
}

export default function CardOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploadingForId, setUploadingForId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const fetchOrders = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch("/api/user/orders");
      const data = await res.json();
      if (res.ok) {
        setOrders(data.orders || []);
      }
    } catch (err) {
      console.error("Failed to load orders:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm("Are you sure you want to cancel and remove this order?")) return;
    setDeletingId(orderId);
    setMessage(null);
    try {
      const res = await fetch(`/api/user/orders?id=${orderId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Failed to remove order");
      setMessage({ text: "Order cancelled successfully.", type: "success" });
      await fetchOrders();
    } catch (err: any) {
      setMessage({ text: err.message || "Failed to delete order", type: "error" });
    } finally {
      setDeletingId(null);
    }
  };

  const handleReuploadDesign = async (orderId: string, file: File) => {
    setUploadingForId(orderId);
    setMessage(null);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop();
      const path = `card-designs/${orderId}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("profile-media")
        .upload(path, file);

      if (uploadError) {
        throw new Error("Failed to upload design file: " + uploadError.message);
      }

      const { data } = supabase.storage.from("profile-media").getPublicUrl(path);
      const publicUrl = data?.publicUrl;

      if (!publicUrl) throw new Error("Could not retrieve file public URL");

      const patchRes = await fetch("/api/user/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, designUrl: publicUrl }),
      });

      const patchData = await patchRes.json();
      if (!patchRes.ok || patchData.error) {
        throw new Error(patchData.error || "Failed to update order");
      }

      setMessage({ text: "Card design artwork updated successfully!", type: "success" });
      await fetchOrders();
    } catch (err: any) {
      setMessage({ text: err.message || "Failed to replace design", type: "error" });
    } finally {
      setUploadingForId(null);
    }
  };

  const underReviewCount = orders.filter((o) => o.status === "under_review").length;
  const inProductionCount = orders.filter((o) => o.status === "on_work").length;
  const deliveredCount = orders.filter((o) => o.status === "delivered").length;

  return (
    <div className="mx-auto max-w-lg px-4 py-6 sm:px-5 space-y-5">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => router.push("/dashboard/settings")}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--card)] text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] transition-all cursor-pointer"
        >
          <ArrowLeft size={14} />
          <span>Settings</span>
        </button>

        <button
          onClick={() => fetchOrders(true)}
          disabled={loading || refreshing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--card)] text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] transition-all cursor-pointer"
        >
          <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Page Title */}
      <div className="space-y-1">
        <h1 className="font-headline text-xl sm:text-2xl font-bold text-[var(--foreground)]">
          Card Orders & Fulfillment
        </h1>
        <p className="text-xs text-[var(--muted-foreground)]">
          Track your custom NFC smart card production, proofing, and courier delivery.
        </p>
      </div>

      {/* Summary KPI Badges */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 text-center">
          <span className="block font-mono text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
            Total Orders
          </span>
          <span className="font-headline text-lg font-bold text-[var(--foreground)] mt-0.5 block">
            {orders.length}
          </span>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 text-center">
          <span className="block font-mono text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400">
            In Progress
          </span>
          <span className="font-headline text-lg font-bold text-amber-600 dark:text-amber-400 mt-0.5 block">
            {underReviewCount + inProductionCount}
          </span>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 text-center">
          <span className="block font-mono text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Delivered
          </span>
          <span className="font-headline text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 block">
            {deliveredCount}
          </span>
        </div>
      </div>

      {/* Status feedback message */}
      {message && (
        <div
          className={`p-3.5 rounded-2xl text-xs flex items-center gap-2.5 ${
            message.type === "success"
              ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
              : "bg-rose-500/10 text-rose-600 border border-rose-500/20"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 size={16} className="shrink-0" />
          ) : (
            <AlertCircle size={16} className="shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Orders List */}
      <div className="space-y-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-44 rounded-2xl border border-[var(--border)] bg-[var(--card)] animate-pulse"
              />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-8 text-center space-y-4 shadow-sm">
            <div className="h-16 w-16 mx-auto rounded-2xl bg-[var(--accent)] border border-[var(--border)] flex items-center justify-center text-[var(--muted-foreground)]">
              <Package size={28} />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-sm text-[var(--foreground)]">
                No Card Orders Yet
              </h3>
              <p className="text-xs text-[var(--muted-foreground)] max-w-xs mx-auto leading-relaxed">
                When you order your physical NFC card or team member badges, real-time production and delivery tracking will appear right here.
              </p>
            </div>
            <Link
              href="/dashboard/home"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] text-xs font-semibold shadow-sm hover:opacity-90 active:scale-[0.98] transition-all"
            >
              <Sparkles size={14} />
              <span>Go to Dashboard</span>
            </Link>
          </div>
        ) : (
          orders.map((order) => {
            const addr = order.shipping_address || {};
            const formattedDate = new Date(order.created_at).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            });

            return (
              <div
                key={order.id}
                className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-4 shadow-sm"
              >
                {/* Header Row */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-[var(--foreground)]">
                        {order.order_type === "pro_initial"
                          ? "Custom NFC Smart Card"
                          : order.order_type === "team_addon"
                          ? `Team Cards (${order.card_quantity} IDs)`
                          : "Membership Renewal"}
                      </span>
                      <span className="font-mono text-xs font-bold text-[var(--foreground)]">
                        ₹{Number(order.total_amount).toLocaleString("en-IN")}
                      </span>
                    </div>
                    <p className="font-mono text-[11px] text-[var(--muted-foreground)] mt-0.5">
                      Ordered on {formattedDate}
                    </p>
                  </div>

                  {/* Status Badge */}
                  <div>
                    {order.status === "under_review" && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/25 font-mono text-[10px] font-semibold uppercase tracking-wider">
                        <Clock size={12} />
                        <span>Under Review</span>
                      </span>
                    )}
                    {order.status === "on_work" && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/25 font-mono text-[10px] font-semibold uppercase tracking-wider">
                        <Loader2 size={12} className="animate-spin" />
                        <span>In Production</span>
                      </span>
                    )}
                    {order.status === "delivered" && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 font-mono text-[10px] font-semibold uppercase tracking-wider">
                        <CheckCircle2 size={12} />
                        <span>Delivered</span>
                      </span>
                    )}
                    {order.status === "cancelled" && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/25 font-mono text-[10px] font-semibold uppercase tracking-wider">
                        <span>Cancelled</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* 3-Step Fulfillment Progress */}
                {order.status !== "cancelled" && (
                  <div className="space-y-2 pt-1">
                    <div className="grid grid-cols-3 gap-2">
                      <div
                        className={`p-2 rounded-xl border text-center transition-all ${
                          order.status === "under_review" ||
                          order.status === "on_work" ||
                          order.status === "delivered"
                            ? "bg-[var(--accent)] border-[var(--primary)] text-[var(--foreground)]"
                            : "border-[var(--border)] text-[var(--muted-foreground)] opacity-50"
                        }`}
                      >
                        <span className="block font-mono text-[9px] uppercase tracking-wider">Step 1</span>
                        <span className="text-[11px] font-semibold block mt-0.5">Order Placed</span>
                      </div>
                      <div
                        className={`p-2 rounded-xl border text-center transition-all ${
                          order.status === "on_work" || order.status === "delivered"
                            ? "bg-[var(--accent)] border-[var(--primary)] text-[var(--foreground)]"
                            : "border-[var(--border)] text-[var(--muted-foreground)] opacity-50"
                        }`}
                      >
                        <span className="block font-mono text-[9px] uppercase tracking-wider">Step 2</span>
                        <span className="text-[11px] font-semibold block mt-0.5">NFC Encoding</span>
                      </div>
                      <div
                        className={`p-2 rounded-xl border text-center transition-all ${
                          order.status === "delivered"
                            ? "bg-emerald-500/10 border-emerald-500 text-emerald-600"
                            : "border-[var(--border)] text-[var(--muted-foreground)] opacity-50"
                        }`}
                      >
                        <span className="block font-mono text-[9px] uppercase tracking-wider">Step 3</span>
                        <span className="text-[11px] font-semibold block mt-0.5">Doorstep Delivery</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Card Artwork / Concierge Details */}
                <div className="p-3.5 rounded-2xl bg-[var(--accent)]/30 border border-[var(--border)] space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[var(--foreground)]">Card Artwork</span>
                    {order.design_mode === "team_assist" ? (
                      <span className="font-mono text-[11px] text-[var(--primary)] font-medium">
                        Complimentary Design Concierge
                      </span>
                    ) : (
                      <span className="font-mono text-[11px] text-[var(--muted-foreground)]">
                        Custom Artwork Uploaded
                      </span>
                    )}
                  </div>

                  {order.design_mode === "team_assist" ? (
                    <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                      Our in-house design team will contact you directly on your phone ({addr.phone || "registered number"}) to review your card layout and preview before final laser engraving.
                    </p>
                  ) : order.design_url ? (
                    <div className="flex items-center justify-between gap-3 pt-1">
                      <div className="flex items-center gap-3">
                        <img
                          src={order.design_url}
                          alt="Card Design Preview"
                          className="h-12 w-16 object-cover rounded-xl border border-[var(--border)] shadow-xs shrink-0 bg-white/5"
                        />
                        <div>
                          <p className="text-xs font-semibold text-[var(--foreground)]">Production Print File</p>
                          <a
                            href={order.design_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-mono text-[10px] text-[var(--primary)] hover:underline mt-0.5"
                          >
                            <span>Open Full Resolution</span>
                            <ExternalLink size={10} />
                          </a>
                        </div>
                      </div>

                      {order.status === "under_review" && (
                        <div>
                          <input
                            type="file"
                            id={`reupload-${order.id}`}
                            className="hidden"
                            accept="image/*,.pdf"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                handleReuploadDesign(order.id, e.target.files[0]);
                              }
                            }}
                          />
                          <button
                            type="button"
                            disabled={uploadingForId === order.id}
                            onClick={() => document.getElementById(`reupload-${order.id}`)?.click()}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--accent)] text-xs font-medium text-[var(--foreground)] transition cursor-pointer"
                          >
                            {uploadingForId === order.id ? (
                              <>
                                <Loader2 size={12} className="animate-spin" />
                                <span>Uploading...</span>
                              </>
                            ) : (
                              <>
                                <Upload size={12} />
                                <span>Replace</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-[var(--muted-foreground)]">Standard Card Profile Format</p>
                  )}
                </div>

                {/* Delivery Address Details */}
                <div className="p-3.5 rounded-2xl bg-[var(--accent)]/30 border border-[var(--border)] space-y-1.5 text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-[var(--foreground)]">
                    <MapPin size={13} className="text-[var(--primary)] shrink-0" />
                    <span>Courier Destination</span>
                  </div>
                  <p className="text-[var(--foreground)] font-medium">
                    {addr.fullName || "Account Holder"} {addr.phone && `• ${addr.phone}`}
                  </p>
                  <p className="text-[var(--muted-foreground)]">
                    {addr.street || "Business Address on Profile"}
                    {addr.city && `, ${addr.city}`}
                    {addr.pincode && ` - ${addr.pincode}`}
                  </p>
                </div>

                {/* Footer Reference & Order Actions */}
                <div className="flex items-center justify-between pt-1 border-t border-[var(--border)] text-[11px] font-mono text-[var(--muted-foreground)]">
                  <span className="truncate max-w-[200px]">
                    ID: {order.id.slice(0, 8)}...
                  </span>

                  {order.status === "under_review" && (
                    <button
                      onClick={() => handleDeleteOrder(order.id)}
                      disabled={deletingId === order.id}
                      className="inline-flex items-center gap-1 text-red-500 hover:text-red-600 transition font-sans text-xs font-medium cursor-pointer"
                    >
                      {deletingId === order.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Trash2 size={12} />
                      )}
                      <span>Cancel Order</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
