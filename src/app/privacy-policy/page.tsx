import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Shield, Lock, Trash2, Mail, Globe } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy | Namma Info",
  description:
    "Privacy Policy and User Data Deletion Instructions for Namma Info digital smart cards and messaging platform.",
};

export default function PrivacyPolicyPage() {
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
            <Shield size={13} className="text-emerald-500" />
            <span>Legal Documentation</span>
          </div>
          <h1 className="font-headline text-3xl sm:text-4xl font-bold tracking-tight text-[var(--foreground)]">
            Privacy Policy
          </h1>
          <p className="text-xs text-[var(--muted-foreground)] font-mono">
            Last Updated: November 14, 2026 • Effective Date: January 1, 2026
          </p>
        </div>

        <div className="mt-8 space-y-10 text-sm leading-relaxed text-[var(--muted-foreground)]">
          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="font-headline text-lg font-bold text-[var(--foreground)]">
              1. Introduction & Overview
            </h2>
            <p>
              Namma Info (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) operates the website{" "}
              <Link href="https://nammainfo.in" className="text-[var(--foreground)] underline underline-offset-4">
                nammainfo.in
              </Link>
              , the Namma Info Smart Digital Business Card platform, and associated messaging services.
              We are committed to safeguarding the privacy and security of our business owners, team members,
              and card recipients.
            </p>
            <p>
              This Privacy Policy explains what personal information we collect, why we collect it, how it is used
              and protected, and your rights regarding your personal information, including how to request the deletion
              of your data.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="font-headline text-lg font-bold text-[var(--foreground)]">
              2. Information We Collect
            </h2>
            <p>We collect information to provide, maintain, and improve our services, including:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong className="text-[var(--foreground)]">Account & Profile Information:</strong> Name, business name,
                designation, phone number, email address, physical address, business logo, social media links, and profile photos.
              </li>
              <li>
                <strong className="text-[var(--foreground)]">Digital Card & Contact Sharing Data:</strong> Virtual contact card
                details (vCard), exchanged contact details when a visitor chooses to exchange their contact information with you,
                and business card images uploaded for digitizing.
              </li>
              <li>
                <strong className="text-[var(--foreground)]">Messaging & Communications:</strong> Transactional communications,
                customer service messages, order updates, and WhatsApp notifications sent via our integrated Meta WhatsApp Cloud API.
              </li>
              <li>
                <strong className="text-[var(--foreground)]">Order & Payment Information:</strong> Billing address, shipping address,
                and payment transaction identifiers processed securely through our payment gateway partners (Razorpay).
                We do not store your full debit/credit card numbers or CVV.
              </li>
              <li>
                <strong className="text-[var(--foreground)]">Technical & Usage Data:</strong> IP address, device type, browser type,
                card view statistics, and timestamp of card scans to provide card performance analytics to the card owner.
              </li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="font-headline text-lg font-bold text-[var(--foreground)]">
              3. How We Use Your Information
            </h2>
            <p>We use the collected information for the following purposes:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>To create and host your interactive digital business card profile.</li>
              <li>To manufacture, encode, and ship physical NFC smart cards and QR cards.</li>
              <li>To allow card visitors to save your contact information (vCard) and share their contact information with you.</li>
              <li>To provide order confirmation, renewal reminders, and customer support via Email and WhatsApp.</li>
              <li>To detect and prevent fraudulent use, abuse, or unauthorized access.</li>
              <li>To comply with applicable legal and statutory requirements.</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="font-headline text-lg font-bold text-[var(--foreground)]">
              4. WhatsApp Business Platform & Meta Integration
            </h2>
            <p>
              Namma Info integrates with the official Meta WhatsApp Business Platform (WhatsApp Cloud API) to send
              essential transactional alerts (e.g., account activation, order updates, delivery notifications) and to facilitate
              two-way customer support.
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                We only communicate via WhatsApp with users who have provided their phone number or initiated a conversation with our business.
              </li>
              <li>
                We adhere strictly to Meta&apos;s WhatsApp Business Messaging Policy and Meta Platform Terms.
              </li>
              <li>
                We never sell, rent, or trade your phone number or messaging history to third-party advertisers.
              </li>
            </ul>
          </section>

          {/* Section 5 - USER DATA DELETION INSTRUCTIONS (Required by Meta) */}
          <section id="data-deletion" className="space-y-3 rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-6">
            <div className="flex items-center gap-2 text-rose-500">
              <Trash2 size={18} />
              <h2 className="font-headline text-base font-bold text-[var(--foreground)]">
                5. User Data Deletion Instructions
              </h2>
            </div>
            <p>
              Namma Info respects your right to control your personal data. In compliance with Meta Platform Terms and data privacy regulations,
              users may request the complete deletion of their account and associated data at any time.
            </p>
            <div className="space-y-2 pt-2">
              <p className="font-semibold text-[var(--foreground)]">
                How to request data deletion:
              </p>
              <ol className="list-decimal pl-5 space-y-1.5">
                <li>
                  <strong>From your dashboard:</strong> Log in to your Namma Info account, navigate to{" "}
                  <strong className="text-[var(--foreground)]">Settings → Account Security</strong>, and submit an account deletion request.
                </li>
                <li>
                  <strong>By Email:</strong> Send an email to{" "}
                  <a href="mailto:support@nammainfo.in" className="text-[var(--foreground)] underline font-mono">
                    support@nammainfo.in
                  </a>{" "}
                  with the subject line <code className="text-xs bg-[var(--background)] px-1.5 py-0.5 rounded border border-[var(--border)] font-mono">&quot;Data Deletion Request&quot;</code> from your registered email address.
                </li>
              </ol>
            </div>
            <p className="text-xs text-[var(--muted-foreground)] pt-2 border-t border-[var(--border)]">
              Upon receiving your request, we will verify your identity and permanently delete your profile, cards, uploaded photos,
              and exchanged contacts from our primary database within 30 days, retaining only transaction records required by law for taxation and accounting.
            </p>
          </section>

          {/* Section 6 */}
          <section className="space-y-3">
            <h2 className="font-headline text-lg font-bold text-[var(--foreground)]">
              6. Data Security & Storage
            </h2>
            <p>
              We implement industry-standard administrative, technical, and physical security safeguards. Data is stored in secure
              cloud data centers with encrypted connections (TLS/HTTPS). Database access is strictly governed by Row Level Security (RLS)
              and role-based access control.
            </p>
          </section>

          {/* Section 7 */}
          <section className="space-y-3">
            <h2 className="font-headline text-lg font-bold text-[var(--foreground)]">
              7. Contact Us
            </h2>
            <p>
              If you have any questions or concerns regarding this Privacy Policy or our data handling practices, please contact us:
            </p>
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

