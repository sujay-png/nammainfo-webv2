/**
 * Lightweight date distance — "2m ago", "3h ago", "5d ago" etc.
 * Avoids pulling in date-fns for a single helper.
 */
export function formatDistanceToNow(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const seconds = Math.floor((now - then) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

/**
 * Generate initials from a name — "Sujay Kumar" → "SK"
 */
export function initials(name: string | null | undefined): string {
  if (!name) return "NI";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase()).join("") || "NI";
}

/**
 * Slugify a string — "My Business Name" → "my-business-name"
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Build a Google review URL from a stored google_place_id value.
 *
 * The stored value can be:
 *   - A ChIJ... Place ID → opens the direct "Write a review" form
 *   - A full Google Maps URL → opens the Maps page with review dialog
 *
 * For Maps URLs, we extract the hex feature ID (0x...:0x...) and use
 * the #lrd fragment with action=3 to open the "Write a review" dialog.
 */
export function googleReviewUrl(placeId: string): string {
  // ChIJ... format → direct review form (the ideal case)
  if (placeId.startsWith("ChIJ")) {
    return `https://search.google.com/local/writereview?placeid=${placeId}`;
  }

  // Google Maps URL → extract feature ID and use #lrd trick to open review dialog
  if (placeId.startsWith("http")) {
    const featureMatch = placeId.match(/(0x[0-9a-fA-F]+:0x[0-9a-fA-F]+)/);
    if (featureMatch) {
      // Strip any existing hash, then append #lrd=FEATURE_ID,3 (3 = write a review)
      const baseUrl = placeId.split("#")[0];
      return `${baseUrl}#lrd=${featureMatch[1]},3,,,,`;
    }
    return placeId;
  }

  return `https://www.google.com/maps`;
}
