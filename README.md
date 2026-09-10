# Namma Info — Web (Next.js)

Public-facing NFC/QR landing site. This is Phase 2 of the MVP — it covers
everything a tapped or scanned card needs, standalone, with no app
required.

## What's implemented

- `/c/[cardId]` — SSR card landing page. Accepts either the card's UUID
  (what gets written to the physical NFC chip) or its human-readable
  `public_slug`. Renders the modern digital-card preview, quick actions
  (call / email / website / share), a "Save Contact (.vcf)" download, and
  an app/web CTA.
- `/api/vcard/[profileId]` — generates a real vCard 3.0 file server-side
  (`vcards-js`), streamed with the correct `Content-Type` /
  `Content-Disposition` headers so it saves straight into Contacts on iOS
  and Android.
- `/.well-known/assetlinks.json` and `/.well-known/apple-app-site-association`
  — scaffolded for Android App Links / iOS Universal Links. **Both contain
  placeholders** (`sha256_cert_fingerprints`, Team ID) — fill these in once
  you have a release signing key and an Apple Team ID, or the OS-level
  Universal/App Links won't verify (the web pages themselves work fine in
  the meantime).

## The "app not live yet" behaviour

`NEXT_PUBLIC_APP_IS_LIVE` (in `.env.local`) controls the secondary CTA on
the card page:
- `false` (default) → button reads **"Continue in Web App"** and simply
  confirms the person is already in the full experience. No dead store
  links, nothing that can 404 during App/Play Store review or before
  launch.
- `true` → button reads **"Open in Namma Info App"**, attempts the
  `nammainfo://profile/:id` deep link, and falls back to the correct store
  listing if the app isn't installed.

Flip it the day both listings are approved — no other code changes needed.

## Setup

```bash
cp .env.local.example .env.local
npm install
npm run dev
```

The Supabase URL and anon (publishable) key already point at the live
`Nammainfo` project — schema, RLS, and the profile-creation trigger are
already deployed there.

## Not yet built (next phases)

- Auth pages (sign in / sign up) — the schema and RLS support them, but the
  spec you gave only asked the web app to handle public card routing +
  vCard + universal links. Happy to add a lightweight web dashboard next if
  you want profile editing outside the Flutter app.
- Tap-count increment on card view (`cards.tap_count`) needs a
  `SECURITY DEFINER` RPC since anonymous visitors can't write directly
  under the current RLS — flagging rather than silently adding write
  access.
