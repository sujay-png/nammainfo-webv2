"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Package,
  Clock,
  CheckCircle2,
  Lock,
  Upload,
  AlertCircle,
  Loader2,
  MapPin,
  CreditCard,
  ExternalLink,
  Trash2,
} from "lucide-react";
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

interface UserOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

export default function UserOrdersModal({
  isOpen,
  onClose,
  userId,
}: UserOrdersModalProps) {
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingForId, setUploadingForId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm("Are you sure you want to cancel and remove this order?")) return;
    setDeletingId(orderId);
    try {
      const res = await fetch(`/api/user/orders?id=${orderId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Failed to remove order");
      setMessage({ text: "Order removed successfully", type: "success" });
      await fetchOrders();
    } catch (err: any) {
      setMessage({ text: err.message || "Failed to delete order", type: "error" });
    } finally {
      setDeletingId(null);
    }
  };

  const fetchOrders = async () => {
    setLoading(true);
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
    }
  };

  useEffect(() => {
    if (isOpen) {
      setMessage(null);
      fetchOrders();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleReuploadDesign = async (orderId: string, file: File) => {
    setUploadingForId(orderId);
    setMessage(null);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop();
      const path = `card-designs/${userId}/${Date.now()}.${ext}`;

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

      setMessage({ text: "Card design updated successfully!", type: "success" });
      await fetchOrders();
    } catch (err: any) {
      setMessage({ text: err.message || "Failed to replace design", type: "error" });
    } finally {
      setUploadingForId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-xl max-h-[90vh] flex flex-col rounded-3xl border border-[var(--border)] bg-[var(--card)] shadow-2xl relative overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-[var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[var(--accent)] border border-[var(--border)] text-[var(--foreground)] flex items-center justify-center shrink-0">
              <Package size={18} strokeWidth={1.8} />
            </div>
            <div>
              <h3 className="font-headline text-lg font-bold text-[var(--foreground)]">
                Card Orders & Delivery
              </h3>
              <p className="text-xs text-[var(--muted-foreground)]">
                Track physical card manufacturing and shipping
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Message banner */}
        {message && (
          <div
            className={`px-5 py-2.5 text-xs flex items-center gap-2 ${
              message.type === "success"
                ? "bg-emerald-500/10 text-emerald-600 border-b border-emerald-500/20"
                : "bg-rose-500/10 text-rose-600 border-b border-rose-500/20"
            }`}
          >
            {message.type === "success" ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
            <span>{message.text}</span>
          </div>
        )}

        {/* Orders Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Loader2 size={24} className="animate-spin text-[var(--primary)] mb-2" />
              <p className="text-xs text-[var(--muted-foreground)]">Loading your orders...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
              <div className="h-14 w-14 rounded-2xl bg-[var(--accent)] border border-[var(--border)] flex items-center justify-center text-[var(--muted-foreground)]">
                <Package size={24} />
              </div>
              <div>
                <p className="font-semibold text-sm text-[var(--foreground)]">No Card Orders Yet</p>
                <p className="text-xs text-[var(--muted-foreground)] max-w-xs mt-1">
                  Once you purchase a Pro plan or team member cards, your physical NFC card orders will appear here.
                </p>
              </div>
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
                  className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3 shadow-sm"
                >
                  {/* Order header row */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
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
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/25 font-mono text-[10px] font-semibold uppercase tracking-wider">
                          <Clock size={12} />
                          <span>Under Review</span>
                        </span>
                      )}
                      {order.status === "on_work" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/25 font-mono text-[10px] font-semibold uppercase tracking-wider">
                          <CreditCard size={12} />
                          <span>In Production</span>
                        </span>
                      )}
                      {order.status === "delivered" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 font-mono text-[10px] font-semibold uppercase tracking-wider">
                          <CheckCircle2 size={12} />
                          <span>Delivered</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status explanation & re-upload card */}
                  <div className="rounded-xl bg-[var(--background)] p-3 border border-[var(--border)] text-xs space-y-2">
                    {order.status === "under_review" && (
                      <div className="space-y-2">
                        <p className="text-[var(--muted-foreground)] leading-relaxed">
                          Your order is confirmed and awaiting production. You can still replace or upload your card design file before production begins.
                        </p>
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[var(--border)]">
                          <div className="flex items-center gap-1.5 text-[11px] text-[var(--muted-foreground)]">
                            <span className="font-medium">Design Status:</span>
                            <span>{order.design_url ? "Custom file provided" : "Team assistance requested"}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleDeleteOrder(order.id)}
                              disabled={deletingId === order.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-500/30 text-rose-600 hover:bg-rose-500/10 text-xs font-semibold transition cursor-pointer"
                              title="Cancel & remove this order"
                            >
                              {deletingId === order.id ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <Trash2 size={12} />
                              )}
                              <span>Cancel</span>
                            </button>

                            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] text-xs font-semibold cursor-pointer hover:opacity-90 active:scale-[0.98] transition-all">
                              {uploadingForId === order.id ? (
                                <Loader2 size={13} className="animate-spin" />
                              ) : (
                                <Upload size={13} />
                              )}
                              <span>{order.design_url ? "Change Design File" : "Upload Design File"}</span>
                              <input
                                type="file"
                                accept="image/*,.pdf"
                                className="hidden"
                                disabled={uploadingForId === order.id}
                                onChange={(e) => {
                                  if (e.target.files && e.target.files[0]) {
                                    handleReuploadDesign(order.id, e.target.files[0]);
                                  }
                                }}
                              />
                            </label>
                          </div>
                        </div>
                      </div>
                    )}

                    {order.status === "on_work" && (
                      <div className="flex items-center justify-between text-sky-700 dark:text-sky-300">
                        <p className="leading-relaxed">
                          Your card is actively being printed and encoded. Design changes are now locked.
                        </p>
                        <span className="inline-flex items-center gap-1 shrink-0 font-mono text-[10px] font-semibold uppercase tracking-wider bg-sky-500/10 px-2 py-0.5 rounded-md border border-sky-500/20">
                          <Lock size={11} />
                          <span>Locked</span>
                        </span>
                      </div>
                    )}

                    {order.status === "delivered" && (
                      <p className="text-emerald-700 dark:text-emerald-300 font-medium">
                        Your custom NFC card has been delivered to your doorstep. Tap it on any smartphone to instantly share your profile!
                      </p>
                    )}
                  </div>

                  {/* Shipping address footer */}
                  {addr.street && (
                    <div className="flex items-start gap-1.5 text-[11px] text-[var(--muted-foreground)] pt-1">
                      <MapPin size={12} className="shrink-0 mt-0.5 text-[var(--muted-foreground)]" />
                      <span>
                        Shipping to: <strong className="text-[var(--foreground)]">{addr.fullName || "Recipient"}</strong> ({addr.phone || ""}) • {addr.street}, {addr.city || ""} {addr.pincode || ""}
                      </span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
