import React from "react";
import {
  Users,
  Trash2,
  ChevronRight,
  Phone,
} from "lucide-react";
import { formatDate, getDaysRemaining } from "@/admin/shared/lib/formatters";
import { Badge } from "@/admin/shared/ui/Badge";
import type { Company, SubscriptionPlanType } from "@/admin/entities/company/model/types";

interface CompaniesTableProps {
  companies: Company[];
  loading: boolean;
  onSelectCompany: (company: Company) => void;
  onDeleteCompany: (company: Company, e: React.MouseEvent) => void;
  onQuickPlanChange?: (company: Company, newPlan: SubscriptionPlanType) => void;
}

export const CompaniesTable: React.FC<CompaniesTableProps> = ({
  companies,
  loading,
  onSelectCompany,
  onDeleteCompany,
  onQuickPlanChange,
}) => {
  if (loading) {
    return (
      <div className="space-y-3 rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-6">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="flex h-14 animate-pulse items-center justify-between rounded-[5px] bg-[var(--accent)] px-4"
          />
        ))}
      </div>
    );
  }

  if (companies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-[5px] border border-dashed border-[var(--border)] bg-[var(--card)] py-16 text-center">
        <Users size={36} className="text-[var(--muted-foreground)] opacity-40 mb-3" />
        <h4 className="font-headline text-base font-semibold text-[var(--foreground)]">
          No companies found
        </h4>
        <p className="mt-1 text-xs text-[var(--muted-foreground)] max-w-sm">
          No companies match your search or filter parameters.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[5px] border border-[var(--border)] bg-[var(--card)]">
      {/* Desktop Table */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[var(--border)] bg-[var(--accent)]/50 font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
            <tr>
              <th scope="col" className="px-5 py-3">Company & Owner</th>
              <th scope="col" className="px-4 py-3">Phone Number</th>
              <th scope="col" className="px-4 py-3">Plan Tier</th>
              <th scope="col" className="px-4 py-3">Member Since</th>
              <th scope="col" className="px-4 py-3">Validity</th>
              <th scope="col" className="px-4 py-3">Status</th>
              <th scope="col" className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {companies.map((company) => {
              const validity = getDaysRemaining(company.membershipExpiresAt, company.subscriptionPlan);
              const isExpired =
                (company.subscriptionPlan === "pro" || company.subscriptionPlan === "trial") &&
                !validity.isLifetime &&
                (validity.isExpired || (company.status === "expired" && !company.membershipExpiresAt));

              return (
                <tr
                  key={company.id}
                  onClick={() => onSelectCompany(company)}
                  className="cursor-pointer transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800/50"
                >
                  {/* Company & Owner */}
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[5px] bg-[var(--accent)] font-headline text-xs font-bold text-[var(--foreground)] border border-[var(--border)]">
                        {company.avatarUrl ? (
                          <img
                            src={company.avatarUrl}
                            alt=""
                            className="h-full w-full rounded-[5px] object-cover"
                          />
                        ) : (
                          company.businessName.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate font-semibold text-[var(--foreground)]">
                            {company.businessName}
                          </p>
                          {company.username && (
                            <span className="font-mono text-[10px] text-[var(--muted-foreground)]">
                              @{company.username}
                            </span>
                          )}
                        </div>
                        <p className="truncate text-[11px] text-[var(--muted-foreground)]">
                          {company.ownerName}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Phone Number */}
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    {company.phoneNumber || company.phone ? (
                      <a
                        href={`tel:${company.phoneNumber || company.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1.5 text-xs font-medium text-[var(--foreground)] hover:underline transition-colors"
                      >
                        <Phone size={12} className="text-[var(--muted-foreground)] shrink-0" />
                        <span>{company.phoneNumber || company.phone}</span>
                      </a>
                    ) : (
                      <span className="text-[11px] text-[var(--muted-foreground)]">—</span>
                    )}
                  </td>

                  {/* Plan Tier - Pro in Gold, Free Trial in Sky, Free in Neutral (1-click changer) */}
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    {onQuickPlanChange ? (
                      <div onClick={(e) => e.stopPropagation()} className="inline-block">
                        <select
                          value={company.subscriptionPlan}
                          onChange={(e) =>
                            onQuickPlanChange(company, e.target.value as SubscriptionPlanType)
                          }
                          className={`rounded-[4px] px-2 py-1 text-xs font-semibold cursor-pointer border transition-colors outline-none ${
                            company.subscriptionPlan === "pro"
                              ? "bg-amber-500/10 text-[#D4AF37] dark:text-[#F3C95F] border-amber-500/30"
                              : company.subscriptionPlan === "trial"
                              ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30"
                              : "bg-[var(--accent)] text-[var(--muted-foreground)] border-[var(--border)]"
                          }`}
                          title="Click to instantly change plan tier"
                        >
                          <option value="free" className="bg-[var(--card)] text-[var(--foreground)]">Free Tier</option>
                          <option value="trial" className="bg-[var(--card)] text-[var(--foreground)]">Free Trial (100d)</option>
                          <option value="pro" className="bg-[var(--card)] text-[var(--foreground)]">Pro Plan (1y)</option>
                        </select>
                      </div>
                    ) : (
                      <Badge
                        variant={
                          company.subscriptionPlan === "pro"
                            ? "pro"
                            : company.subscriptionPlan === "trial"
                            ? "trial"
                            : "free"
                        }
                      >
                        {company.subscriptionPlan === "pro"
                          ? "Pro"
                          : company.subscriptionPlan === "trial"
                          ? "Free Trial"
                          : "Free"}
                      </Badge>
                    )}
                  </td>

                  {/* Member Since */}
                  <td className="px-4 py-3.5 font-mono text-[11px] text-[var(--muted-foreground)] whitespace-nowrap">
                    {formatDate(company.createdAt)}
                  </td>

                  {/* Validity (Days remaining only - no duplicate joining date) */}
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    {company.subscriptionPlan === "free" ? (
                      <span className="font-mono text-[11px] text-[var(--muted-foreground)]">
                        N/A
                      </span>
                    ) : (
                      <span
                        className={`font-mono text-xs font-medium ${
                          isExpired
                            ? "text-red-600 dark:text-red-400"
                            : validity.isEndingSoon
                            ? "text-amber-500 dark:text-amber-400"
                            : "text-[var(--foreground)]"
                        }`}
                      >
                        {isExpired ? "Expired" : validity.label}
                      </span>
                    )}
                  </td>

                  {/* Status (Dynamic: Active / Renew / Expired / N/A) */}
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    {company.subscriptionPlan === "free" ? (
                      <Badge variant="na">N/A</Badge>
                    ) : isExpired ? (
                      <Badge variant="expired">Expired</Badge>
                    ) : validity.isEndingSoon ? (
                      <Badge variant="renew">Renew</Badge>
                    ) : (
                      <Badge variant="active">Active</Badge>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-3.5 text-right whitespace-nowrap">
                    <div
                      className="flex items-center justify-end gap-1.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={(e) => onDeleteCompany(company, e)}
                        title="Delete Company"
                        className="rounded-[5px] p-1.5 text-[var(--muted-foreground)] hover:text-red-600 hover:bg-[var(--accent)] transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>

                      <button
                        onClick={() => onSelectCompany(company)}
                        className="rounded-[5px] p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] transition-colors"
                        title="Manage Company & Team"
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
        {companies.map((company) => {
          const validity = getDaysRemaining(company.membershipExpiresAt, company.subscriptionPlan);
          const isExpired =
            (company.subscriptionPlan === "pro" || company.subscriptionPlan === "trial") &&
            !validity.isLifetime &&
            (validity.isExpired || (company.status === "expired" && !company.membershipExpiresAt));

          return (
            <div
              key={company.id}
              onClick={() => onSelectCompany(company)}
              className="p-3.5 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800/50 cursor-pointer space-y-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[5px] bg-[var(--accent)] font-headline text-xs font-bold border border-[var(--border)]">
                    {company.businessName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-xs text-[var(--foreground)] truncate">
                      {company.businessName}
                    </p>
                    <p className="text-[11px] text-[var(--muted-foreground)] truncate">
                      {company.ownerName}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {onQuickPlanChange ? (
                    <div onClick={(e) => e.stopPropagation()}>
                      <select
                        value={company.subscriptionPlan}
                        onChange={(e) =>
                          onQuickPlanChange(company, e.target.value as SubscriptionPlanType)
                        }
                        className={`rounded-[4px] px-2 py-0.5 text-[11px] font-semibold cursor-pointer border transition-colors outline-none ${
                          company.subscriptionPlan === "pro"
                            ? "bg-amber-500/10 text-[#D4AF37] dark:text-[#F3C95F] border-amber-500/30"
                            : company.subscriptionPlan === "trial"
                            ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30"
                            : "bg-[var(--accent)] text-[var(--muted-foreground)] border-[var(--border)]"
                        }`}
                      >
                        <option value="free" className="bg-[var(--card)] text-[var(--foreground)]">Free</option>
                        <option value="trial" className="bg-[var(--card)] text-[var(--foreground)]">Free Trial</option>
                        <option value="pro" className="bg-[var(--card)] text-[var(--foreground)]">Pro</option>
                      </select>
                    </div>
                  ) : (
                    <Badge
                      variant={
                        company.subscriptionPlan === "pro"
                          ? "pro"
                          : company.subscriptionPlan === "trial"
                          ? "trial"
                          : "free"
                      }
                    >
                      {company.subscriptionPlan === "pro"
                        ? "Pro"
                        : company.subscriptionPlan === "trial"
                        ? "Free Trial"
                        : "Free"}
                    </Badge>
                  )}
                  {company.subscriptionPlan === "free" ? (
                    <Badge variant="na">N/A</Badge>
                  ) : isExpired ? (
                    <Badge variant="expired">Expired</Badge>
                  ) : validity.isEndingSoon ? (
                    <Badge variant="renew">Renew</Badge>
                  ) : (
                    <Badge variant="active">Active</Badge>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 rounded-[5px] bg-[var(--accent)]/30 p-2 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-semibold text-[var(--muted-foreground)] block">
                    Phone
                  </span>
                  <span className="font-medium text-[var(--foreground)] text-[11px] truncate block">
                    {company.phoneNumber || company.phone || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-[var(--muted-foreground)] block">
                    Validity
                  </span>
                  {company.subscriptionPlan === "free" ? (
                    <span className="font-mono text-[11px] text-[var(--muted-foreground)] block">
                      N/A
                    </span>
                  ) : (
                    <span
                      className={`font-mono text-[11px] font-medium block truncate ${
                        isExpired
                          ? "text-red-600 dark:text-red-400"
                          : validity.isEndingSoon
                          ? "text-amber-500 dark:text-amber-400"
                          : "text-[var(--foreground)]"
                      }`}
                    >
                      {isExpired ? "Expired" : validity.label}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-0.5">
                <span className="font-mono text-[10px] text-[var(--muted-foreground)]">
                  Joined {formatDate(company.createdAt)}
                </span>
                <div
                  className="flex items-center gap-1.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={(e) => onDeleteCompany(company, e)}
                    className="rounded-[5px] border border-[var(--border)] px-2.5 py-0.5 text-[11px] text-red-600 hover:bg-[var(--accent)] transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
