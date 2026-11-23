import { ArrowUpRight, FileText, Link2 } from "lucide-react";
import type { CustomButton, CustomLink } from "../types";

/** Up to 3 owner-made buttons at the top of the card, under "Add to Contacts". */
export function PublicCustomLinks({ items }: { items: CustomLink[] }) {
  if (!items.length) return null;
  const cols = items.length === 1 ? "grid-cols-1" : items.length === 2 ? "grid-cols-2" : "grid-cols-3";
  return (
    <div className={`mt-2 grid ${cols} gap-2 px-5`}>
      {items.map((l) => (
        <a
          key={l.id}
          href={l.url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="flex min-w-0 items-center justify-center gap-1.5 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-2 py-3 text-xs font-semibold text-[var(--foreground)] shadow-card transition hover:shadow-card-hover"
        >
          <span className="truncate">{l.label}</span>
          <ArrowUpRight size={13} className="shrink-0 text-[var(--muted-foreground)]" />
        </a>
      ))}
    </div>
  );
}

/** Custom buttons (Menu, Price list…) in "Downloads & Actions", same style as the Brochure button. */
export function PublicCustomButtons({ items }: { items: CustomButton[] }) {
  return (
    <>
      {items.map((b) => (
        <a
          key={b.id}
          href={b.url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="flex min-w-0 items-center gap-2.5 rounded-xl border border-[var(--border)] px-3 py-3 transition hover:bg-[var(--accent)]"
        >
          {b.kind === "file" ? (
            <FileText size={16} className="shrink-0 text-[var(--muted-foreground)]" />
          ) : (
            <Link2 size={16} className="shrink-0 text-[var(--muted-foreground)]" />
          )}
          <span className="truncate text-xs font-medium text-[var(--foreground)]">{b.label}</span>
        </a>
      ))}
    </>
  );
}
