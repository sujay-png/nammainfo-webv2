import s from "./manual.module.css";

/** How the pieces talk to each other (same picture as the Developer Guide). */
export default function ArchitectureDiagram() {
  const line = "var(--m-line-strong)";
  const ink = "var(--m-ink)";
  const soft = "var(--m-faint)";
  const brand = "var(--m-brand)";
  const box = { fill: "var(--m-surface)", stroke: line, strokeWidth: 1.25, rx: 10 } as const;
  const text = { fontSize: 11.5, fill: soft } as const;
  const name = { fontSize: 13, fontWeight: 600, fill: ink } as const;

  return (
    <figure className={s.figure}>
      <svg viewBox="0 0 760 424" role="img" aria-label="Phones talk to Supabase directly; money and secrets go through our server">
        <defs>
          <marker id="arch-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0 0L10 5L0 10z" fill={line} />
          </marker>
        </defs>
        <text x="24" y="34" fontSize="15" fontWeight="600" fill={ink}>
          Phones talk to Supabase directly; money and secrets go through our server
        </text>

        <g fill="none" stroke={line} strokeWidth="1.25">
          <path d="M184 128V184" markerEnd="url(#arch-arrow)" />
          <path d="M580 128V184" markerEnd="url(#arch-arrow)" />
          <path d="M344 236H424" markerEnd="url(#arch-arrow)" />
          <path d="M184 288V344" markerStart="url(#arch-arrow)" markerEnd="url(#arch-arrow)" />
        </g>

        <rect x="24" y="56" width="712" height="72" {...box} />
        <text x="40" y="80" {...name}>Customer&apos;s phone or browser</text>
        <text x="40" y="96" {...text}>Next.js pages: card pages, dashboard, scanner, admin console</text>
        <text x="40" y="112" {...text}>
          Most saves go straight to Supabase as the signed-in user; the database decides what is allowed
        </text>

        <rect x="24" y="184" width="320" height="104" {...box} />
        <text x="40" y="208" {...name}>Vercel: Next.js server</text>
        <text x="40" y="224" {...text}>Card pages pre-built, refreshed every 30 s</text>
        <text x="40" y="240" {...text}>API routes: payments, card-upload links,</text>
        <text x="40" y="256" {...text}>employee logins, trial, admin console</text>
        <text x="40" y="272" {...text}>Holds the secret keys (service role, Razorpay)</text>

        <rect x="424" y="184" width="312" height="104" rx="10" fill="var(--m-brand-soft)" stroke={brand} strokeWidth="2" />
        <text x="440" y="208" {...name}>Supabase: the source of truth</text>
        <text x="440" y="224" fontSize="11.5" fill={ink}>Postgres: profiles, cards, team, contacts,</text>
        <text x="440" y="240" fontSize="11.5" fill={ink}>saved cards, orders; RLS + guard triggers</text>
        <text x="440" y="256" fontSize="11.5" fill={ink}>Auth: sign-in, sign-up, password reset</text>
        <text x="440" y="272" fontSize="11.5" fill={ink}>Storage: private business-card photos</text>

        <rect x="24" y="344" width="320" height="56" {...box} />
        <text x="40" y="368" {...name}>Razorpay</text>
        <text x="40" y="384" {...text}>Checkout popup (UPI, cards); webhook on payment</text>

        <text x="192" y="160" {...text}>page loads, API calls</text>
        <text x="588" y="160" {...text}>reads and writes (RLS)</text>
        <text x="384" y="228" textAnchor="middle" {...text}>service role</text>
        <text x="192" y="320" {...text}>create order, verify, webhook</text>
      </svg>
      <figcaption>
        The browser uses the public key; Postgres row-level security and guard triggers decide what each person may do.
        Only work that needs a secret runs on the server.
      </figcaption>
    </figure>
  );
}
