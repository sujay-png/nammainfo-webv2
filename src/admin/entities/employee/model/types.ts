export type EmployeeIdStatus = "active" | "suspended" | "unassigned";

export interface AdminEmployee {
  id: string;
  ownerId: string;
  name: string;
  designation: string;
  email: string | null;
  phone: string | null;
  slug: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  isActive: boolean;
  isPremium: boolean;
  subscriptionStartedAt: string | null;
  subscriptionExpiresAt: string | null;
  status: EmployeeIdStatus;
  createdAt: string;
}
