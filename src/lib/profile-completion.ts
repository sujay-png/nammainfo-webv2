import type { Profile } from "@/lib/supabase/types";

export interface CompletionItem {
  id: string;
  label: string;
  done: boolean;
  href: string;
}

export function getProfileCompletionItems(profile: Profile | null): CompletionItem[] {
  if (!profile) return [];

  const hasServicesOrProducts = Boolean(
    (Array.isArray(profile.services) && profile.services.length > 0) ||
    (Array.isArray(profile.products) && profile.products.length > 0)
  );

  const hasSocial = Boolean(
    Array.isArray(profile.social_links) && profile.social_links.length > 0
  );

  return [
    { id: "business_name", label: "Business name", done: Boolean(profile.business_name?.trim()), href: "/dashboard/profile" },
    { id: "owner_name", label: "Owner / Contact name", done: Boolean(profile.owner_name?.trim()), href: "/dashboard/profile" },
    { id: "logo", label: "Business logo", done: Boolean(profile.logo_url?.trim()), href: "/dashboard/profile" },
    { id: "cover", label: "Cover banner photo", done: Boolean(profile.cover_url?.trim()), href: "/dashboard/profile" },
    { id: "bio", label: "Business bio / description", done: Boolean(profile.bio?.trim()), href: "/dashboard/profile" },
    { id: "phone", label: "Phone number", done: Boolean(profile.phone?.trim()), href: "/dashboard/profile" },
    { id: "email", label: "Email address", done: Boolean(profile.email?.trim()), href: "/dashboard/profile" },
    { id: "username", label: "Custom vanity username", done: Boolean(profile.username?.trim()), href: "/dashboard/profile" },
    { id: "address", label: "Business address (for card delivery)", done: Boolean(profile.address?.trim()), href: "/dashboard/profile" },
    { id: "services", label: "Products or services listed", done: hasServicesOrProducts, href: "/dashboard/profile" },
    { id: "social", label: "Social or WhatsApp links", done: hasSocial, href: "/dashboard/profile" },
  ];
}

export function calculateProfileCompletion(profile: Profile | null): {
  items: CompletionItem[];
  completedCount: number;
  totalCount: number;
  percentage: number;
  isComplete: boolean;
  missingItems: CompletionItem[];
} {
  const items = getProfileCompletionItems(profile);
  const totalCount = items.length;
  const completedCount = items.filter((i) => i.done).length;
  const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const isComplete = percentage === 100;
  const missingItems = items.filter((i) => !i.done);

  return {
    items,
    completedCount,
    totalCount,
    percentage,
    isComplete,
    missingItems,
  };
}
