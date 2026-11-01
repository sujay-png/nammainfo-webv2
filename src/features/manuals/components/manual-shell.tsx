import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Mail } from "lucide-react";
import ManualToc, { type TocEntry } from "./manual-toc";
import ThemeButton from "./theme-button";
import s from "./manual.module.css";

/**
 * Page frame shared by /user-manual and /developers-manual:
 * sticky header with the two manuals as tabs, a hero, a sticky table of
 * contents (sidebar on desktop, dropdown on phones) and a footer.
 */
export default function ManualShell({
  active,
  hero,
  toc,
  children,
}: {
  active: "user" | "developers";
  hero: React.ReactNode;
  toc: TocEntry[];
  children: React.ReactNode;
}) {
  return (
    <div className={s.root}>
      <header className={s.header}>
        <div className={s.headerInner}>
          <Link href="/" className={s.brand} aria-label="Namma Info home">
            <Image src="/icons/icon-192.png" alt="" width={30} height={30} className={s.brandMark} priority />
            <span className={s.brandName}>namma info</span>
            <span className={s.brandDivider} aria-hidden />
            <span className={s.brandSub}>Help Center</span>
          </Link>

          <nav className={s.tabs} aria-label="Manuals">
            <Link
              href="/user-manual"
              className={`${s.tab} ${active === "user" ? s.tabActive : ""}`}
              aria-current={active === "user" ? "page" : undefined}
            >
              User manual
            </Link>
            <Link
              href="/developers-manual"
              className={`${s.tab} ${active === "developers" ? s.tabActive : ""}`}
              aria-current={active === "developers" ? "page" : undefined}
            >
              Developers
            </Link>
          </nav>

          <span className={s.headerSpacer} />
          <ThemeButton />
          <Link href="/dashboard/home" className={s.openApp}>
            Open the app <ArrowUpRight size={15} />
          </Link>
        </div>
      </header>

      {hero}

      <div className={s.layout}>
        <ManualToc entries={toc} />
        <main className={s.content} id="manual-content">
          {children}

          <aside className={s.helpCard}>
            <div>
              <h3>Still have a question?</h3>
              <p>Write to us with your page link and a screenshot. We usually reply within a working day.</p>
            </div>
            <a className={s.helpCardLink} href="mailto:support@nammainfo.in">
              <Mail size={16} /> support@nammainfo.in
            </a>
          </aside>
        </main>
      </div>

      <footer className={s.footer}>
        <div className={s.footerInner}>
          <span>&copy; {new Date().getFullYear()} Namma Info · Adithya Puthraya</span>
          <span className={s.footerLinks}>
            <Link href="/">Home</Link>
            <Link href="/user-manual">User manual</Link>
            <Link href="/developers-manual">Developer docs</Link>
            <Link href="/signup">Get your card</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
