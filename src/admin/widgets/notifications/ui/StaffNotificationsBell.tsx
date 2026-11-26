"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Info,
  Maximize2,
  Search,
} from "lucide-react";
import { Modal } from "@/admin/shared/ui/Modal";

export interface StaffNotificationItem {
  id: string;
  recipient_role: "admin" | "designer" | "partner";
  event_type: string;
  severity: "info" | "action_required" | "urgent";
  title: string;
  message: string;
  entity_type: string | null;
  entity_id: string | null;
  profile_id: string | null;
  is_read: boolean;
  created_at: string;
}

interface StaffNotificationsBellProps {
  title?: string;
  enableSweep?: boolean;
  onSelectNotification?: (notification: StaffNotificationItem) => void;
}

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

export const StaffNotificationsBell: React.FC<StaffNotificationsBellProps> = ({
  title = "Notifications",
  enableSweep = false,
  onSelectNotification,
}) => {
  const [open, setOpen] = useState(false);
  const [fullScreenOpen, setFullScreenOpen] = useState(false);
  const [notifications, setNotifications] = useState<StaffNotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [modalFilter, setModalFilter] = useState<"all" | "unread" | "urgent" | "action_required">("all");
  const [modalSearch, setModalSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async (runSweep = false) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/staff/notifications${runSweep ? "?sweep=1" : ""}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(Number(data.unreadCount || 0));
    } catch (err) {
      console.warn("[StaffNotificationsBell] fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications(enableSweep);
    const interval = setInterval(() => fetchNotifications(false), 60_000);
    return () => clearInterval(interval);
  }, [fetchNotifications, enableSweep]);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  const markAsRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    await fetch("/api/staff/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationId: id }),
    }).catch(() => {});
  };

  const markAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
    await fetch("/api/staff/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    }).catch(() => {});
  };

  const formatTimeAgo = (iso: string) => {
    const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    return `${diffDays}d ago`;
  };

  // Compact popover shows recent notifications from the past 2 days
  const recentNotifications = useMemo(() => {
    const cutoff = Date.now() - TWO_DAYS_MS;
    return notifications.filter((n) => new Date(n.created_at).getTime() >= cutoff);
  }, [notifications]);

  const filteredModalNotifications = useMemo(() => {
    return notifications.filter((n) => {
      if (modalFilter === "unread" && n.is_read) return false;
      if (modalFilter === "urgent" && n.severity !== "urgent") return false;
      if (modalFilter === "action_required" && n.severity !== "action_required") return false;
      if (modalSearch.trim()) {
        const q = modalSearch.toLowerCase();
        return (
          n.title.toLowerCase().includes(q) ||
          n.message.toLowerCase().includes(q) ||
          n.event_type.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [notifications, modalFilter, modalSearch]);

  const renderSeverityIcon = (severity: StaffNotificationItem["severity"]) => {
    if (severity === "urgent") return <AlertTriangle size={14} className="text-amber-500" />;
    if (severity === "action_required") return <Clock size={14} className="text-[var(--foreground)]" />;
    return <Info size={14} />;
  };

  return (
    <>
      <div className="relative" ref={containerRef}>
        <button
          type="button"
          onClick={() => {
            const next = !open;
            setOpen(next);
            if (next) fetchNotifications(false);
          }}
          className="relative flex h-8 w-8 items-center justify-center rounded-[5px] border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors cursor-pointer"
          title={title}
          aria-label={title}
        >
          <Bell size={15} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-[4px] bg-[var(--foreground)] px-1 font-mono text-[9px] font-bold text-[var(--background)]">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-[5px] border border-[var(--border)] bg-[var(--card)] shadow-2xl z-50 overflow-hidden divide-y divide-[var(--border)]">
            <div className="p-3 bg-[var(--accent)]/40 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-headline text-xs font-bold uppercase tracking-wider text-[var(--foreground)] truncate">
                  {title}
                </span>
                {unreadCount > 0 && (
                  <span className="rounded-[4px] border border-[var(--border)] bg-[var(--background)] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[var(--foreground)] shrink-0">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllRead}
                    className="text-[11px] font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] underline cursor-pointer"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setFullScreenOpen(true);
                  }}
                  className="flex h-6 w-6 items-center justify-center rounded-[4px] border border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] cursor-pointer"
                  title="Open full notifications view"
                  aria-label="Open full notifications view"
                >
                  <Maximize2 size={12} />
                </button>
              </div>
            </div>

            <div className="max-h-[340px] overflow-y-auto divide-y divide-[var(--border)]">
              {loading && notifications.length === 0 ? (
                <div className="py-8 text-center text-xs text-[var(--muted-foreground)]">
                  Loading notifications...
                </div>
              ) : recentNotifications.length === 0 ? (
                <div className="py-8 px-4 text-center text-xs text-[var(--muted-foreground)] space-y-1.5">
                  <CheckCircle2 size={22} className="mx-auto text-[var(--muted-foreground)] mb-1 opacity-60" />
                  <p className="font-semibold text-[var(--foreground)]">No alerts in the past 2 days</p>
                  <p className="text-[11px]">
                    {notifications.length > 0
                      ? `${notifications.length} older alert${notifications.length === 1 ? "" : "s"} available in full view.`
                      : "New orders, employee card uploads, 3-day expiries, and follow-up alerts appear here."}
                  </p>
                </div>
              ) : (
                recentNotifications.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => {
                      if (!n.is_read) markAsRead(n.id);
                      setOpen(false);
                      onSelectNotification?.(n);
                    }}
                    className={`w-full text-left p-3 hover:bg-[var(--accent)]/40 transition-colors flex items-start gap-2.5 cursor-pointer ${
                      !n.is_read ? "bg-[var(--accent)]/20" : ""
                    }`}
                  >
                    <div className="mt-0.5 shrink-0 text-[var(--muted-foreground)]">
                      {renderSeverityIcon(n.severity)}
                    </div>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-xs truncate ${
                            !n.is_read
                              ? "font-bold text-[var(--foreground)]"
                              : "font-medium text-[var(--foreground)]"
                          }`}
                        >
                          {n.title}
                        </span>
                        <span className="font-mono text-[10px] text-[var(--muted-foreground)] shrink-0">
                          {formatTimeAgo(n.created_at)}
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--muted-foreground)] leading-snug line-clamp-2">
                        {n.message}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>

            {notifications.length > 0 && (
              <div className="px-3 py-2 bg-[var(--accent)]/20 flex items-center justify-between text-[11px]">
                <span className="text-[var(--muted-foreground)] font-mono text-[10px]">
                  Showing past 2 days ({recentNotifications.length} of {notifications.length})
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setFullScreenOpen(true);
                  }}
                  className="font-semibold text-[var(--foreground)] hover:underline cursor-pointer"
                >
                  View all →
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Full-Screen / Expanded All Notifications Modal */}
      {fullScreenOpen && (
        <Modal
          isOpen={fullScreenOpen}
          onClose={() => setFullScreenOpen(false)}
          title={title}
          description={`Complete notification history (${notifications.length} total • ${unreadCount} unread)`}
          maxWidth="3xl"
        >
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { id: "all", label: "All" },
                    { id: "unread", label: `Unread (${unreadCount})` },
                    { id: "urgent", label: "Urgent" },
                    { id: "action_required", label: "Action Required" },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setModalFilter(f.id)}
                    className={`rounded-[5px] px-2.5 py-1 text-xs font-semibold cursor-pointer ${
                      modalFilter === f.id
                        ? "bg-[var(--foreground)] text-[var(--background)]"
                        : "border border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:w-56">
                  <Search
                    size={13}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
                  />
                  <input
                    type="text"
                    value={modalSearch}
                    onChange={(e) => setModalSearch(e.target.value)}
                    placeholder="Search notifications..."
                    className="w-full rounded-[5px] border border-[var(--border)] bg-[var(--background)] pl-8 pr-2.5 py-1 text-xs text-[var(--foreground)] outline-none focus:border-[var(--foreground)]"
                  />
                </div>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllRead}
                    className="shrink-0 rounded-[5px] border border-[var(--border)] bg-[var(--background)] hover:bg-[var(--accent)] px-2.5 py-1 text-xs font-semibold text-[var(--foreground)] cursor-pointer"
                  >
                    Mark all read
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-[60vh] overflow-y-auto divide-y divide-[var(--border)] rounded-[5px] border border-[var(--border)] bg-[var(--background)]">
              {filteredModalNotifications.length === 0 ? (
                <div className="py-12 text-center text-xs text-[var(--muted-foreground)]">
                  No notifications match the selected filter.
                </div>
              ) : (
                filteredModalNotifications.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => {
                      if (!n.is_read) markAsRead(n.id);
                      setFullScreenOpen(false);
                      onSelectNotification?.(n);
                    }}
                    className={`w-full text-left p-3.5 hover:bg-[var(--accent)]/40 flex items-start gap-3 cursor-pointer ${
                      !n.is_read ? "bg-[var(--accent)]/20" : ""
                    }`}
                  >
                    <div className="mt-0.5 shrink-0 text-[var(--muted-foreground)]">
                      {renderSeverityIcon(n.severity)}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`text-xs truncate ${
                              !n.is_read
                                ? "font-bold text-[var(--foreground)]"
                                : "font-semibold text-[var(--foreground)]"
                            }`}
                          >
                            {n.title}
                          </span>
                          {n.severity !== "info" && (
                            <span
                              className={`rounded-[4px] border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase shrink-0 ${
                                n.severity === "urgent"
                                  ? "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                  : "border-[var(--border)] bg-[var(--accent)] text-[var(--foreground)]"
                              }`}
                            >
                              {n.severity === "urgent" ? "Urgent" : "Action Required"}
                            </span>
                          )}
                          {!n.is_read && (
                            <span className="rounded-[4px] border border-[var(--border)] bg-[var(--card)] px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase text-[var(--foreground)] shrink-0">
                              New
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-[10px] text-[var(--muted-foreground)] shrink-0">
                          {new Date(n.created_at).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}{" "}
                          • {formatTimeAgo(n.created_at)}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                        {n.message}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};
