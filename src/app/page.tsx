import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function HomePage() {
  return (
    <main className="flex min-h-dvh flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4">
        <span className="text-sm font-semibold tracking-tight">
          namma info
        </span>
        <Link
          href="/signup"
          className="rounded-full bg-ink-950 px-4 py-2 text-xs font-medium text-white transition hover:bg-ink-800"
        >
          Get started
        </Link>
      </nav>

      {/* Hero */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-ink-200 px-3 py-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-ink-950" />
          <span className="text-xs font-medium text-ink-600">
            Digital Business Cards
          </span>
        </div>

        <h1 className="max-w-2xl text-balance text-4xl font-semibold leading-[1.1] tracking-tight sm:text-6xl">
          Your identity,
          <br />
          one tap away.
        </h1>

        <p className="mt-5 max-w-md text-balance text-sm leading-relaxed text-ink-500 sm:text-base">
          Create a stunning digital profile. Share it with NFC, QR, or a
          simple link. No app needed to receive.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          <Link
            href="/signup"
            className="group flex items-center gap-2 rounded-full bg-ink-950 px-6 py-3 text-sm font-medium text-white transition hover:bg-ink-800"
          >
            Create your card
            <ArrowRight
              size={14}
              className="transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-ink-400">
        &copy; {new Date().getFullYear()} Namma Info. All rights reserved.
      </footer>
    </main>
  );
}
