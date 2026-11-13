"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Bookmark,
  ChevronRight,
  IdCard,
  Mail,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  UserRound,
  UserPlus,
  MoreVertical,
  Upload,
  Loader2,
  Camera,
} from "lucide-react";
import { createClient } from "@/supabase/client";
import { useAccount } from "@/hooks/use-account";
import { flushPendingSaves, readSavedCache, writeSavedCache, type SavedCardSummary } from "@/features/saved-cards/services/saved-cards.service";
import type { ContactRow } from "@/supabase/database-types";
import { formatDistanceToNow } from "@/lib/utils";
import Avatar from "@/components/ui/avatar";
import Sheet, { ui } from "@/components/ui/sheet";
import { deleteCardPhotos, getCardPhotoUrls } from "@/features/contacts/services/business-card-upload.service";
import { listMyBranches } from "@/features/branches/services/branches.service";
import type { Branch } from "@/features/branches/types";
import { saveContactFromUrl } from "@/features/save-contact/lib/save-contact";

/* ------------------------------------------------------------------ */
/*  Saved: two tabs                                                     */
/*   - Saved cards: Namma Info cards you (or your team) tapped           */
/*   - Contacts: people who shared their name + number on your cards     */
/*  Owners also get a "who" filter: Everyone / Me / each team member.    */
/* ------------------------------------------------------------------ */

const DEFAULT_CATEGORIES = ["New", "Customer", "Lead", "Supplier", "Partner", "Personal"];
const PROFILE_FIELDS = "id, owner_name, business_name, job_title, logo_url, avatar_url, username, slug";

type SavedItem = SavedCardSummary & { saved_by: string | null }; // null = me
type TeamMember = { id: string; name: string };

function waLink(phone: string) {
  const d = phone.replace(/[^0-9]/g, "");
  return `https://wa.me/${d.length === 10 ? `91${d}` : d}`;
}

function SavedInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { loading: accountLoading, userId, role } = useAccount();
  const isOwner = role === "owner";

  type SortOption = "recent" | "az" | "za";

  const [tab, setTab] = useState<"cards" | "contacts">(params.get("tab") === "contacts" ? "contacts" : "cards");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [who, setWho] = useState<string>("all"); // all | me | <employee id>
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchFilter, setBranchFilter] = useState<string>("all"); // all | main | <branch id>

  const [cards, setCards] = useState<SavedItem[]>([]);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [category, setCategory] = useState<string>("All");
  const [savedCardCategory, setSavedCardCategory] = useState<string>("All");
  const [openContact, setOpenContact] = useState<ContactRow | null>(null);
  const [categorizingCard, setCategorizingCard] = useState<SavedItem | null>(null);

  function switchTab(t: "cards" | "contacts") {
    setTab(t);
    setCategory("All");
    setSavedCardCategory("All");
    router.replace(t === "contacts" ? "/dashboard/saved?tab=contacts" : "/dashboard/saved", { scroll: false });
  }

  /* ---------- load saved cards ---------- */
  useEffect(() => {
    if (accountLoading || !userId) return;
    let cancelled = false;
    (async () => {
      const cached = readSavedCache(userId);
      if (cached) {
        setCards(cached.map((c) => ({ ...c, saved_by: null })));
        setCardsLoading(false);
      }
      await flushPendingSaves();
      const supabase = createClient();

      const [{ data: mine }, teamRes, membersRes] = await Promise.all([
        supabase.from("connections").select("connected_user_id, created_at, category").eq("user_id", userId).order("created_at", { ascending: false }),
        isOwner ? supabase.rpc("team_saved_cards") : Promise.resolve({ data: [] }),
        isOwner ? supabase.from("employees").select("id, name, user_id").eq("owner_id", userId).order("created_at") : Promise.resolve({ data: [] }),
      ]);
      const mineRows = (mine ?? []) as { connected_user_id: string; created_at: string; category?: string | null }[];
      const teamRows = ((teamRes.data ?? []) as { employee_id: string; employee_name: string; connected_user_id: string; saved_at: string; category?: string | null }[]) ?? [];
      const members = ((membersRes.data ?? []) as { id: string; name: string; user_id: string | null }[]).filter((m) => m.user_id);
      if (!cancelled) setTeam(members.map((m) => ({ id: m.id, name: m.name })));

      const ids = Array.from(new Set([...mineRows.map((r) => r.connected_user_id), ...teamRows.map((r) => r.connected_user_id)]));
      let byId = new Map<string, Omit<SavedCardSummary, "saved_at">>();
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select(PROFILE_FIELDS).in("id", ids);
        byId = new Map(((profs ?? []) as Omit<SavedCardSummary, "saved_at">[]).map((p) => [p.id, p]));
      }
      const mineItems: SavedItem[] = mineRows
        .map((r) => (byId.get(r.connected_user_id) ? { ...byId.get(r.connected_user_id)!, saved_at: r.created_at, saved_by: null, category: r.category || null } : null))
        .filter(Boolean) as SavedItem[];
      const teamItems: SavedItem[] = teamRows
        .map((r) => (byId.get(r.connected_user_id) ? { ...byId.get(r.connected_user_id)!, saved_at: r.saved_at, saved_by: r.employee_id, category: r.category || null } : null))
        .filter(Boolean) as SavedItem[];

      if (cancelled) return;
      writeSavedCache(userId, mineItems);
      setCards([...mineItems, ...teamItems].sort((a, b) => b.saved_at.localeCompare(a.saved_at)));
      setCardsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [accountLoading, userId, isOwner]);

  /* ---------- branches (owners only), for the contacts branch filter ---------- */
  useEffect(() => {
    if (accountLoading || !userId || !isOwner) return;
    listMyBranches(userId).then((r) => r.ok && setBranches(r.data));
  }, [accountLoading, userId, isOwner]);

  /* ---------- load contacts (RLS returns only what this person may see) ---------- */
  useEffect(() => {
    if (accountLoading || !userId) return;
    createClient()
      .from("contacts")
      .select("*")
      .order("last_seen_at", { ascending: false })
      .limit(1000)
      .then(({ data }) => {
        setContacts((data as ContactRow[] | null) ?? []);
        setContactsLoading(false);
      });
  }, [accountLoading, userId]);

  const teamName = (id: string | null) => team.find((t) => t.id === id)?.name ?? "Team";
  const q = search.trim().toLowerCase();

  const cardCategories = useMemo(() => {
    const set = new Set<string>();
    cards.forEach((c) => {
      if (c.category) set.add(c.category);
    });
    return ["All", ...Array.from(set).sort()];
  }, [cards]);

  const visibleCards = useMemo(() => {
    let list = cards.filter((c) => {
      if (who === "me" && c.saved_by) return false;
      if (who !== "all" && who !== "me" && c.saved_by !== who) return false;
      if (savedCardCategory !== "All" && (c.category || "Uncategorized") !== savedCardCategory) return false;
      if (!q) return true;
      return [c.owner_name, c.business_name, c.job_title, c.category].some((v) => v?.toLowerCase().includes(q));
    });

    if (sortBy === "az") {
      list = [...list].sort((a, b) =>
        (a.owner_name || a.business_name || "").localeCompare(b.owner_name || b.business_name || "")
      );
    } else if (sortBy === "za") {
      list = [...list].sort((a, b) =>
        (b.owner_name || b.business_name || "").localeCompare(a.owner_name || a.business_name || "")
      );
    } else {
      list = [...list].sort((a, b) => b.saved_at.localeCompare(a.saved_at));
    }

    return list;
  }, [cards, who, savedCardCategory, q, sortBy]);

  const whoContacts = useMemo(
    () =>
      contacts.filter((c) => {
        if (isOwner && branchFilter !== "all") {
          if (branchFilter === "main" ? c.branch_id : c.branch_id !== branchFilter) return false;
        }
        if (!isOwner || who === "all") return true;
        if (who === "me") return !c.employee_id;
        return c.employee_id === who;
      }),
    [contacts, who, isOwner, branchFilter]
  );
  const categories = useMemo(() => {
    const set = new Set<string>(whoContacts.map((c) => c.category));
    return ["All", ...Array.from(set).sort((a, b) => (a === "New" ? -1 : b === "New" ? 1 : a.localeCompare(b)))];
  }, [whoContacts]);

  const visibleContacts = useMemo(() => {
    let list = whoContacts.filter((c) => {
      if (category !== "All" && c.category !== category) return false;
      if (!q) return true;
      return [c.name, c.phone, c.email, c.category, c.note].some((v) => v?.toLowerCase().includes(q));
    });

    if (sortBy === "az") {
      list = [...list].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    } else if (sortBy === "za") {
      list = [...list].sort((a, b) => (b.name || "").localeCompare(a.name || ""));
    } else {
      list = [...list].sort((a, b) =>
        (b.last_seen_at || b.created_at).localeCompare(a.last_seen_at || a.created_at)
      );
    }

    return list;
  }, [whoContacts, category, q, sortBy]);

  async function updateSavedCardCategory(cardId: string, cat: string) {
    const formatted = cat.trim() || null;
    setCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, category: formatted } : c))
    );
    setCategorizingCard(null);

    const supabase = createClient();
    await supabase.rpc("update_saved_card_category", {
      p_connected_user_id: cardId,
      p_category: formatted ?? "",
    } as never);

    if (userId) {
      const updated = cards.map((c) => (c.id === cardId ? { ...c, category: formatted } : c));
      writeSavedCache(userId, updated);
    }
  }

  async function updateContact(
    id: string,
    patch: Partial<Pick<ContactRow, "category" | "note" | "name" | "phone" | "email" | "card_front_path" | "card_back_path">>
  ) {
    const apply = (p: Partial<ContactRow>) => {
      setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, ...p } : c)));
      setOpenContact((c) => (c && c.id === id ? { ...c, ...p } : c));
    };
    apply(patch);

    const dbPatch: Record<string, any> = {};
    if (patch.name !== undefined) dbPatch.name = patch.name;
    if (patch.phone !== undefined) dbPatch.phone = patch.phone;
    if (patch.email !== undefined) dbPatch.email = patch.email;
    if (patch.category !== undefined) dbPatch.category = patch.category;
    if (patch.note !== undefined) dbPatch.note = patch.note;

    if (Object.keys(dbPatch).length > 0) {
      const { data } = await createClient()
        .from("contacts")
        .update(dbPatch as never)
        .eq("id", id)
        .select("name, phone, email")
        .maybeSingle();
      if (data) apply(data as Partial<ContactRow>); // server tidies the number format
    }
  }
  async function deleteContact(id: string) {
    const gone = contacts.find((c) => c.id === id);
    setContacts((prev) => prev.filter((c) => c.id !== id));
    setOpenContact(null);
    await createClient().from("contacts").delete().eq("id", id);
    if (gone) deleteCardPhotos([gone.card_front_path, gone.card_back_path]).catch(() => {});
  }

  const showWho = isOwner && team.length > 0;
  const showBranches = isOwner && tab === "contacts" && branches.length > 0;
  const branchName = (id: string | null | undefined) => (id ? branches.find((b) => b.id === id)?.name ?? null : null);
  const myCardCount = cards.filter((c) => !c.saved_by).length;

  return (
    <div className="mx-auto max-w-lg px-4 pb-8 pt-5">
      <div className="mb-4 px-1">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Saved</h1>
        <p className="mt-0.5 text-[13px] text-[var(--muted-foreground)]">
          {tab === "cards" ? "Namma Info cards you have tapped or scanned" : "People who shared their details on your card"}
        </p>
      </div>

      {/* Tabs */}
      <div role="tablist" className="mb-4 flex gap-6 border-b border-[var(--border)] px-1">
        {(
          [
            ["cards", "Saved cards", myCardCount],
            ["contacts", "Contacts", contacts.length],
          ] as const
        ).map(([t, label, n]) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => switchTab(t)}
            className={`-mb-px flex items-center gap-1.5 border-b-2 pb-2.5 text-sm font-medium transition-colors ${
              tab === t
                ? "border-[var(--foreground)] text-[var(--foreground)]"
                : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            {label}
            <span className="tabular-nums text-xs font-normal text-[var(--muted-foreground)]">{n}</span>
          </button>
        ))}
      </div>

      {/* Search & Sort */}
      <div className="mb-3 flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === "cards" ? "Search by name or business" : "Search by name, number or category"}
            className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] pl-9 pr-3 text-sm outline-none transition placeholder:text-[var(--muted-foreground)] focus:border-[var(--muted-foreground)]"
          />
        </div>
        <div className="relative shrink-0">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            aria-label="Sort list"
            className="h-10 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-xs font-medium text-[var(--foreground)] outline-none transition focus:border-[var(--muted-foreground)] cursor-pointer"
          >
            <option value="recent">Recently Added</option>
            <option value="az">A – Z</option>
            <option value="za">Z – A</option>
          </select>
        </div>
      </div>

      {/* Filters */}
      {(showWho || showBranches || (tab === "cards" && cardCategories.length > 2) || (tab === "contacts" && categories.length > 2)) && (
        <div className="mb-4 space-y-2">
          {showBranches && (
            <FilterRow>
              <Chip active={branchFilter === "all"} onClick={() => setBranchFilter("all")}>All branches</Chip>
              <Chip active={branchFilter === "main"} onClick={() => setBranchFilter("main")}>Main office</Chip>
              {branches.map((b) => (
                <Chip key={b.id} active={branchFilter === b.id} onClick={() => setBranchFilter(b.id)}>
                  {b.name}
                </Chip>
              ))}
            </FilterRow>
          )}
          {showWho && (
            <FilterRow>
              <Chip active={who === "all"} onClick={() => setWho("all")}>Everyone</Chip>
              <Chip active={who === "me"} onClick={() => setWho("me")}>{tab === "cards" ? "Me" : "My card"}</Chip>
              {team.map((t) => (
                <Chip key={t.id} active={who === t.id} onClick={() => setWho(t.id)}>
                  {t.name.split(" ")[0]}
                </Chip>
              ))}
            </FilterRow>
          )}
          {tab === "cards" && cardCategories.length > 2 && (
            <FilterRow>
              {cardCategories.map((c) => (
                <Chip key={c} active={savedCardCategory === c} onClick={() => setSavedCardCategory(c)}>
                  {c !== "All" && <Dot category={c} />}
                  {c}
                </Chip>
              ))}
            </FilterRow>
          )}
          {tab === "contacts" && categories.length > 2 && (
            <FilterRow>
              {categories.map((c) => (
                <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
                  {c !== "All" && <Dot category={c} />}
                  {c}
                </Chip>
              ))}
            </FilterRow>
          )}
        </div>
      )}

      {tab === "cards" ? (
        cardsLoading ? (
          <Skeletons />
        ) : visibleCards.length === 0 ? (
          <Empty
            icon={<Bookmark size={18} />}
            title={search ? "No matching cards" : "No saved cards yet"}
            text={search ? "Try a different name." : "Cards you tap or scan are saved here automatically."}
          />
        ) : (
          <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]">
            {visibleCards.map((p) => (
              <li key={`${p.id}-${p.saved_by ?? "me"}`} className="flex items-center gap-1 pr-1.5 transition hover:bg-[var(--muted)]">
                <button
                  type="button"
                  onClick={() => {
                    const slug = p.username || p.slug;
                    if (slug) router.push(`/${slug}`);
                  }}
                  className="flex min-w-0 flex-1 items-center gap-3 px-3.5 py-3 text-left"
                >
                  <Avatar name={p.owner_name || p.business_name} src={p.logo_url || p.avatar_url} size={40} shape="rounded" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium">{p.owner_name || p.business_name || "Unknown"}</p>
                    <p className="truncate text-[13px] text-[var(--muted-foreground)]">
                      {[p.job_title, p.owner_name ? p.business_name : null].filter(Boolean).join(" · ") || "Namma Info card"}
                    </p>
                    {p.category && (
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
                        <Dot category={p.category} />
                        <span className="text-[var(--foreground)] font-medium">{p.category}</span>
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs tabular-nums text-[var(--muted-foreground)]">{formatDistanceToNow(p.saved_at)}</p>
                    {p.saved_by && (
                      <p className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">by {teamName(p.saved_by).split(" ")[0]}</p>
                    )}
                  </div>
                  <ChevronRight size={16} className="shrink-0 text-[var(--muted-foreground)]" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCategorizingCard(p);
                  }}
                  aria-label="Add or change category"
                  title="Add or change category"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--muted-foreground)] transition hover:bg-[var(--background)] hover:text-[var(--foreground)] cursor-pointer"
                >
                  <MoreVertical size={16} />
                </button>
              </li>
            ))}
          </ul>
        )
      ) : contactsLoading ? (
        <Skeletons />
      ) : visibleContacts.length === 0 ? (
        <Empty
          icon={<UserRound size={18} />}
          title={search || category !== "All" ? "No matching contacts" : "No contacts yet"}
          text={
            search || category !== "All"
              ? "Try a different search or category."
              : "When someone opens your card and shares their details, they show up here."
          }
        />
      ) : (
        <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]">
          {visibleContacts.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-3.5 py-3">
              <button type="button" onClick={() => setOpenContact(c)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <Avatar name={c.name} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="flex min-w-0 items-center gap-1.5 text-[15px] font-medium">
                      <span className="truncate">{c.name}</span>
                      {c.card_front_path && (
                        <IdCard size={14} aria-label="Has business card photo" className="shrink-0 text-[var(--muted-foreground)]" />
                      )}
                    </p>
                    <span className="shrink-0 text-xs tabular-nums text-[var(--muted-foreground)]">{formatDistanceToNow(c.last_seen_at)}</span>
                  </div>
                  <p className="truncate text-[13px] tabular-nums text-[var(--muted-foreground)]">{formatPhone(c.phone) || c.email || "Business card photo"}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-[var(--muted-foreground)]">
                    <Dot category={c.category} />
                    <span className="text-[var(--foreground)]">{c.category}</span>
                    {isOwner && c.employee_id && <span>· via {teamName(c.employee_id).split(" ")[0]}</span>}
                    {isOwner && branchName(c.branch_id) && <span className="truncate">· {branchName(c.branch_id)}</span>}
                    {c.visits > 1 && <span>· {c.visits} visits</span>}
                  </p>
                </div>
              </button>
              {c.phone ? (
                <a href={`tel:${c.phone}`} aria-label={`Call ${c.name}`} className={iconBtn}>
                  <Phone size={16} />
                </a>
              ) : c.email ? (
                <a href={`mailto:${c.email}`} aria-label={`Email ${c.name}`} className={iconBtn}>
                  <Mail size={16} />
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {openContact && (
        <ContactSheet
          contact={openContact}
          viaName={isOwner && openContact.employee_id ? teamName(openContact.employee_id) : null}
          allCategories={Array.from(new Set([...DEFAULT_CATEGORIES, ...contacts.map((c) => c.category)]))}
          onClose={() => setOpenContact(null)}
          onCategory={(cat) => updateContact(openContact.id, { category: cat })}
          onNote={(note) => updateContact(openContact.id, { note })}
          onDetails={(d) => updateContact(openContact.id, d)}
          onPhotosUpdated={(photos) => updateContact(openContact.id, photos)}
          onDelete={() => deleteContact(openContact.id)}
        />
      )}

      {categorizingCard && (
        <SavedCardCategorySheet
          card={categorizingCard}
          allCategories={cardCategories.filter((c) => c !== "All")}
          onClose={() => setCategorizingCard(null)}
          onSave={(cat) => updateSavedCardCategory(categorizingCard.id, cat)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Pieces                                                              */
/* ------------------------------------------------------------------ */

const iconBtn =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[var(--foreground)] transition hover:bg-[var(--muted)] active:scale-95";

const CATEGORY_COLORS: Record<string, string> = {
  New: "bg-sky-500",
  Customer: "bg-emerald-500",
  Lead: "bg-amber-500",
  Supplier: "bg-violet-500",
  Partner: "bg-indigo-500",
  Personal: "bg-rose-500",
};

function Dot({ category }: { category: string }) {
  return <span aria-hidden className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${CATEGORY_COLORS[category] ?? "bg-[var(--muted-foreground)]"}`} />;
}

function formatPhone(phone: string | null) {
  if (!phone) return null;
  return /^\d{10}$/.test(phone) ? `+91 ${phone.slice(0, 5)} ${phone.slice(5)}` : phone;
}

function FilterRow({ children }: { children: React.ReactNode }) {
  return <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 scrollbar-hide">{children}</div>;
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex h-7 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition ${
        active
          ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
          : "border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
      }`}
    >
      {children}
    </button>
  );
}

function ContactSheet({
  contact,
  viaName,
  allCategories,
  onClose,
  onCategory,
  onNote,
  onDetails,
  onPhotosUpdated,
  onDelete,
}: {
  contact: ContactRow;
  viaName: string | null;
  allCategories: string[];
  onClose: () => void;
  onCategory: (c: string) => void;
  onNote: (n: string | null) => void;
  onDetails: (d: { name: string; phone: string | null; email: string | null }) => void;
  onPhotosUpdated: (p: { card_front_path: string | null; card_back_path: string | null }) => void;
  onDelete: () => void;
}) {
  const noDetails = !contact.phone && !contact.email;
  const [editing, setEditing] = useState(noDetails); // card-only contacts: type in from the photo
  const [eName, setEName] = useState(contact.name === "Business card" ? "" : contact.name);
  const [ePhone, setEPhone] = useState(contact.phone ?? "");
  const [eEmail, setEEmail] = useState(contact.email ?? "");
  const [eError, setEError] = useState<string | null>(null);

  const [showPhotoModal, setShowPhotoModal] = useState(false);

  function saveDetails() {
    const name = eName.trim();
    const digits = ePhone.replace(/[^0-9]/g, "");
    const email = eEmail.trim();
    if (digits && (digits.length < 7 || digits.length > 15)) return setEError("Check the mobile number.");
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setEError("Check the email address.");
    if (!digits && !email && !contact.card_front_path) return setEError("Add a mobile number or email.");
    setEError(null);
    onDetails({ name: name || contact.name, phone: digits ? ePhone.trim() : null, email: email || null });
    setEditing(false);
  }

  const [adding, setAdding] = useState(false);
  const [newCat, setNewCat] = useState("");
  const [note, setNote] = useState(contact.note ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  function close() {
    if (note !== (contact.note ?? "")) onNote(note.trim() || null);
    onClose();
  }
  function addCategory() {
    const c = newCat.trim().replace(/\s+/g, " ").slice(0, 24);
    if (!c) return;
    onCategory(c[0].toUpperCase() + c.slice(1));
    setAdding(false);
    setNewCat("");
  }

  const meta = [
    viaName ? `Opened ${viaName.split(" ")[0]}'s card` : "Opened your card",
    formatDistanceToNow(contact.created_at),
    contact.visits > 1 ? `${contact.visits} visits` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Sheet title={contact.name} description={meta} onClose={close}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {contact.phone && (
          <a href={`tel:${contact.phone}`} className={actionBtn}>
            <Phone size={17} /> Call
          </a>
        )}
        {contact.phone && (
          <a href={waLink(contact.phone)} target="_blank" rel="noopener noreferrer" className={actionBtn}>
            <MessageCircle size={17} /> WhatsApp
          </a>
        )}
        {contact.email && (
          <a href={`mailto:${contact.email}`} className={actionBtn}>
            <Mail size={17} /> Email
          </a>
        )}
        <button
          type="button"
          onClick={() => saveContactFromUrl(`/api/vcard/contact/${contact.id}`, `${contact.name || "contact"}.vcf`)}
          className={actionBtn}
        >
          <UserPlus size={17} /> Add to Contacts
        </button>
      </div>

      {/* Business Card Section */}
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[13px] font-medium text-[var(--foreground)]">Business card</p>
          {(contact.card_front_path || contact.card_back_path) && (
            <button
              type="button"
              onClick={() => setShowPhotoModal(true)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--primary)] hover:underline cursor-pointer"
            >
              <Camera size={13} />
              <span>Edit business card</span>
            </button>
          )}
        </div>

        {(contact.card_front_path || contact.card_back_path) ? (
          <CardPhotos front={contact.card_front_path} back={contact.card_back_path} />
        ) : (
          <button
            type="button"
            onClick={() => setShowPhotoModal(true)}
            className="flex w-full flex-col items-center justify-center gap-1.5 rounded-[5px] border border-dashed border-[var(--border)] p-4 text-center hover:border-[var(--muted-foreground)] hover:bg-[var(--muted)]/20 transition cursor-pointer bg-[var(--card)]"
          >
            <Camera size={18} className="text-[var(--muted-foreground)]" />
            <span className="text-xs font-medium text-[var(--foreground)]">
              Upload business card photo
            </span>
            <span className="text-[11px] text-[var(--muted-foreground)]">
              Attach front & back photos of their physical card
            </span>
          </button>
        )}
      </div>

      {showPhotoModal && (
        <EditBusinessCardModal
          contactId={contact.id}
          contactName={contact.name}
          frontPath={contact.card_front_path}
          backPath={contact.card_back_path}
          onClose={() => setShowPhotoModal(false)}
          onUpdated={(p) => {
            onPhotosUpdated(p);
          }}
        />
      )}

      {editing ? (
        <div className="mt-4 rounded-lg border border-[var(--border)] p-3">
          {noDetails && (
            <p className="mb-3 text-xs text-[var(--muted-foreground)]">Type in the details from the card so you can call or WhatsApp them.</p>
          )}
          <label className="block">
            <span className={ui.label}>Name</span>
            <input value={eName} onChange={(e) => setEName(e.target.value)} placeholder="Full name" className={ui.input} />
          </label>
          <label className="mt-3 block">
            <span className={ui.label}>Mobile number</span>
            <input value={ePhone} onChange={(e) => setEPhone(e.target.value)} inputMode="tel" placeholder="98450 12345" className={ui.input} />
          </label>
          <label className="mt-3 block">
            <span className={ui.label}>Email</span>
            <input value={eEmail} onChange={(e) => setEEmail(e.target.value)} inputMode="email" placeholder="name@company.com" className={ui.input} />
          </label>
          {eError && <p className={ui.error}>{eError}</p>}
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={saveDetails} className={`${ui.primary} !h-10 flex-1 !text-sm`}>
              Save details
            </button>
            {!noDetails && (
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="h-10 rounded-lg border border-[var(--border)] px-3 text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      ) : (
      <>
      <dl className="mt-4 divide-y divide-[var(--border)] rounded-lg border border-[var(--border)] text-sm">
        {contact.phone && (
          <div className="flex items-center justify-between px-3 py-2.5">
            <dt className="text-[var(--muted-foreground)]">Mobile</dt>
            <dd className="tabular-nums">{formatPhone(contact.phone)}</dd>
          </div>
        )}
        {contact.email && (
          <div className="flex items-center justify-between gap-4 px-3 py-2.5">
            <dt className="text-[var(--muted-foreground)]">Email</dt>
            <dd className="truncate">{contact.email}</dd>
          </div>
        )}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex w-full items-center gap-1.5 px-3 py-2.5 text-left text-[13px] font-medium text-[var(--muted-foreground)] transition hover:text-[var(--foreground)]"
        >
          <Pencil size={13} /> Edit details
        </button>
      </dl>
      </>
      )}

      <p className="mb-2 mt-5 text-[13px] font-medium">Category</p>
      <div className="flex flex-wrap gap-1.5">
        {allCategories.map((c) => (
          <Chip key={c} active={contact.category === c} onClick={() => onCategory(c)}>
            <Dot category={c} />
            {c}
          </Chip>
        ))}
        {adding ? (
          <span className="flex items-center gap-1.5">
            <input
              autoFocus
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCategory()}
              placeholder="Category name"
              className="h-7 w-32 rounded-md border border-[var(--border)] bg-[var(--card)] px-2 text-xs outline-none focus:border-[var(--muted-foreground)]"
            />
            <button type="button" onClick={addCategory} className="h-7 rounded-md bg-[var(--foreground)] px-2.5 text-xs font-medium text-[var(--background)]">
              Add
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex h-7 items-center gap-1 rounded-md border border-dashed border-[var(--border)] px-2.5 text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            <Plus size={12} /> New category
          </button>
        )}
      </div>

      <label className="mt-5 block">
        <span className={ui.label}>Note</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => note !== (contact.note ?? "") && onNote(note.trim() || null)}
          rows={3}
          placeholder="Add a note, e.g. asked for a quote for 50 units"
          className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm outline-none transition placeholder:text-[var(--muted-foreground)] focus:border-[var(--muted-foreground)]"
        />
      </label>

      <button
        type="button"
        onClick={() => (confirmDelete ? onDelete() : setConfirmDelete(true))}
        className={`mt-4 inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] font-medium transition ${
          confirmDelete ? "bg-red-500/10 text-red-600 dark:text-red-400" : "text-[var(--muted-foreground)] hover:text-red-600"
        }`}
      >
        <Trash2 size={14} /> {confirmDelete ? "Confirm delete" : "Delete contact"}
      </button>
    </Sheet>
  );
}

function EditBusinessCardModal({
  contactId,
  contactName,
  frontPath: initialFrontPath,
  backPath: initialBackPath,
  onClose,
  onUpdated,
}: {
  contactId: string;
  contactName: string;
  frontPath: string | null;
  backPath: string | null;
  onClose: () => void;
  onUpdated: (p: { card_front_path: string | null; card_back_path: string | null }) => void;
}) {
  const [frontPath, setFrontPath] = useState(initialFrontPath);
  const [backPath, setBackPath] = useState(initialBackPath);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [uploadingSide, setUploadingSide] = useState<"front" | "back" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const paths = [frontPath, backPath].filter((p): p is string => !!p);
    if (paths.length) {
      getCardPhotoUrls(paths).then(setUrls).catch(() => {});
    }
  }, [frontPath, backPath]);

  async function handleUpload(file: File, side: "front" | "back") {
    setUploadingSide(side);
    setError(null);
    try {
      const formData = new FormData();
      formData.append(side, file);
      const res = await fetch(`/api/contacts/${contactId}/photos`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to upload photo");
      setFrontPath(data.card_front_path);
      setBackPath(data.card_back_path);
      onUpdated({
        card_front_path: data.card_front_path,
        card_back_path: data.card_back_path,
      });
    } catch (err: any) {
      setError(err.message || "Failed to upload photo");
    } finally {
      setUploadingSide(null);
    }
  }

  const frontUrl = frontPath ? urls[frontPath] : null;
  const backUrl = backPath ? urls[backPath] : null;

  return (
    <Sheet
      title="Business Card Photos"
      description={`Manage physical card photos for ${contactName}`}
      zIndex={100}
      onClose={onClose}
    >
      <div className="space-y-4">
        {error && (
          <p className="rounded-[5px] border border-rose-500/20 bg-rose-500/10 p-2.5 text-xs text-rose-600">
            {error}
          </p>
        )}

        {/* Front Photo Card */}
        <div className="rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              Front Side
            </span>
            {frontPath && (
              <span className="rounded-[4px] border border-[var(--border)] bg-[var(--background)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--foreground)]">
                Uploaded
              </span>
            )}
          </div>

          {frontUrl ? (
            <div className="space-y-2.5">
              <div className="relative aspect-[1.6] w-full overflow-hidden rounded-[5px] border border-[var(--border)] bg-[var(--muted)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={frontUrl}
                  alt="Front side of business card"
                  className="h-full w-full object-cover"
                />
              </div>
              <label className="flex items-center justify-center gap-2 rounded-[5px] border border-[var(--border)] bg-[var(--background)] py-2 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--muted)] cursor-pointer transition">
                {uploadingSide === "front" ? (
                  <Loader2 size={14} className="animate-spin text-[var(--muted-foreground)]" />
                ) : (
                  <Camera size={14} />
                )}
                <span>{uploadingSide === "front" ? "Uploading front photo..." : "Replace Front Photo"}</span>
                <input
                  type="file"
                  accept="image/*"
                  disabled={uploadingSide !== null}
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload(f, "front");
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          ) : (
            <label className="flex aspect-[1.8] w-full flex-col items-center justify-center gap-1.5 rounded-[5px] border border-dashed border-[var(--border)] p-4 text-center hover:border-[var(--muted-foreground)] hover:bg-[var(--muted)]/20 cursor-pointer transition">
              {uploadingSide === "front" ? (
                <Loader2 size={20} className="animate-spin text-[var(--muted-foreground)]" />
              ) : (
                <Upload size={20} className="text-[var(--muted-foreground)]" />
              )}
              <span className="text-xs font-medium text-[var(--foreground)]">
                {uploadingSide === "front" ? "Uploading front photo..." : "Upload Front Photo"}
              </span>
              <span className="text-[10px] text-[var(--muted-foreground)]">PNG, JPG, WebP</span>
              <input
                type="file"
                accept="image/*"
                disabled={uploadingSide !== null}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f, "front");
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </div>

        {/* Back Photo Card */}
        <div className="rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              Back Side (Optional)
            </span>
            {backPath && (
              <span className="rounded-[4px] border border-[var(--border)] bg-[var(--background)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--foreground)]">
                Uploaded
              </span>
            )}
          </div>

          {backUrl ? (
            <div className="space-y-2.5">
              <div className="relative aspect-[1.6] w-full overflow-hidden rounded-[5px] border border-[var(--border)] bg-[var(--muted)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={backUrl}
                  alt="Back side of business card"
                  className="h-full w-full object-cover"
                />
              </div>
              <label className="flex items-center justify-center gap-2 rounded-[5px] border border-[var(--border)] bg-[var(--background)] py-2 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--muted)] cursor-pointer transition">
                {uploadingSide === "back" ? (
                  <Loader2 size={14} className="animate-spin text-[var(--muted-foreground)]" />
                ) : (
                  <Camera size={14} />
                )}
                <span>{uploadingSide === "back" ? "Uploading back photo..." : "Replace Back Photo"}</span>
                <input
                  type="file"
                  accept="image/*"
                  disabled={uploadingSide !== null}
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload(f, "back");
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          ) : (
            <label className="flex aspect-[1.8] w-full flex-col items-center justify-center gap-1.5 rounded-[5px] border border-dashed border-[var(--border)] p-4 text-center hover:border-[var(--muted-foreground)] hover:bg-[var(--muted)]/20 cursor-pointer transition">
              {uploadingSide === "back" ? (
                <Loader2 size={20} className="animate-spin text-[var(--muted-foreground)]" />
              ) : (
                <Upload size={20} className="text-[var(--muted-foreground)]" />
              )}
              <span className="text-xs font-medium text-[var(--foreground)]">
                {uploadingSide === "back" ? "Uploading back photo..." : "Upload Back Photo (Optional)"}
              </span>
              <span className="text-[10px] text-[var(--muted-foreground)]">PNG, JPG, WebP</span>
              <input
                type="file"
                accept="image/*"
                disabled={uploadingSide !== null}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f, "back");
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </div>

        <div className="pt-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-[5px] bg-[var(--foreground)] py-2.5 text-xs font-semibold text-[var(--background)] hover:opacity-90 transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </Sheet>
  );
}

function SavedCardCategorySheet({
  card,
  allCategories,
  onClose,
  onSave,
}: {
  card: SavedItem;
  allCategories: string[];
  onClose: () => void;
  onSave: (cat: string) => void;
}) {
  const [selectedCat, setSelectedCat] = useState<string>(card.category || "");
  const [customCat, setCustomCat] = useState<string>("");
  const [isCustom, setIsCustom] = useState(false);

  const predefined = Array.from(new Set([...DEFAULT_CATEGORIES, ...allCategories]));

  function handleSave() {
    const finalCat = isCustom ? customCat.trim() : selectedCat.trim();
    onSave(finalCat);
  }

  return (
    <Sheet
      title="Categorize Card"
      description="Organize your saved cards into custom categories"
      onClose={onClose}
    >
      {/* Prefilled Read-Only Card Details */}
      <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--muted)]/50 p-3">
        <Avatar
          name={card.owner_name || card.business_name}
          src={card.logo_url || card.avatar_url}
          size={42}
          shape="rounded"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--foreground)]">
            {card.owner_name || card.business_name || "Unknown"}
          </p>
          <p className="truncate text-xs text-[var(--muted-foreground)]">
            {[card.job_title, card.owner_name ? card.business_name : null].filter(Boolean).join(" · ") || "Namma Info card"}
          </p>
          {card.category && (
            <span className="mt-1 inline-flex items-center gap-1 rounded-[4px] border border-[var(--border)] bg-[var(--card)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--foreground)]">
              Current: {card.category}
            </span>
          )}
        </div>
      </div>

      <div className="mt-5 space-y-3">
        <p className="text-[13px] font-medium text-[var(--foreground)]">Select Category</p>
        <div className="flex flex-wrap gap-1.5">
          {predefined.map((c) => (
            <Chip
              key={c}
              active={!isCustom && selectedCat === c}
              onClick={() => {
                setIsCustom(false);
                setSelectedCat(c);
              }}
            >
              <Dot category={c} />
              {c}
            </Chip>
          ))}
          <Chip
            active={isCustom}
            onClick={() => {
              setIsCustom(true);
            }}
          >
            <Plus size={12} /> Custom
          </Chip>
        </div>

        {isCustom && (
          <div className="mt-2">
            <input
              autoFocus
              type="text"
              value={customCat}
              onChange={(e) => setCustomCat(e.target.value)}
              placeholder="e.g. VIP, Client, Vendor"
              maxLength={24}
              className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-xs outline-none focus:border-[var(--foreground)]"
            />
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between gap-2 border-t border-[var(--border)] pt-4">
        {card.category ? (
          <button
            type="button"
            onClick={() => onSave("")}
            className="text-xs font-medium text-rose-600 hover:underline cursor-pointer"
          >
            Remove Category
          </button>
        ) : <div />}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg border border-[var(--border)] px-3 text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="h-9 rounded-lg bg-[var(--foreground)] px-4 text-xs font-semibold text-[var(--background)] hover:opacity-90 cursor-pointer"
          >
            Save Category
          </button>
        </div>
      </div>
    </Sheet>
  );
}

/** Front/back photos of a visitor's business card. Links are private and expire after an hour. */
function CardPhotos({ front, back }: { front: string | null; back: string | null }) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    const paths = [front, back].filter((p): p is string => !!p);
    getCardPhotoUrls(paths).then(setUrls).catch(() => {});
  }, [front, back]);
  const sides = [
    { label: "Front", path: front },
    { label: "Back", path: back },
  ].filter((s) => s.path);

  return (
    <div className="mt-4">
      <p className="mb-2 text-[13px] font-medium">Business card</p>
      <div className={`grid gap-2 ${sides.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
        {sides.map((s) => {
          const url = urls[s.path!];
          return (
            <a
              key={s.label}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative block aspect-[1.6] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--muted)]"
            >
              {url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt={`${s.label} of business card`} className="h-full w-full object-cover" loading="lazy" />
              )}
              <span className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[11px] font-medium text-white">{s.label}</span>
            </a>
          );
        })}
      </div>
      <p className="mt-1.5 text-xs text-[var(--muted-foreground)]">Tap a photo to open it full size.</p>
    </div>
  );
}

const actionBtn =
  "flex h-[60px] flex-col items-center justify-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--card)] text-xs font-medium text-[var(--foreground)] transition hover:bg-[var(--muted)]";

function Skeletons() {
  return (
    <div className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)]">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-3 px-3.5 py-3">
          <div className="skeleton h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3.5 w-2/5 rounded" />
            <div className="skeleton h-3 w-3/5 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

function Empty({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--border)] px-6 py-14 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] text-[var(--muted-foreground)]">
        {icon}
      </div>
      <p className="text-sm font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-[260px] text-[13px] leading-relaxed text-[var(--muted-foreground)]">{text}</p>
    </div>
  );
}

export default function SavedPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-lg px-4 py-5"><Skeletons /></div>}>
      <SavedInner />
    </Suspense>
  );
}
