import Link from "next/link";
import { Building2, ChevronRight, MapPin } from "lucide-react";
import type { BranchSummary } from "../types";
import { branchPath, profilePath } from "../lib/paths";

/**
 * "Our Branches" on a public card: the head office plus every branch,
 * each a link to its own page. The page being viewed is marked.
 */
export default function PublicBranches({
  handle,
  branches,
  currentId,
  mainLabel = "Main office",
  mainCity,
}: {
  handle: string;
  branches: BranchSummary[];
  /** The branch being viewed, or null on the main profile. */
  currentId: string | null;
  mainLabel?: string;
  mainCity?: string | null;
}) {
  const rows = [
    { id: null as string | null, name: mainLabel, city: mainCity ?? null, href: profilePath(handle), main: true },
    ...branches.map((b) => ({ id: b.id, name: b.name, city: b.city, href: branchPath(handle, b.slug), main: false })),
  ];

  return (
    <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
      {rows.map((r) => {
        const here = r.id === currentId;
        const showCity = r.city && r.city.trim().toLowerCase() !== r.name.trim().toLowerCase();
        return (
          <li key={r.id ?? "main"}>
            <Link
              href={r.href}
              aria-current={here ? "page" : undefined}
              className={`flex items-center gap-3 px-3.5 py-3 transition ${here ? "bg-[var(--accent)]" : "hover:bg-[var(--accent)]"}`}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-[var(--foreground)]">
                {r.main ? <Building2 size={16} /> : <MapPin size={16} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-[var(--foreground)]">{r.name}</span>
                {showCity && (
                  <span className="block truncate text-xs text-[var(--muted-foreground)]">{r.city}</span>
                )}
              </span>
              {here ? (
                <span className="shrink-0 rounded-full bg-[var(--foreground)] px-2 py-0.5 text-[10px] font-semibold text-[var(--background)]">
                  You&apos;re here
                </span>
              ) : (
                <ChevronRight size={16} className="shrink-0 text-[var(--muted-foreground)]" />
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
