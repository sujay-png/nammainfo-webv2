"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, FileText, Loader2, Lock, Pencil, Plus, Send, LayoutTemplate, Trash2 } from "lucide-react";
import { createClient } from "@/supabase/client";
import { useAccount } from "@/hooks/use-account";
import Sheet, { ui } from "@/components/ui/sheet";
import { directionsUrl, googleReviewUrl } from "@/lib/utils";
import { cleanCustomButtons, cleanCustomLinks, docKeys, docLink } from "@/features/custom-links/types";
import type { ContactRow } from "@/supabase/database-types";
import { cleanGreetings, MAX_GREETINGS, type GreetingTemplate } from "../types";
import {
  attachmentName,
  defaultGreeting,
  SAMPLE_TEMPLATES,
  templateFiles,
  templateMessage,
  whatsappUrl,
  type Attachable,
  type Sender,
} from "../lib/messages";

const SITE = "https://nammainfo.in";

type BusinessRow = {
  id: string;
  owner_name: string | null;
  job_title: string | null;
  business_name: string | null;
  username: string | null;
  website: string | null;
  brochure_url: string | null;
  google_place_id: string | null;
  maps_url?: string | null;
  address?: string | null;
  city?: string | null;
  pincode?: string | null;
  custom_buttons?: unknown;
  custom_links?: unknown;
  greeting_templates?: unknown;
};

/**
 * "Greet <name> on WhatsApp": five ready messages. Tap one and WhatsApp
 * opens with the text filled in; the user just presses send.
 *
 * 1. The built-in greeting (name, designation, company, profile link).
 * 2-5. The business's own templates, with optional links to the brochure,
 *      menu, website, Google review page, directions… Owners edit them
 *      here; team members use them with their own name and card link.
 */
export default function GreetSheet({ contact, onClose }: { contact: ContactRow; onClose: () => void }) {
  const { role, userId, employee } = useAccount();
  const isOwner = role === "owner";

  const [biz, setBiz] = useState<BusinessRow | null>(null);
  const [branch, setBranch] = useState<{ slug: string; name: string } | null>(null);
  const [templates, setTemplates] = useState<GreetingTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<number | null>(null); // index 0-3 = message 2-5

  // Load the business (owner's own profile, or the employee's business).
  useEffect(() => {
    const ownerId = isOwner ? userId : employee?.owner_id;
    if (!ownerId) return;
    let alive = true;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.from("profiles").select("*").eq("id", ownerId).maybeSingle();
      let br: { slug: string; name: string } | null = null;
      // Contact came in through a branch page: share that branch's link.
      if (isOwner && contact.branch_id) {
        const { data: b } = await supabase
          .from("branches")
          .select("slug, name, is_active")
          .eq("id", contact.branch_id)
          .maybeSingle();
        const row = b as { slug: string; name: string; is_active: boolean } | null;
        if (row?.is_active) br = { slug: row.slug, name: row.name };
      }
      if (!alive) return;
      const row = data as unknown as BusinessRow | null;
      setBiz(row);
      setBranch(br);
      setTemplates(cleanGreetings(row?.greeting_templates));
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [isOwner, userId, employee?.owner_id, contact.branch_id]);

  const sender: Sender | null = useMemo(() => {
    if (!biz) return null;
    if (!isOwner && employee) {
      const handle = employee.owner_username;
      return {
        name: employee.name,
        designation: employee.designation || null,
        company: employee.owner_business_name || biz.business_name,
        profileUrl: handle
          ? `${SITE}/${handle}/${employee.branch_slug ? `${employee.branch_slug}/` : ""}${employee.slug}`
          : null,
      };
    }
    return {
      name: biz.owner_name || biz.business_name || "",
      designation: biz.job_title,
      company: biz.business_name ? `${biz.business_name}${branch ? `, ${branch.name}` : ""}` : null,
      profileUrl: biz.username ? `${SITE}/${biz.username}${branch ? `/${branch.slug}` : ""}` : null,
    };
  }, [biz, isOwner, employee, branch]);

  // Everything on the profile that can be added to a message as a link.
  const attachables: Attachable[] = useMemo(() => {
    if (!biz || !sender) return [];
    const list: Attachable[] = [];
    // Documents get a short branded link (nammainfo.in/doc/<you>/brochure)
    // in the text, plus the real file for "Send with PDF".
    const handle = !isOwner && employee ? employee.owner_username : biz.username;
    const company = biz.business_name;
    if (sender.profileUrl) list.push({ key: "profile", label: "Profile", url: sender.profileUrl });
    if (biz.brochure_url) {
      list.push({
        key: "brochure",
        label: "Brochure",
        url: handle ? docLink(handle, "brochure") : biz.brochure_url,
        file: { url: biz.brochure_url, name: attachmentName(company, "Brochure", biz.brochure_url) },
      });
    }
    const buttons = cleanCustomButtons(biz.custom_buttons);
    const keys = docKeys(buttons);
    for (const b of buttons) {
      const short = handle ? docLink(handle, keys.get(b.id) as string) : b.url;
      list.push(
        b.kind === "file"
          ? { key: `btn:${b.id}`, label: b.label, url: short, file: { url: b.url, name: attachmentName(company, b.label, b.url) } }
          : { key: `btn:${b.id}`, label: b.label, url: b.url }
      );
    }
    for (const l of cleanCustomLinks(biz.custom_links)) list.push({ key: `link:${l.id}`, label: l.label, url: l.url });
    if (biz.website) {
      const w = /^https?:\/\//i.test(biz.website) ? biz.website : `https://${biz.website}`;
      list.push({ key: "website", label: "Website", url: w });
    }
    if (biz.google_place_id) list.push({ key: "review", label: "Leave us a Google review", url: googleReviewUrl(biz.google_place_id) });
    const dir = directionsUrl(biz);
    if (dir) list.push({ key: "directions", label: "Directions", url: dir });
    return list;
  }, [biz, sender, isOwner, employee]);

  const name = contact.name && contact.name !== "Business card" ? contact.name : "there";

  // Can this phone share files to apps (WhatsApp) from the browser?
  // True on Android Chrome and iPhone Safari; false on most desktops.
  const [canShareFiles, setCanShareFiles] = useState(false);
  useEffect(() => {
    try {
      const probe = new File(["x"], "x.pdf", { type: "application/pdf" });
      setCanShareFiles(typeof navigator !== "undefined" && !!navigator.canShare?.({ files: [probe] }));
    } catch {
      setCanShareFiles(false);
    }
  }, []);

  // Download the documents the saved messages use, as soon as the sheet
  // opens. Sharing must start straight from the tap (browsers block it
  // after a slow download), so the files have to be ready beforehand.
  const [files, setFiles] = useState<Record<string, File | "error">>({});
  useEffect(() => {
    if (!canShareFiles) return;
    const needed = new Map<string, NonNullable<Attachable["file"]>>();
    for (const t of templates) for (const a of templateFiles(t, attachables)) needed.set(a.file!.url, a.file!);
    let alive = true;
    needed.forEach(async (f, url) => {
      if (files[url]) return;
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        const file = new File([blob], f.name, { type: blob.type || "application/pdf" });
        if (alive) setFiles((m) => ({ ...m, [url]: file }));
      } catch {
        if (alive) setFiles((m) => ({ ...m, [url]: "error" }));
      }
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canShareFiles, templates, attachables]);

  const [notice, setNotice] = useState<string | null>(null);

  function send(text: string) {
    if (!contact.phone) return;
    window.open(whatsappUrl(contact.phone, text), "_blank", "noopener,noreferrer");
  }

  /** Opens the phone's share sheet with the real file(s) and the message; the user picks WhatsApp, then the chat. */
  async function sendWithFiles(t: GreetingTemplate) {
    if (!sender) return;
    const docs = templateFiles(t, attachables);
    const ready = docs.map((a) => files[a.file!.url]).filter((f): f is File => f instanceof File);
    const fallback = templateMessage(t, name, sender, attachables);
    if (!ready.length) return send(fallback); // files didn't load: send the links instead
    const text = templateMessage(t, name, sender, attachables, { leaveOutFiles: ready.length === docs.length });
    // WhatsApp on iPhone sometimes drops the text when a file is attached,
    // so the message is also copied, ready to paste.
    try {
      await navigator.clipboard?.writeText(text);
    } catch {
      /* not allowed: fine */
    }
    try {
      await navigator.share({ files: ready, text });
      setNotice(`Message copied too. If WhatsApp shows only the file, paste the message in ${name.split(" ")[0]}'s chat.`);
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") send(fallback);
    }
  }

  async function saveTemplates(next: GreetingTemplate[]) {
    if (!isOwner || !biz) return "Only the business owner can edit these messages.";
    const { error } = await createClient()
      .from("profiles")
      .update({ greeting_templates: next } as Record<string, unknown>)
      .eq("id", biz.id);
    if (error) {
      return /greeting_templates|schema cache|does not exist/i.test(error.message)
        ? "This needs a quick database update first (run the 20261123 migration)."
        : "Couldn't save. Please check your connection and try again.";
    }
    setTemplates(next);
    return null;
  }

  const firstName = name.split(" ")[0];

  return (
    <Sheet
      title={`Greet ${firstName} on WhatsApp`}
      description="Pick a message. WhatsApp opens with it typed in; just press send."
      onClose={onClose}
      zIndex={95}
    >
      {loading || !sender ? (
        <div className="flex justify-center py-10">
          <Loader2 className="animate-spin text-[var(--muted-foreground)]" size={20} />
        </div>
      ) : editing !== null ? (
        <TemplateEditor
          initial={templates[editing] ?? null}
          attachables={attachables}
          onCancel={() => setEditing(null)}
          onDelete={
            templates[editing]
              ? async () => {
                  const err = await saveTemplates(templates.filter((_, i) => i !== editing));
                  if (!err) setEditing(null);
                  return err;
                }
              : undefined
          }
          onSave={async (t) => {
            const next = [...templates];
            if (editing < next.length) next[editing] = t;
            else next.push(t);
            const err = await saveTemplates(next.slice(0, MAX_GREETINGS));
            if (!err) setEditing(null);
            return err;
          }}
        />
      ) : (
        <div className="space-y-2.5">
          {notice && (
            <p className="rounded-lg bg-[var(--muted)] px-3 py-2 text-xs leading-relaxed text-[var(--foreground)]">{notice}</p>
          )}
          <MessageCard
            n={1}
            title="Greeting"
            text={defaultGreeting(name, sender)}
            onSend={send}
            badge="Default"
          />
          {Array.from({ length: MAX_GREETINGS }).map((_, i) => {
            const t = templates[i];
            if (t) {
              return (
                <MessageCard
                  key={t.id}
                  n={i + 2}
                  title={t.heading || `Message ${i + 2}`}
                  text={templateMessage(t, name, sender, attachables)}
                  onSend={send}
                  onEdit={isOwner ? () => setEditing(i) : undefined}
                  fileNames={
                    canShareFiles
                      ? templateFiles(t, attachables)
                          .filter((a) => files[a.file!.url] !== "error") // couldn't download: link only
                          .map((a) => a.file!.name)
                      : []
                  }
                  filesReady={templateFiles(t, attachables).some((a) => files[a.file!.url] instanceof File)}
                  onSendWithFiles={() => sendWithFiles(t)}
                />
              );
            }
            // Empty slots: only the first empty one is offered, to keep order.
            if (i !== templates.length) return null;
            return isOwner ? (
              <button
                key={`empty-${i}`}
                type="button"
                onClick={() => setEditing(i)}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--border)] py-3.5 text-sm font-medium text-[var(--muted-foreground)] transition hover:border-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                <Plus size={15} /> Write message {i + 2}
              </button>
            ) : templates.length === 0 ? (
              <p key="none" className="flex items-center gap-1.5 px-1 text-xs text-[var(--muted-foreground)]">
                <Lock size={12} /> Your business owner can add more messages here.
              </p>
            ) : null;
          })}
        </div>
      )}
    </Sheet>
  );
}

function MessageCard({
  n,
  title,
  text,
  onSend,
  onEdit,
  badge,
  fileNames = [],
  filesReady = false,
  onSendWithFiles,
}: {
  n: number;
  title: string;
  text: string;
  onSend: (text: string) => void;
  onEdit?: () => void;
  badge?: string;
  /** Documents this message can attach (only on phones that can share files). */
  fileNames?: string[];
  filesReady?: boolean;
  onSendWithFiles?: () => void;
}) {
  const withFiles = fileNames.length > 0 && onSendWithFiles;
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)]">
      <div className="flex items-center justify-between gap-2 px-3.5 pt-3">
        <p className="flex min-w-0 items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--muted)] text-[11px]">{n}</span>
          <span className="truncate">{title}</span>
          {badge && (
            <span className="shrink-0 rounded-full bg-[var(--muted)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--muted-foreground)]">
              {badge}
            </span>
          )}
        </p>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-xs text-[var(--muted-foreground)] transition hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
          >
            <Pencil size={12} /> Edit
          </button>
        )}
      </div>
      <p className="line-clamp-5 whitespace-pre-line px-3.5 pt-1.5 text-[13px] leading-relaxed text-[var(--muted-foreground)]">
        {text.replace(/\*/g, "")}
      </p>
      {withFiles && (
        <div className="flex flex-wrap gap-1.5 px-3.5 pt-2">
          {fileNames.map((f) => (
            <span key={f} className="inline-flex max-w-full items-center gap-1 rounded-md bg-[var(--muted)] px-2 py-1 text-[11px] font-medium text-[var(--foreground)]">
              <FileText size={11} className="shrink-0" />
              <span className="truncate">{f}</span>
            </span>
          ))}
        </div>
      )}
      <div className="space-y-1.5 px-3.5 pb-3 pt-2.5">
        {withFiles ? (
          <>
            <button
              type="button"
              onClick={onSendWithFiles}
              disabled={!filesReady}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#25D366] text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {filesReady ? <FileText size={15} /> : <Loader2 size={15} className="animate-spin" />}
              {filesReady ? `Send with ${fileNames.length > 1 ? "files" : "file"}` : "Getting file ready…"}
            </button>
            <button
              type="button"
              onClick={() => onSend(text)}
              className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg text-xs font-medium text-[var(--muted-foreground)] transition hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
            >
              <Send size={13} /> Send as link instead (opens their chat)
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => onSend(text)}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#25D366] text-sm font-semibold text-white transition hover:opacity-90"
          >
            <Send size={15} /> Send on WhatsApp
          </button>
        )}
      </div>
    </div>
  );
}

function TemplateEditor({
  initial,
  attachables,
  onSave,
  onCancel,
  onDelete,
}: {
  initial: GreetingTemplate | null;
  attachables: Attachable[];
  onSave: (t: GreetingTemplate) => Promise<string | null>;
  onCancel: () => void;
  onDelete?: () => Promise<string | null>;
}) {
  const [heading, setHeading] = useState(initial?.heading ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [attach, setAttach] = useState<string[]>(initial?.attach ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function insert(token: string) {
    setBody((b) => `${b}${b && !b.endsWith(" ") && !b.endsWith("\n") ? " " : ""}${token}`);
  }

  function applySample(s: (typeof SAMPLE_TEMPLATES)[number]) {
    setHeading(s.heading);
    setBody(s.body);
    setAttach(s.attach.filter((k) => attachables.some((a) => a.key === k)));
  }

  async function save() {
    if (!heading.trim() && !body.trim()) return setError("Write a heading or a message.");
    setBusy(true);
    setError(null);
    const err = await onSave({
      id: initial?.id ?? Math.random().toString(36).slice(2, 10),
      heading: heading.trim().slice(0, 60),
      body: body.slice(0, 1000),
      attach,
    });
    setBusy(false);
    if (err) setError(err);
  }

  return (
    <div className="space-y-4">
      {!initial && (
        <div>
          <p className="mb-1.5 flex items-center gap-1 text-xs font-medium text-[var(--muted-foreground)]">
            <LayoutTemplate size={12} /> Start from a sample
          </p>
          <div className="flex flex-wrap gap-1.5">
            {SAMPLE_TEMPLATES.map((s) => (
              <button
                key={s.heading}
                type="button"
                onClick={() => applySample(s)}
                className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--foreground)] transition hover:bg-[var(--muted)]"
              >
                {s.heading}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className={ui.label}>Heading</label>
        <input
          value={heading}
          onChange={(e) => setHeading(e.target.value)}
          placeholder="e.g. Our menu"
          maxLength={60}
          className={ui.input}
        />
        <span className={ui.hint}>Sent in bold at the top.</span>
      </div>

      <div>
        <label className={ui.label}>Message</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          maxLength={1000}
          placeholder="Hi {name}, thank you for visiting us…"
          className={`${ui.input} h-auto resize-none py-2.5 leading-relaxed`}
        />
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {[
            ["Their name", "{name}"],
            ["My name", "{my_name}"],
            ["My designation", "{designation}"],
            ["Company", "{company}"],
          ].map(([label, token]) => (
            <button
              key={token}
              type="button"
              onClick={() => insert(token)}
              className="rounded-md bg-[var(--muted)] px-2 py-1 text-[11px] font-medium text-[var(--foreground)] transition hover:opacity-80"
            >
              + {label}
            </button>
          ))}
        </div>
        <span className={ui.hint}>These fill in automatically for each person and for each team member.</span>
      </div>

      <div>
        <label className={ui.label}>Add links from your profile</label>
        {attachables.length === 0 ? (
          <p className="text-xs text-[var(--muted-foreground)]">
            Add a brochure, menu, website or Google review link to your profile to send them here.
          </p>
        ) : (
          <div className="space-y-1.5">
            {attachables.map((a) => {
              const on = attach.includes(a.key);
              return (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => setAttach((list) => (on ? list.filter((k) => k !== a.key) : [...list, a.key]))}
                  className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm transition ${on ? "border-[var(--foreground)] bg-[var(--muted)]" : "border-[var(--border)]"}`}
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${on ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]" : "border-[var(--muted-foreground)]"}`}
                  >
                    {on && <Check size={11} />}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">{a.label}</span>
                </button>
              );
            })}
          </div>
        )}
        <span className={ui.hint}>
          Brochure and uploaded files can be sent as the actual file on phones (&ldquo;Send with file&rdquo;), or as a short
          link like nammainfo.in/doc/yourname/brochure.
        </span>
      </div>

      {error && <p className={ui.error}>{error}</p>}

      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className={ui.secondary}>
          Back
        </button>
        <button type="button" onClick={save} disabled={busy} className={ui.primary}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Save
        </button>
      </div>
      {onDelete && (
        <button
          type="button"
          onClick={async () => {
            setBusy(true);
            const err = await onDelete();
            setBusy(false);
            if (err) setError(err);
          }}
          className={`${ui.ghost} text-red-600 hover:text-red-700`}
        >
          <Trash2 size={14} /> Delete this message
        </button>
      )}
    </div>
  );
}
