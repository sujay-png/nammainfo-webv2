"use client";

import React from "react";
import { Phone, Mail, ExternalLink, CalendarX, User } from "lucide-react";
import { formatDate } from "@/admin/shared/lib/formatters";
import type { Company } from "@/admin/entities/company/model/types";

interface ExpiredCardsTableProps {
  companies: Company[];
  loading: boolean;
  onSelectCompany: (company: Company) => void;
}

export const ExpiredCardsTable: React.FC<ExpiredCardsTableProps> = ({
  companies,
  loading,
  onSelectCompany,
}) => {
  // Filter companies whose card/subscription has expired
  const expiredList = companies.filter((c) => {
    if (c.subscriptionPlan === "free") return false;
    if (c.membershipExpiresAt) {
      return new Date(c.membershipExpiresAt).getTime() <= Date.now();
    }
    return c.status === "expired";
  });

  const handleOpenUserUrl = (company: Company, e: React.MouseEvent) => {
    e.stopPropagation();
    const targetUrl = company.username ? `/${company.username}` : `/${company.slug}`;
    window.open(targetUrl, "_blank");
  };

  if (loading) {
    return (
      <div className="space-y-3 rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-6">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex h-14 animate-pulse items-center justify-between rounded-[5px] bg-[var(--accent)] px-4"
          />
        ))}
      </div>
    );
  }

  if (expiredList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-[5px] border border-dashed border-[var(--border)] bg-[var(--card)] py-16 text-center">
        <CalendarX size={36} className="text-[var(--muted-foreground)] opacity-40 mb-3" />
        <h4 className="font-headline text-base font-semibold text-[var(--foreground)]">
          No Expired Cards
        </h4>
        <p className="mt-1 text-xs text-[var(--muted-foreground)] max-w-sm">
          No company card subscriptions are currently in an expired state.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[5px] border border-[var(--border)] bg-[var(--card)]">
      <div className="border-b border-[var(--border)] bg-[var(--accent)]/30 px-5 py-3 flex items-center justify-between">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--foreground)]">
            Expired Cards Registry
          </h3>
          <p className="text-[11px] text-[var(--muted-foreground)]">
            {expiredList.length} cardholder{expiredList.length === 1 ? "" : "s"} with expired memberships (Click row or URL link to view profile)
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[var(--border)] bg-[var(--accent)]/50 font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
            <tr>
              <th scope="col" className="px-5 py-3">User & Profile URL</th>
              <th scope="col" className="px-4 py-3">Company Name</th>
              <th scope="col" className="px-4 py-3">Contact Details</th>
              <th scope="col" className="px-4 py-3">Expired On</th>
              <th scope="col" className="px-5 py-3 text-right">Card Access</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {expiredList.map((company) => {
              const profilePath = company.username ? `/${company.username}` : `/${company.slug}`;

              return (
                <tr
                  key={company.id}
                  onClick={(e) => handleOpenUserUrl(company, e)}
                  className="cursor-pointer transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800/50"
                >
                  {/* Name & Public URL */}
                  <td className="px-5 py-3.5">
                    <div className="flex flex-col">
                      <span className="font-semibold text-sm text-[var(--foreground)] flex items-center gap-1.5">
                        {company.ownerName || "Card User"}
                        <ExternalLink size={12} className="text-[var(--muted-foreground)]" />
                      </span>
                      <span className="font-mono text-[11px] text-[var(--muted-foreground)] mt-0.5">
                        namma.info{profilePath}
                      </span>
                    </div>
                  </td>

                  {/* Company Name */}
                  <td className="px-4 py-3.5">
                    <span className="font-medium text-[var(--foreground)] block">
                      {company.businessName}
                    </span>
                    <span className="font-mono text-[10px] text-[var(--muted-foreground)]">
                      Joined {formatDate(company.createdAt)}
                    </span>
                  </td>

                  {/* Contact Details */}
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
                      {company.phoneNumber ? (
                        <a
                          href={`tel:${company.phoneNumber}`}
                          className="flex items-center gap-1.5 text-xs font-medium text-[var(--foreground)] hover:underline transition-colors"
                        >
                          <Phone size={12} className="text-[var(--muted-foreground)] shrink-0" />
                          <span>{company.phoneNumber}</span>
                        </a>
                      ) : (
                        <span className="text-[11px] text-[var(--muted-foreground)]">No phone</span>
                      )}

                      {company.email && (
                        <a
                          href={`mailto:${company.email}`}
                          className="flex items-center gap-1.5 text-[11px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors truncate max-w-[170px]"
                        >
                          <Mail size={11} className="text-[var(--muted-foreground)] shrink-0" />
                          <span className="truncate">{company.email}</span>
                        </a>
                      )}
                    </div>
                  </td>

                  {/* Expired On */}
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <span className="font-mono text-xs text-rose-600 dark:text-rose-400 font-medium">
                      {company.membershipExpiresAt ? formatDate(company.membershipExpiresAt) : "Expired"}
                    </span>
                  </td>

                  {/* Public Link Action */}
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(e) => handleOpenUserUrl(company, e)}
                        className="inline-flex items-center gap-1.5 rounded-[5px] border border-[var(--border)] bg-[var(--background)] px-2.5 py-1 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors"
                      >
                        <ExternalLink size={12} />
                        <span>View Card URL</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onSelectCompany(company)}
                        className="inline-flex items-center gap-1 rounded-[5px] border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors"
                      >
                        Details
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
