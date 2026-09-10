import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="font-display text-2xl">This card isn&rsquo;t active</h1>
      <p className="max-w-sm text-sm text-ink-700/70">
        The card you tapped or scanned may have been deactivated, or the link
        is incorrect.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-xl bg-ink-950 px-4 py-2.5 text-sm font-medium text-white"
      >
        Go to Namma Info
      </Link>
    </main>
  );
}
