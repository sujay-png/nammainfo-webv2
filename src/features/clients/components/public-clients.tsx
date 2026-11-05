import { ArrowUpRight } from "lucide-react";
import type { ClientItem } from "../types";

/**
 * "Our Clients" on the public card page: a grid of logos. A client with a
 * website opens it in a new tab when tapped; others are just shown.
 */
export default function PublicClients({ items }: { items: ClientItem[] }) {
  return (
    <ul className="grid grid-cols-3 gap-2">
      {items.map((c) => {
        const body = (
          <>
            <span className="flex h-12 w-full items-center justify-center">
              {c.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.logo_url} alt={c.name} loading="lazy" className="max-h-12 max-w-full object-contain" />
              ) : (
                <span className="line-clamp-2 text-center font-headline text-xs font-semibold leading-tight text-neutral-900">
                  {c.name}
                </span>
              )}
            </span>
            <span className="mt-1.5 flex w-full items-center justify-center gap-0.5 text-[10px] text-neutral-500">
              <span className="truncate">{c.name}</span>
              {c.website && <ArrowUpRight size={10} className="shrink-0" aria-hidden />}
            </span>
          </>
        );
        const cls =
          "flex h-full flex-col items-center justify-between rounded-xl border border-[var(--border)] bg-white p-2.5";
        return (
          <li key={c.id}>
            {c.website ? (
              <a
                href={c.website}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className={`${cls} transition active:scale-[0.98] hover:border-[var(--foreground)]/30`}
                aria-label={`${c.name} (opens their website)`}
              >
                {body}
              </a>
            ) : (
              <div className={cls}>{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
