import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-white px-4">
      <div className="text-center">
        <p className="text-6xl font-bold text-ink-200">404</p>
        <h1 className="mt-3 text-lg font-semibold text-ink-900">
          Page not found
        </h1>
        <p className="mt-1 text-sm text-ink-400">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-ink-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-ink-800"
        >
          Go home
        </Link>
      </div>
    </main>
  );
}
