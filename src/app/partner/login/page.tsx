import { Metadata } from "next";
import { PartnerLoginView } from "@/features/partner/components/PartnerLoginView";

export const metadata: Metadata = {
  title: "Partner Sign In · Namma Info",
  description: "Sign in to your Namma Info Partner Program console.",
};

export default function PartnerLoginPage() {
  return <PartnerLoginView />;
}
