import { Quote, Star } from "lucide-react";
import type { Testimonial } from "../types";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

/** Testimonials on the public card page: a swipeable row of quote cards. */
export default function PublicTestimonials({ items }: { items: Testimonial[] }) {
  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
      {items.map((t) => (
        <figure
          key={t.id}
          className="flex w-[82%] max-w-[300px] shrink-0 snap-start flex-col rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4"
        >
          <div className="flex items-center justify-between">
            {t.rating ? (
              <span className="flex gap-0.5" aria-label={`${t.rating} out of 5 stars`}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    size={13}
                    className={n <= t.rating! ? "fill-amber-400 text-amber-400" : "text-[var(--border)]"}
                  />
                ))}
              </span>
            ) : (
              <span />
            )}
            <Quote size={18} className="text-[var(--muted-foreground)] opacity-40" aria-hidden />
          </div>

          <blockquote className="mt-3 flex-1 whitespace-pre-line text-sm leading-relaxed text-[var(--foreground)]">
            {t.quote}
          </blockquote>

          <figcaption className="mt-4 flex items-center gap-3">
            {t.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={t.photo_url}
                alt={t.name}
                loading="lazy"
                className="h-10 w-10 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] font-headline text-sm font-semibold text-[var(--muted-foreground)]">
                {initials(t.name)}
              </span>
            )}
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-[var(--foreground)]">{t.name}</span>
              {t.role && (
                <span className="block truncate text-xs text-[var(--muted-foreground)]">{t.role}</span>
              )}
            </span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
