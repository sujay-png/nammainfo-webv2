import React from "react";
import { Building2, Package, UserPlus, LogOut } from "lucide-react";

interface AdminSidebarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  onSignOut?: () => void;
  ordersPendingCount?: number;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  currentTab,
  onTabChange,
  onSignOut,
  ordersPendingCount = 0,
}) => {
  return (
    <aside className="flex flex-col w-64 h-screen border-r border-[var(--border)] bg-[var(--card)] p-5 shrink-0 justify-between select-none">
      {/* Top / Nav Area */}
      <div>
        {/* Brand */}
        <div className="pb-6 border-b border-[var(--border)]">
          <h1 className="font-headline text-base font-bold text-[var(--foreground)] tracking-tight">
            Namma Info
          </h1>
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] block mt-0.5">
            Admin Console
          </span>
        </div>

        {/* Navigation Links */}
        <nav className="mt-6 space-y-1">
          {/* Companies & Subscriptions */}
          <button
            onClick={() => onTabChange("overview")}
            className={`flex w-full items-center gap-3 rounded-[5px] px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
              currentTab === "overview"
                ? "bg-[var(--foreground)] text-[var(--background)]"
                : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
            }`}
          >
            <Building2 size={15} />
            <span>Companies & Subscriptions</span>
          </button>

          {/* Orders & Fulfillment */}
          <button
            onClick={() => onTabChange("orders")}
            className={`flex w-full items-center justify-between rounded-[5px] px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
              currentTab === "orders"
                ? "bg-[var(--foreground)] text-[var(--background)]"
                : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
            }`}
          >
            <div className="flex items-center gap-3">
              <Package size={15} />
              <span>Card Orders</span>
            </div>
            {ordersPendingCount > 0 && (
              <span className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                currentTab === "orders"
                  ? "bg-[var(--background)] text-[var(--foreground)]"
                  : "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/25"
              }`}>
                {ordersPendingCount}
              </span>
            )}
          </button>

          {/* Account Creation (Staff Management) */}
          <button
            onClick={() => onTabChange("staff")}
            className={`flex w-full items-center gap-3 rounded-[5px] px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
              currentTab === "staff"
                ? "bg-[var(--foreground)] text-[var(--background)]"
                : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
            }`}
          >
            <UserPlus size={15} />
            <span>Account Creation</span>
          </button>
        </nav>
      </div>

      {/* Footer / Log Out Only */}
      {onSignOut && (
        <div className="border-t border-[var(--border)] pt-4">
          <button
            onClick={onSignOut}
            className="flex w-full items-center justify-between rounded-[5px] border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs font-medium text-[var(--muted-foreground)] hover:text-red-600 dark:hover:text-red-400 hover:bg-[var(--accent)] transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <LogOut size={14} />
              <span>Log Out</span>
            </span>
          </button>
        </div>
      )}
    </aside>
  );
};
