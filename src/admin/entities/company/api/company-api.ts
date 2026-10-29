import type {
  Company,
  CompanyWithEmployees,
  AdminStats,
  AccountStatus,
} from "../model/types";

export interface CompaniesResponse {
  companies: Company[];
  stats: AdminStats;
}

export async function fetchAdminCompanies(): Promise<CompaniesResponse> {
  const res = await fetch("/api/admin/companies", {
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to load companies");
  }

  return res.json();
}

export async function fetchCompanyDetails(
  companyId: string
): Promise<CompanyWithEmployees> {
  const res = await fetch(`/api/admin/companies/${companyId}`, {
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to load company details");
  }

  const data = await res.json();
  return data.company;
}

export async function toggleCompanySuspension(
  companyId: string,
  targetStatus: AccountStatus
): Promise<{ success: boolean; status: AccountStatus }> {
  const res = await fetch(`/api/admin/companies/${companyId}/suspend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: targetStatus }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to toggle suspension status");
  }

  return res.json();
}

export async function deleteCompany(companyId: string): Promise<{ success: boolean }> {
  const res = await fetch(`/api/admin/companies/${companyId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to delete company");
  }

  return res.json();
}

export async function updateCompanyValidity(
  companyId: string,
  updates: {
    subscriptionStartedAt?: string | null;
    membershipExpiresAt?: string | null;
    primaryCardCount?: number;
    purchasedIdCount?: number;
    subscriptionPlan?: string;
  }
): Promise<{ success: boolean }> {
  const res = await fetch(`/api/admin/companies/${companyId}/validity`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to update validity and plan");
  }

  return res.json();
}

export async function updateEmployeeValidity(
  employeeId: string,
  updates: {
    isPremium?: boolean;
    subscriptionStartedAt?: string | null;
    subscriptionExpiresAt?: string | null;
    status?: string;
  }
): Promise<{ success: boolean }> {
  const res = await fetch(`/api/admin/employees/${employeeId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to update employee");
  }

  return res.json();
}

export async function updateCompanyFollowUp(
  companyId: string,
  updates: {
    status?: "unattended" | "attended";
    notes?: string;
  }
): Promise<{ success: boolean }> {
  const res = await fetch(`/api/admin/companies/${companyId}/followup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to update follow-up");
  }

  return res.json();
}

export async function bulkUpdateEmployees(
  companyId: string,
  action: "set_pro" | "set_lifetime" | "set_free",
  daysRemaining?: number,
  employeeIds?: string[]
): Promise<{ success: boolean }> {
  const res = await fetch(`/api/admin/companies/${companyId}/validity`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subscriptionPlan:
        action === "set_pro" ? "pro" : action === "set_lifetime" ? "lifetime" : "free",
    }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to update employee plan");
  }

  return res.json();
}

/* ------------------------------------------------------------------ */
/*  Free Trial APIs (100 Days, Custom Extensions, Milestones)          */
/* ------------------------------------------------------------------ */

export async function approveFreeTrial(
  companyId: string
): Promise<{ success: boolean; membershipExpiresAt: string; message: string }> {
  const res = await fetch("/api/admin/trial/approve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ companyId }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to approve Free Trial");
  }

  return res.json();
}

export async function extendFreeTrial(
  companyId: string,
  extensionDays: number
): Promise<{ success: boolean; newExpiry: string; totalExtensionDays: number; message: string }> {
  const res = await fetch("/api/admin/trial/extend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ companyId, extensionDays }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to extend Free Trial");
  }

  return res.json();
}

export async function updateTrialFollowUp(
  companyId: string,
  updates: {
    status?: "unattended" | "attended";
    notes?: string;
    milestone?: number;
  }
): Promise<{ success: boolean }> {
  const res = await fetch("/api/admin/trial/follow-up", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ companyId, ...updates }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to update trial follow-up");
  }

  return res.json();
}

export async function rejectFreeTrial(
  companyId: string,
  reason?: string
): Promise<{ success: boolean }> {
  const res = await fetch("/api/admin/trial/reject", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ companyId, reason }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to reject Free Trial");
  }

  return res.json();
}
