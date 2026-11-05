/** One customer testimonial, stored in profiles.testimonials (jsonb array). */
export interface Testimonial {
  id: string;
  /** Who said it, e.g. "Priya Rao". Required. */
  name: string;
  /** Optional: their role or company, e.g. "Interior designer, Udupi". */
  role?: string;
  /** What they said. Required, up to 500 characters. */
  quote: string;
  /** 1 to 5 stars. */
  rating?: number;
  /** Processed photo in the profile-media bucket. Optional. */
  photo_url?: string;
}

export const MAX_TESTIMONIALS = 20;
export const MAX_QUOTE = 500;

/** Keeps only well-formed testimonials (the column is edited from the browser). */
export function cleanTestimonials(value: unknown): Testimonial[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((t): t is Testimonial => !!t && typeof t === "object" && typeof t.name === "string" && typeof t.quote === "string")
    .filter((t) => t.name.trim() && t.quote.trim())
    .slice(0, MAX_TESTIMONIALS);
}
