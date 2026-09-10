import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col items-center justify-center gap-6 px-6 text-center">
      <span className="rounded-full border border-ink-900/10 bg-white px-3 py-1 text-xs font-medium tracking-wide text-ink-700">
        NAMMA INFO
      </span>
      <h1 className="text-balance font-display text-4xl font-medium leading-tight sm:text-5xl">
        One tap. One scan. Instant connection.
      </h1>
      <p className="max-w-xl text-balance text-ink-700/80">
        Namma Info turns your printed business card into a living profile —
        tap the NFC card or scan the QR code on the back, and your contact,
        socials, and latest updates are one link away.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        <Link
          href="/c/demo"
          className="rounded-xl bg-ink-950 px-5 py-3 text-sm font-medium text-white shadow-card transition hover:opacity-90"
        >
          View a sample card
        </Link>
        <a
          href="mailto:director@aksharadigital.in"
          className="rounded-xl border border-ink-900/15 bg-white px-5 py-3 text-sm font-medium text-ink-900 transition hover:bg-ink-900/5"
        >
          Get your card
        </a>
      </div>
    </main>
  );
}
