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
 *   - A full Google Maps URL → opens the Maps page (has "Write a review" button)
 *   - A 0x...:0x... hex ID → opens Google Maps search for the place
 *
 * Only ChIJ... IDs work with Google's writereview endpoint.
 */
export function googleReviewUrl(placeId: string): string {
  // ChIJ... format → direct review form (the ideal case)
  if (placeId.startsWith("ChIJ")) {
    return `https://search.google.com/local/writereview?placeid=${placeId}`;
  }
  // Full Google Maps URL → open it directly
  if (placeId.startsWith("http")) {
    return placeId;
  }
  // 0x hex format → search on Google Maps (writereview doesn't support hex IDs)
  return `https://www.google.com/maps/place/?q=place_id:${placeId}`;
}
