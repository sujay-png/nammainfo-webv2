import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Partner Program · Namma Info",
  description: "Track referrals, coupon codes, and rewards in the Partner Console.",
};

export default function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
