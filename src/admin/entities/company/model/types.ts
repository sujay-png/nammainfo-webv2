import type { Profile } from "@/lib/supabase/types";
import type { AdminEmployee } from "../../employee/model/types";

export type AccountStatus = "active" | "suspended" | "expired" | "pending";
export type SubscriptionPlanType = "free" | "pro";

export interface Company {
  id: string;
  businessName: string;
  ownerName: string;
  email: string | null;
  phone: string | null;
  phoneNumber?: string | null;
  username: string | null;
  slug: string;
  status: AccountStatus;
  subscriptionPlan: SubscriptionPlanType;
  primaryCardCount: number;
  purchasedIdCount: number;
  assignedIdCount: number;
  totalCardsIssued: number;
  subscriptionStartedAt: string | null;
  membershipExpiresAt: string | null;
  createdAt: string;
  avatarUrl: string | null;
  logoUrl: string | null;
  followUpStatus?: "unattended" | "attended" | null;
  followUpNotes?: string | null;
}

export interface CompanyWithEmployees extends Company {
  employees: AdminEmployee[];
}

export type CompanyFilterTab = "all" | "pro" | "expired";

export interface CompanyFilters {
  search: string;
  tab: CompanyFilterTab;
}

export interface AdminStats {
  totalCardsInUse: number;
  upcomingRenewalsCount: number;
  expiredCardsCount: number;
  lostCardsCount: number;
  totalCompanies: number;
  premiumCompaniesCount: number;
  totalCardsIssued: number;
  totalPrimaryCards: number;
  totalEmployeeIds: number;
  totalPurchasedIds: number;
  totalAssignedIds: number;
  expiringSoonCount: number;
  suspendedCount: number;
}
