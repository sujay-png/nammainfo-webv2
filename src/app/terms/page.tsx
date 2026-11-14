import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, FileText, Globe, Mail } from "lucide-react";

export const metadata: Metadata = {
  title: "Terms of Service | Namma Info",
  description: "Terms and Conditions governing the use of Namma Info digital smart cards and services.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] selection:bg-[var(--foreground)] selection:text-[var(--background)]">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/icons/icon-192.png"
              alt="Namma Info logo"
              width={28}
              height={28}
              className="rounded-[4px]"
            />
            <span className="font-headline text-base font-bold tracking-tight text-[var(--foreground)]">
              Namma Info
            </span>
          </Link>

          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-[5px] border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors"
          >
            <ArrowLeft size={13} />
            <span>Back to Home</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="space-y-4 border-b border-[var(--border)] pb-8">
          <div className="inline-flex items-center gap-2 rounded-[4px] bg-[var(--accent)] px-2.5 py-1 text-xs font-mono font-medium text-[var(--muted-foreground)]">
            <FileText size={13} className="text-sky-500" />
            <span>User Agreement</span>
          </div>
          <h1 className="font-headline text-3xl sm:text-4xl font-bold tracking-tight text-[var(--foreground)]">
            Terms of Service
          </h1>
          <p className="text-xs text-[var(--muted-foreground)] font-mono">
            Last Updated: November 14, 2026 • Effective Date: January 1, 2026
          </p>
        </div>

        <div className="mt-8 space-y-10 text-sm leading-relaxed text-[var(--muted-foreground)]">
          <section className="space-y-3">
            <h2 className="font-headline text-lg font-bold text-[var(--foreground)]">
              1. Acceptance of Terms
            </h2>
            <p>
              By accessing or using the Namma Info platform at{" "}
              <Link href="https://nammainfo.in" className="text-[var(--foreground)] underline underline-offset-4">
                nammainfo.in
              </Link>
              , ordering physical NFC cards, or creating a digital profile, you agree to be bound by these Terms of Service.
              If you do not agree, please do not use our services.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-headline text-lg font-bold text-[var(--foreground)]">
              2. Digital Profiles & Content Ownership
            </h2>
            <p>
              You retain ownership of the text, logos, contact information, and artwork you publish on your Namma Info profile.
              You represent that you have all necessary rights to publish this content and that it does not infringe on third-party intellectual property,
              contain unlawful material, or mislead consumers.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-headline text-lg font-bold text-[var(--foreground)]">
              3. Subscriptions, Physical Cards & Fulfillment
            </h2>
            <p>
              Namma Info offers free trial plans, annual Pro subscriptions, and physical NFC smart business cards.
              Physical cards are custom-printed and programmed based on your specifications. Payment processing is handled securely
              via authorized gateways (Razorpay).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-headline text-lg font-bold text-[var(--foreground)]">
              4. WhatsApp & Communication Services
            </h2>
            <p>
              By providing your mobile phone number, you consent to receive account notifications, fulfillment alerts,
              and customer service messages via WhatsApp and SMS in accordance with our Privacy Policy.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-headline text-lg font-bold text-[var(--foreground)]">
              5. Contact & Inquiries
            </h2>
            <div className="rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-4 text-xs font-mono space-y-2">
              <div className="flex items-center gap-2">
                <Globe size={14} className="text-[var(--muted-foreground)]" />
                <span>Namma Info • https://nammainfo.in</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail size={14} className="text-[var(--muted-foreground)]" />
                <span>support@nammainfo.in</span>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] py-8 text-center text-xs text-[var(--muted-foreground)]">
        <div className="mx-auto max-w-5xl px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} Namma Info. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/terms" className="hover:text-[var(--foreground)] underline underline-offset-4">
              Terms of Service
            </Link>
            <Link href="/privacy-policy" className="hover:text-[var(--foreground)] underline underline-offset-4">
              Privacy Policy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

