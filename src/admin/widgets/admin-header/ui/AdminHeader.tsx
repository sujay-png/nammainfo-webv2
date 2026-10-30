"use client";

import React from "react";
import { RefreshCw } from "lucide-react";
import { AdminThemeToggle } from "@/admin/shared/ui/AdminThemeToggle";

interface AdminHeaderProps { 
  onRefresh: () => void;
  loading: boolean;
  totalCompaniesCount: number;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({
  onRefresh,
  loading,
  totalCompaniesCount,
}) => {
  return (
    <header className="sticky top-0 z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-[var(--border)] bg-[var(--card)] px-6 py-4 gap-3 shrink-0">
      <div>
        <h2 className="font-headline text-lg font-bold text-[var(--foreground)]">
          Administration Portal
        </h2>
        <p className="text-xs text-[var(--muted-foreground)]">
          Manage subscriptions and account access controls.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <AdminThemeToggle />

        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-[5px] border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          <span>Refresh</span>
        </button>
      </div>
    </header>
  );
};

