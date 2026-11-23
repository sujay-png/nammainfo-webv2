import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Campaign Manager · Namma Info",
  description: "Track referrals, coupon codes, and rewards.",
};

export default function CampaignLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
