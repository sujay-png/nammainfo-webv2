import type { Profile, SocialLink } from "@/supabase/database-types";
import type { Branch } from "../types";

const has = (v: string | null | undefined): v is string => typeof v === "string" && v.trim() !== "";

/**
 * Merges a branch into its owner's profile. The result is an ordinary
 * Profile, so PublicProfileView / EmployeeProfileView / the vCard builder
 * show a branch without knowing branches exist.
 *
 * Rules:
 * - Empty branch fields fall back to the main profile.
 * - Location is taken as a group: if the branch sets any of address,
 *   city, pincode or Maps link, all four come from the branch. (Mixing the
 *   branch's address with the head office's Maps pin would send people to
 *   the wrong city.)
 * - A branch contact person replaces the owner's name and title.
 * - A branch WhatsApp number replaces the WhatsApp entry in social links.
 * - services / products: NULL = main list; an array = the branch's own.
 */
export function applyBranch(profile: Profile, branch: Branch | null | undefined): Profile {
  if (!branch) return profile;

  const ownLocation = [branch.address, branch.city, branch.pincode, branch.maps_url].some(has);

  let social: SocialLink[] = (profile.social_links ?? []) as SocialLink[];
  if (has(branch.whatsapp)) {
    social = [
      ...social.filter((l) => !l.platform?.toLowerCase().includes("whatsapp")),
      { platform: "WhatsApp", url: branch.whatsapp.trim() },
    ];
  }

  return {
    ...profile,
    owner_name: has(branch.contact_person) ? branch.contact_person.trim() : profile.owner_name,
    job_title: has(branch.contact_person)
      ? has(branch.contact_title)
        ? branch.contact_title.trim()
        : null
      : profile.job_title,
    phone: has(branch.phone) ? branch.phone : profile.phone,
    email: has(branch.email) ? branch.email : profile.email,
    address: ownLocation ? branch.address : profile.address,
    city: ownLocation ? branch.city : profile.city,
    pincode: ownLocation ? branch.pincode : profile.pincode,
    maps_url: ownLocation ? branch.maps_url : profile.maps_url,
    google_place_id: has(branch.google_place_id) ? branch.google_place_id : profile.google_place_id,
    cover_url: has(branch.cover_url) ? branch.cover_url : profile.cover_url,
    logo_url: has(branch.logo_url) ? branch.logo_url : profile.logo_url,
    services: Array.isArray(branch.services) ? branch.services : profile.services,
    products: Array.isArray(branch.products) ? branch.products : profile.products,
    social_links: social,
  };
}
