import React from "react";
import { Search, X } from "lucide-react";
import type { OrderFilters, OrderFilterTab } from "@/admin/entities/order/model/types";

interface OrderFiltersBarProps {
  filters: OrderFilters;
  onChange: (filters: OrderFilters) => void;
  totalFiltered: number;
}

export const OrderFiltersBar: React.FC<OrderFiltersBarProps> = ({
  filters,
  onChange,
  totalFiltered,
}) => {
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...filters, search: e.target.value });
  };

  const handleTabChange = (tab: OrderFilterTab) => {
    onChange({ ...filters, tab });
  };

  const tabs: { id: OrderFilterTab; label: string }[] = [
    { id: "all", label: "All" },
    { id: "under_review", label: "Under Review" },
    { id: "on_work", label: "In Production" },
    { id: "delivered", label: "Delivered" },
  ];

  return (
    <div className="space-y-3 rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-4">
      {/* Search Input */}
      <div className="relative w-full">
        <Search
          size={16}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
        />
        <input
          type="text"
          placeholder="Search by Order ID, company name, phone, city, or payment ID..."
          value={filters.search}
          onChange={handleSearchChange}
          className="w-full rounded-[5px] border border-[var(--border)] bg-[var(--background)] py-2 pl-10 pr-10 text-xs text-[var(--foreground)] placeholder-[var(--muted-foreground)] outline-none transition focus:border-[var(--foreground)]"
        />
        {filters.search && (
          <button
            onClick={() => onChange({ ...filters, search: "" })}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-[5px] p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Filter Tabs & Count */}
      <div className="flex flex-wrap items-center justify-between border-t border-[var(--border)]/60 pt-3 gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
            Status:
          </span>
          {tabs.map((tab) => {
            const isSelected = filters.tab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`rounded-[5px] px-3 py-1 text-xs font-medium transition-all ${
                  isSelected
                    ? "bg-[var(--foreground)] text-[var(--background)]"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="font-mono text-xs text-[var(--muted-foreground)]">
          Showing <span className="font-semibold text-[var(--foreground)]">{totalFiltered}</span> {totalFiltered === 1 ? "order" : "orders"}
        </div>
      </div>
    </div>
  );
};
