"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Check, Lock, ScanLine } from "lucide-react";
import { createClient } from "@/supabase/client";
import { getCurrentUser } from "@/supabase/current-user";
import Avatar from "@/components/ui/avatar";
import { ui } from "@/components/ui/sheet";
import { compressCardPhoto } from "@/features/contacts/lib/compress-card-photo";
import {
  requestCardUploadLinks,
  uploadCardPhoto,
  type CardUploadLinks,
} from "@/features/contacts/services/business-card-upload.service";

/**
 * Shown when someone taps / scans a card, before they see it:
 * "Share your name and number". The details land in the card owner's
 * (or employee's) Contacts tab.
 *
 * - Signed-in Namma Info users: shared silently from their profile. No form.
 * - Visitors who already filled it once on this phone: shared silently,
 *   with a small note. No form again.
 * - The card's own business (owner / team): nothing happens.
 *
 * Optional: "Scan your business card" opens the camera for the front, then
 * the back. As soon as the back photo is taken the visitor goes straight to
 * the profile; the photos are compressed (~80-180 KB) and uploaded in the
 * background. With a card photo, typing a name/number becomes optional.
 */
const DETAILS_KEY = "nammainfo:visitorDetails";

interface Details {
  name: string;
  phone?: string;
  email?: string;
}

function readDetails(): Details | null {
  try {
    const d = JSON.parse(localStorage.getItem(DETAILS_KEY) || "null") as Details | null;
    return d?.name && (d.phone || d.email) ? d : null;
  } catch {
    return null;
  }
}

function submit(
  ownerId: string,
  employeeId: string | null,
  d: Details,
  source: string,
  card?: { front: string | null; back: string | null }
) {
  return createClient()
    .rpc("submit_contact", {
      p_owner_id: ownerId,
      p_employee_id: employeeId,
      p_name: d.name,
      p_phone: d.phone ?? null,
      p_email: d.email ?? null,
      p_source: source,
      p_card_front: card?.front ?? null,
      p_card_back: card?.back ?? null,
    } as never)
    .then(({ error }) => {
      if (error) console.warn("[VisitorDetailsGate]", error.message);
    });
}

export default function VisitorDetailsGate({
  ownerId,
  employeeId = null,
  personName,
  businessName,
  avatarUrl,
}: {
  ownerId: string;
  employeeId?: string | null;
  /** Whose card this is (employee name, or owner/business). */
  personName: string;
  businessName: string;
  avatarUrl?: string | null;
}) {
  const [mode, setMode] = useState<"checking" | "form" | "shared" | "none">("checking");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [useEmail, setUseEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Business card photos (optional)
  const [cardStep, setCardStep] = useState<"none" | "back">("none");
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const frontInput = useRef<HTMLInputElement>(null);
  const backInput = useRef<HTMLInputElement>(null);
  const linksRef = useRef<Promise<CardUploadLinks> | null>(null);
  const frontJobRef = useRef<Promise<string | null> | null>(null);
  useEffect(() => () => { if (frontPreview) URL.revokeObjectURL(frontPreview); }, [frontPreview]);

  const skipKey = `nammainfo:visitorSkip:${employeeId ?? ownerId}`;
  const first = personName.split(" ")[0] || personName;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const source = new URLSearchParams(window.location.search).get("src") || "card";
      const user = await getCurrentUser();
      if (cancelled) return;

      if (user) {
        if (user.id === ownerId) return setMode("none");
        // Signed-in user: share what we already know, no form.
        const { data } = await createClient()
          .from("profiles")
          .select("owner_name, business_name, phone, email")
          .eq("id", user.id)
          .maybeSingle();
        const p = (data ?? {}) as { owner_name?: string | null; business_name?: string | null; phone?: string | null; email?: string | null };
        const meta = (user.user_metadata ?? {}) as { name?: string };
        const d: Details = {
          name: p.owner_name || meta.name || p.business_name || (user.email ?? "").split("@")[0],
          phone: p.phone ?? undefined,
          email: p.email || user.email || undefined,
        };
        if (d.name) submit(ownerId, employeeId, d, source); // server ignores the business's own team
        return setMode("none");
      }

      const saved = readDetails();
      if (saved) {
        submit(ownerId, employeeId, saved, source);
        setMode("shared");
        setTimeout(() => !cancelled && setMode("none"), 3000);
        return;
      }
      try {
        if (sessionStorage.getItem(skipKey)) return setMode("none");
      } catch {}
      setMode("form");
    })();
    return () => {
      cancelled = true;
    };
  }, [ownerId, employeeId, skipKey]);

  // Lock scrolling behind the form
  useEffect(() => {
    if (mode !== "form") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mode]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (cardStep === "back") return finishWithCard(null); // card photo taken: details optional
    const n = name.trim();
    const digits = phone.replace(/[^0-9]/g, "");
    const em = email.trim();
    if (n.length < 2) return setError("Please enter your name.");
    if (!useEmail && (digits.length < 10 || digits.length > 13)) return setError("Please enter a valid phone number.");
    if (useEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return setError("Please enter a valid email.");
    const d: Details = useEmail ? { name: n, email: em } : { name: n, phone: phone.trim() };
    try {
      localStorage.setItem(DETAILS_KEY, JSON.stringify(d));
    } catch {}
    submit(ownerId, employeeId, d, new URLSearchParams(window.location.search).get("src") || "card");
    setMode("none"); // instant: don't make them wait for the network
  }

  /** Valid parts of whatever the visitor typed (all optional with a card). */
  function typedDetails(): Details {
    const n = name.trim();
    const digits = phone.replace(/[^0-9]/g, "");
    const em = email.trim();
    return {
      name: n.length >= 2 ? n : "",
      phone: !useEmail && digits.length >= 10 && digits.length <= 13 ? phone.trim() : undefined,
      email: useEmail && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em) ? em : undefined,
    };
  }

  // Front photo taken: start compressing + uploading right away, in the
  // background, so it's usually done by the time the back is taken.
  function onFrontPhoto(file: File) {
    setError(null);
    setFrontPreview(URL.createObjectURL(file));
    setCardStep("back");
    frontJobRef.current = compressCardPhoto(file)
      .then((c) => {
        linksRef.current = requestCardUploadLinks(ownerId, employeeId, c.format);
        return linksRef.current.then((links) => uploadCardPhoto(links.front, c.blob));
      })
      .catch((e) => {
        console.warn("[business card] front", e);
        return null;
      });
  }

  // Back photo taken (or "No back side"): go to the profile immediately;
  // finish uploading and saving quietly in the background.
  function finishWithCard(backFile: File | null) {
    const d = typedDetails();
    if (d.name && (d.phone || d.email)) {
      try {
        localStorage.setItem(DETAILS_KEY, JSON.stringify(d));
      } catch {}
    }
    setMode("none");
    const source = new URLSearchParams(window.location.search).get("src") || "card";
    (async () => {
      const frontPath = (await frontJobRef.current) ?? null;
      let backPath: string | null = null;
      if (backFile && frontPath && linksRef.current) {
        try {
          const [c, links] = await Promise.all([compressCardPhoto(backFile), linksRef.current]);
          backPath = await uploadCardPhoto(links.back, c.blob);
        } catch (e) {
          console.warn("[business card] back", e);
        }
      }
      if (!frontPath && !(d.name && (d.phone || d.email))) return; // nothing to save
      await submit(ownerId, employeeId, d, source, { front: frontPath, back: backPath });
    })();
  }

  function skip() {
    try {
      sessionStorage.setItem(skipKey, "1");
    } catch {}
    setMode("none");
  }

  if (mode === "shared") {
    return (
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[75] flex justify-center px-4 pt-[env(safe-area-inset-top)]">
        <div className="flex animate-fade-in items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[13px] text-[var(--foreground)] shadow-[0_8px_24px_-12px_rgba(0,0,0,0.3)]">
          <Check size={14} className="text-emerald-600" />
          Contact details shared with {first}
        </div>
      </div>
    );
  }
  if (mode !== "form") return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="visitor-title"
    >
      <form
        onSubmit={onSubmit}
        noValidate
        className="w-full max-w-[420px] animate-slide-up rounded-t-2xl border border-[var(--border)] bg-[var(--background)] shadow-[0_-8px_40px_-12px_rgba(0,0,0,0.3)] sm:rounded-2xl"
      >
        {/* Whose card this is */}
        <div className="flex items-center gap-3 border-b border-[var(--border)] px-5 py-4">
          <Avatar name={personName} src={avatarUrl} size={40} shape="rounded" />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold text-[var(--foreground)]">{personName}</p>
            <p className="truncate text-[13px] text-[var(--muted-foreground)]">{businessName}</p>
          </div>
        </div>

        <div className="px-5 pb-5 pt-4">
          <h2 id="visitor-title" className="text-[17px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">
            Share your contact details
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-[var(--muted-foreground)]">
            So {first} can save your {useEmail ? "email" : "number"} and get back to you.
          </p>

          <div className="mt-4 space-y-3.5">
            <label className="block">
              <span className={ui.label}>Name</span>
              <input
                autoFocus
                autoComplete="name"
                placeholder="Your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={ui.input}
              />
            </label>

            <div>
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="text-[13px] font-medium text-[var(--foreground)]">{useEmail ? "Email" : "Mobile number"}</span>
                <button
                  type="button"
                  onClick={() => {
                    setUseEmail((u) => !u);
                    setError(null);
                  }}
                  className="text-xs text-[var(--muted-foreground)] underline-offset-2 hover:text-[var(--foreground)] hover:underline"
                >
                  {useEmail ? "Use mobile instead" : "Use email instead"}
                </button>
              </div>
              {useEmail ? (
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={ui.input}
                />
              ) : (
                <div className="flex h-11 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)] transition focus-within:border-[var(--muted-foreground)] focus-within:shadow-[0_0_0_3px_var(--muted)]">
                  <span className="flex items-center border-r border-[var(--border)] bg-[var(--muted)] px-3 text-[15px] text-[var(--muted-foreground)]">
                    +91
                  </span>
                  <input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    placeholder="98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-transparent px-3 text-[15px] text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Optional: business card photos */}
          <div className="mt-4">
            {cardStep === "none" ? (
              <button
                type="button"
                onClick={() => frontInput.current?.click()}
                className="flex w-full items-center gap-3 rounded-lg border border-dashed border-[var(--border)] px-3 py-2.5 text-left transition hover:bg-[var(--muted)]"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--muted)] text-[var(--foreground)]">
                  <ScanLine size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-[var(--foreground)]">Scan your business card</span>
                  <span className="block text-xs text-[var(--muted-foreground)]">Optional. Front and back, takes a few seconds.</span>
                </span>
                <Camera size={16} className="shrink-0 text-[var(--muted-foreground)]" />
              </button>
            ) : (
              <div className="rounded-lg border border-[var(--border)] p-3">
                <div className="flex items-center gap-3">
                  {frontPreview && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={frontPreview} alt="Front of your card" className="h-11 w-[70px] shrink-0 rounded-md border border-[var(--border)] object-cover" />
                  )}
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-sm font-medium text-[var(--foreground)]">
                      <Check size={14} className="text-emerald-600" /> Front added
                    </p>
                    <p className="text-xs text-[var(--muted-foreground)]">Now take a photo of the back.</p>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => backInput.current?.click()} className={`${ui.primary} !h-10 flex-1 !text-sm`}>
                    <Camera size={15} /> Photo of back
                  </button>
                  <button
                    type="button"
                    onClick={() => finishWithCard(null)}
                    className="h-10 shrink-0 rounded-lg border border-[var(--border)] px-3 text-sm font-medium text-[var(--muted-foreground)] transition hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                  >
                    No back side
                  </button>
                </div>
              </div>
            )}
            {/* capture="environment" opens the back camera directly on phones */}
            <input
              ref={frontInput}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFrontPhoto(f);
                e.target.value = "";
              }}
            />
            <input
              ref={backInput}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) finishWithCard(f);
                e.target.value = "";
              }}
            />
          </div>

          {error && <p className={ui.error}>{error}</p>}

          <button type="submit" className={`${ui.primary} mt-5`}>
            Continue
          </button>

          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
              <Lock size={12} className="shrink-0" />
              Only visible to {businessName}
            </p>
            <button
              type="button"
              onClick={skip}
              className="shrink-0 rounded-md px-2 py-1 text-xs text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
            >
              Skip
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
