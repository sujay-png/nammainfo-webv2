import vCardsJS from "vcards-js";
import type { Profile } from "@/lib/supabase/types";
import { siteUrl } from "@/lib/deeplink";

/**
 * Builds a vCard 3.0 payload (vcards-js targets 3.0, which has the widest
 * compatibility across iOS Contacts, Android Contacts, and Outlook — 4.0
 * still has patchy support on stock Android).
 */
export function buildVCard(profile: Profile) {
  const card = vCardsJS();

  const [firstName, ...rest] = (profile.owner_name ?? "").trim().split(" ");
  card.firstName = firstName || profile.owner_name || "";
  card.lastName = rest.join(" ");
  card.organization = profile.business_name ?? "";
  card.title = profile.job_title ?? "";

  if (profile.phone) {
    card.workPhone = profile.phone;
    card.cellPhone = profile.phone;
  }
  if (profile.email) card.email = profile.email;
  if (profile.website) card.url = profile.website;
  if (profile.bio) card.note = profile.bio;
  if (profile.avatar_url) card.photo.attachFromUrl(profile.avatar_url, "JPEG");

  card.source = `${siteUrl}/p/${profile.slug}`;
  card.version = "3.0";

  return card.getFormattedString();
}

export function vcardFileName(profile: Profile) {
  const base = [profile.owner_name, profile.business_name]
    .filter(Boolean)
    .join(" - ")
    .replace(/[^a-z0-9 \-_.]/gi, "")
    .trim();
  return `${base || "nammainfo-contact"}.vcf`;
}
