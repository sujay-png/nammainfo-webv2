"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import s from "./manual.module.css";

export interface TocEntry {
  id: string;
  title: string;
  children?: TocEntry[];
}

/**
 * Table of contents with scroll-spy: the section on screen is highlighted.
 * Desktop: sticky sidebar. Phones: a sticky "On this page" dropdown.
 */
export default function ManualToc({ entries }: { entries: TocEntry[] }) {
  const [active, setActive] = useState<string>(entries[0]?.id ?? "");
  const [activeChild, setActiveChild] = useState<string>("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const ids = entries.flatMap((e) => [e.id, ...(e.children ?? []).map((c) => c.id)]);
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    if (!els.length) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const line = 140; // px from the top of the screen
      let current = els[0];
      for (const el of els) {
        if (el.getBoundingClientRect().top - line <= 0) current = el;
        else break;
      }
      const parent = entries.find((e) => e.id === current.id || e.children?.some((c) => c.id === current.id));
      setActive(parent?.id ?? current.id);
      setActiveChild(parent && parent.id !== current.id ? current.id : "");
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [entries]);

  const list = (onPick?: () => void) => (
    <ol className={s.tocList}>
      {entries.map((e, i) => (
        <li key={e.id} className={`${s.tocItem} ${active === e.id ? s.tocActive : ""}`}>
          <a href={`#${e.id}`} onClick={onPick}>
            <span className={s.tocNum}>{String(i + 1).padStart(2, "0")}</span>
            {e.title}
          </a>
          {active === e.id && e.children?.length ? (
            <ol className={s.tocChildren}>
              {e.children.map((c) => (
                <li key={c.id} className={`${s.tocItem} ${activeChild === c.id ? s.tocChildActive : ""}`}>
                  <a href={`#${c.id}`} onClick={onPick}>
                    {c.title}
                  </a>
                </li>
              ))}
            </ol>
          ) : null}
        </li>
      ))}
    </ol>
  );

  const current = entries.find((e) => e.id === active);

  return (
    <>
      <div className={s.tocMobile}>
        <button
          type="button"
          className={s.tocMobileButton}
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          <span>
            <span className={s.tocNum}>On this page</span>
            {current?.title}
          </span>
          <ChevronDown size={16} style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform .2s" }} />
        </button>
        {open && <div className={s.tocMobilePanel}>{list(() => setOpen(false))}</div>}
      </div>

      <nav className={s.tocDesktop} aria-label="On this page">
        <p className={s.tocLabel}>On this page</p>
        {list()}
      </nav>
    </>
  );
}
