"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { AlertTriangle, Info, Lightbulb } from "lucide-react";
import s from "./manual.module.css";

/* Building blocks for the manuals: sections, steps, callouts, screenshots. */

export function Section({
  id,
  num,
  title,
  children,
}: {
  id: string;
  num: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={`${s.section} ${s.prose}`}>
      <span className={s.sectionNum}>{String(num).padStart(2, "0")}</span>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function Sub({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <>
      <h3 id={id}>{title}</h3>
      {children}
    </>
  );
}

export function Steps({ children }: { children: React.ReactNode }) {
  return <ol className={s.steps}>{children}</ol>;
}

export function Step({ title, children }: { title?: string; children?: React.ReactNode }) {
  return (
    <li className={s.step}>
      {title && <span className={s.stepTitle}>{title}</span>}
      {children}
    </li>
  );
}

const CALLOUT = {
  tip: { cls: s.calloutTip, Icon: Lightbulb, label: "Tip" },
  info: { cls: s.calloutInfo, Icon: Info, label: "Good to know" },
  warn: { cls: s.calloutWarn, Icon: AlertTriangle, label: "Important" },
};

export function Callout({
  kind = "info",
  title,
  children,
}: {
  kind?: keyof typeof CALLOUT;
  title?: string;
  children: React.ReactNode;
}) {
  const c = CALLOUT[kind];
  return (
    <div className={`${s.callout} ${c.cls}`} role="note">
      <c.Icon size={18} className={s.calloutIcon} aria-hidden />
      <div>
        <span className={s.calloutTitle}>{title ?? c.label}</span>
        {children}
      </div>
    </div>
  );
}

export interface Shot {
  src: string;
  title: string;
  caption?: string;
  /** Screenshot pixel size; all phone captures are 450 × 974. */
  width?: number;
  height?: number;
}

/** One or more real app screenshots in phone frames; tap to enlarge. */
export function Screens({ shots }: { shots: Shot[] }) {
  const [zoom, setZoom] = useState<Shot | null>(null);

  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setZoom(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoom]);

  return (
    <>
      <div className={`${s.shots} ${shots.length === 1 ? s.shotsSingle : ""}`}>
        {shots.map((shot) => (
          <figure key={shot.src} className={s.shot}>
            <button
              type="button"
              className={s.zoomButton}
              onClick={() => setZoom(shot)}
              aria-label={`Enlarge screenshot: ${shot.title}`}
            >
              <div className={s.phone}>
                <Image
                  src={shot.src}
                  alt={shot.caption ? `${shot.title}. ${shot.caption}` : shot.title}
                  width={shot.width ?? 450}
                  height={shot.height ?? 974}
                  sizes="(max-width: 760px) 70vw, 240px"
                />
              </div>
            </button>
            <figcaption className={s.shotCaption}>
              <b>{shot.title}</b>
              {shot.caption}
            </figcaption>
          </figure>
        ))}
      </div>
      {zoom && (
        <div className={s.lightbox} onClick={() => setZoom(null)} role="dialog" aria-label={zoom.title}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom.src} alt={zoom.title} />
        </div>
      )}
    </>
  );
}
