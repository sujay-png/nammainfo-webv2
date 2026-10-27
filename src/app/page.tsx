import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Namma Info | NFC business cards that open your profile in one tap" },
  description:
    "Hold your Namma Info card near any phone and your profile opens: call, WhatsApp, directions, save contact. No app needed. Cards for you and your whole team.",
  openGraph: {
    title: "Namma Info | One tap and they have your number",
    description: "NFC business cards for Indian businesses. No app needed to open.",
    url: "/",
    siteName: "Namma Info",
    type: "website",
  },
};

export { default } from "@/features/landing/components/landing-page";
