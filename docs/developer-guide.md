# Namma Info Developer Guide

Nov 1, 2026 · @Sujay Badiger

## Overview and architecture

Namma Info is a digital business card for Indian businesses. Each business gets a public card page (`nammainfo.in/<username>`) opened by tapping an NFC card or scanning a QR code. Visitors save the contact, leave their own details, and write a Google review. Owners manage the card, their team and their contacts from a dashboard that installs like an app, and the Namma Info team runs everything from an admin console.

It is **one Next.js web app** on Vercel, backed by **Supabase**. There is no separate backend service.

&#91;embedded content: Namma Info architecture · browser, Vercel, Supabase, Razorpay\]

Most reads and writes go straight from the browser to Supabase, using the public key. That's safe because Postgres decides what each signed-in user may do: row-level security (RLS) policies and guard triggers. Only work that needs a secret runs on our server: payments, upload links, creating employee logins and the admin console. Customers' phones never see the service-role key or the Razorpay secret.

### Folder map

| Folder | What lives there |
| --- | --- |
| `src/app/` | Routes: pages and API routes (`api/`). `[slug]` is the public card page |
| `src/features/<feature>/` | Everything for one feature: components, services, helpers, hooks |
| `src/admin/` | The admin console, organised by views, widgets, features, entities, shared |
| `src/components/` | Shared UI (`ui/`), layout, auth gates, providers, payment modals |
| `src/lib/` | Shared logic: membership, pricing, payments, Razorpay, themes, site URL |
| `src/supabase/` | Supabase clients: browser, server, public (cached), admin (server only) |
| `src/middleware.ts` | Refreshes the sign-in cookie; protects `/dashboard` and `/admin` |
| `supabase/migrations/` | Every database change, as SQL files run in order |
| `public/` | Icons, web app manifest, service worker |

## Technology stack

Namma Info is one Next.js app on Vercel, backed by one Supabase project. That split keeps hosting cheap and leaves no separate backend server to run.

| Layer | Technology | Version | Why we chose it |
| --- | --- | --- | --- |
| Framework | Next.js (App Router) | 14.2 | Server-rendered public pages (fast first load and good SEO for business pages), API routes for server-only work, and middleware for auth checks, all in one codebase |
| Language | TypeScript | 5.5 | Catches mistakes at build time; shared row types in `src/supabase/database-types.ts` |
| UI | React | 18.3 | Comes with Next.js; the team already knows it |
| Styling | Tailwind CSS | 3.4 | Fast to build with; theme colours are CSS variables so light/dark and colour themes switch without re-rendering |
| Icons | lucide-react | 0.453 | Clean, consistent line icons, tree-shaken |
| Database, auth, storage | Supabase (Postgres + Auth + Storage) | supabase-js 2.45 | Hosted Postgres with row-level security, email/password auth and file storage in one service. Security rules live in the database, so they apply however the data is reached |
| Supabase in Next.js | @supabase/ssr | 0.12 | Keeps the login session in cookies so server components, API routes and middleware all see the same user |
| Payments | Razorpay | 2.9 | Indian payments (UPI, cards, net banking), signed callbacks and webhooks |
| Validation | zod | 4.x | Validates admin API input and environment variables |
| QR scanning | html5-qrcode | 2.3 | Camera QR scanning in the browser, with image upload fallback |
| QR generation | qrcode | 1.5 | Generates QR images for cards in the admin console |
| Contact files | vcards-js | 2.10 | `Installed but unused: the vCard is hand-built in src/features/save-contact/lib/vcard.ts for iPhone-safe escaping. Safe to remove` |
| Image cropping | react-easy-crop | 6.2 | Crop profile, logo and cover photos before upload |
| Hosting | Vercel | n/a | Built for Next.js: preview deploys per branch, ISR caching, edge middleware |

**Things we deliberately did not add:**

- **No component library** in the customer app. The design is custom and small, so Tailwind plus a few shared pieces in `src/components/ui` is enough.
- **No state library** (Redux, Zustand). Server components fetch data; client state stays local, with one small React context for the signed-in account (`use-account`).
- **No native app.** A PWA (installable web app) covers the home-screen need on Android and iPhone without app store review. The separate Flutter app is out of scope for this guide.

## Project structure

Code is grouped **by feature**, not by file type. Pages under `src/app` stay thin (most are one-line re-exports); the real UI and logic live in `src/features/<feature>`. To find any feature, start in `src/features`.

```
src/
  app/                      Routes (URLs). Thin files only.
    (auth)/                 Sign-up, sign-in, onboarding, reset password, auth callback
    (dashboard)/dashboard/  Owner + staff dashboard: home, saved, scanner, profile, settings, team, orders, feed
    [slug]/                 Public business page: nammainfo.in/<username or card slug>
    [slug]/[employee]/      Public team-member page: nammainfo.in/<business>/<member>
    c/[cardId]/             Legacy card link by card id
    admin/                  Admin console (also served on admin.nammainfo.in)
    api/                    Server-only endpoints (see table below)
    page.tsx                Landing page (nammainfo.in)
    layout.tsx              Root layout: fonts, theme bootstrap script, ThemeProvider
  features/                 One folder per feature: components/, lib/, services/, hooks/
  components/               Shared across features: auth pages, layout shell, providers, ui pieces, plan modals
  admin/                    Admin console, organised feature-sliced: views, widgets, entities, features, shared
  supabase/                 Supabase clients (browser, server, admin) and row types
  lib/                      Plain helpers: membership rule, pricing, payments, themes, site URL, utils
  hooks/                    use-account, use-theme
  middleware.ts             Session refresh + route protection + admin subdomain routing
public/                     Icons, manifest.webmanifest, sw.js (service worker)
supabase/migrations/        SQL migrations, run by hand in the Supabase SQL Editor
```

### Features (`src/features`)

| Folder | What it does | Key files |
| --- | --- | --- |
| `landing` | The marketing home page with scroll animations | `components/landing-page.tsx`, `hooks/use-scroll-progress.ts` |
| `onboarding` | 3-step setup after sign-up | `components/onboarding-wizard.tsx` |
| `business-type` | Business type picker + the one-time "pick your type" popup | `lib/business-types.ts`, `components/business-type-picker.tsx` |
| `profile` | Owner's profile editor (all sections, photo crop, Google review link) | `components/profile-editor.tsx` |
| `public-profile` | The public business page, team-member pages, tap counting, review suggestions | `components/public-profile-view.tsx`, `lib/card-lookup.ts`, `components/tap-counter.tsx` |
| `save-contact` | "Add to Contacts" (vCard) for Android and iPhone | `lib/vcard.ts`, `lib/save-contact.ts` |
| `saved-cards` | Auto-save cards you open; Saved tab (cards + contacts) | `services/saved-cards.service.ts`, `components/auto-save-card.tsx`, `components/saved-cards-and-contacts.tsx` |
| `contacts` | Visitor "share your details" popup and business-card photo upload | `components/visitor-details-popup.tsx`, `lib/compress-card-photo.ts`, `services/business-card-upload.service.ts` |
| `testimonials` | Customer testimonials with optional author photo: editor and public carousel | `types.ts`, `components/testimonials-editor.tsx`, `components/public-testimonials.tsx` |
| `clients` | "Our Clients" logos with optional website links | `types.ts`, `components/clients-editor.tsx`, `components/public-clients.tsx` |
| `phone-required` | One-time "Add your mobile number" popup for older accounts | `components/phone-required-popup.tsx` |
| `team` | Team members and their logins | `components/team-page.tsx`, `components/employee-login-access.tsx` |
| `employee-dashboard` | What a staff login sees | `components/employee-home.tsx`, `employee-profile.tsx`, `employee-settings.tsx` |
| `home` | Owner's Home screen: stats, plan status, profile completion | `components/home-dashboard.tsx` |
| `scanner` | Scan a card by camera, NFC, screenshot or typed link | `components/card-scanner.tsx` |
| `install-app` | Add-to-home-screen popup and service worker registration | `components/add-to-home-screen-popup.tsx` |
| `settings` | Settings screen | `components/settings-page.tsx` |
| `feed` | Posts feed (early; shows "No posts yet") | `components/feed-page.tsx` |

### API routes (`src/app/api`)

| Route | Purpose |
| --- | --- |
| `vcard/[profileId]`, `vcard/employee/[employeeId]` | Returns a `.vcf` contact file |
| `contacts/card-upload` | Hands out one-time upload links for visitors' business-card photos |
| `team/access` | Creates, pauses and resets staff logins (service role) |
| `places` | Turns a pasted Google link into a review URL / place id |
| `reviews` | Stores an in-app review (rating + comment) |
| `payments/razorpay/create-order`, `verify`, `webhook` | Checkout, payment verification and the backup webhook |
| `trial/apply` | Free-trial application |
| `user/orders` | Customer's own card orders: list, change design, cancel |
| `admin/*` | Admin console data: companies, employees, orders, staff, trials |

> **Legacy shims:** `src/components/ThemeProvider.tsx` and `src/lib/supabase/*` only re-export the real modules (`src/components/providers/theme-provider.tsx`, `src/supabase/*`). They exist so older imports keep working. Use the real paths in new code.

## Setup, environment and deploying

### Run it locally

```bash
npm install          # Node 20+
# create .env.local with the variables below (ask a teammate); never commit it
npm run dev          # http://localhost:3000
npm run build        # what Vercel runs; must pass before you push
```

### Environment variables

| Variable | Where it's used | Public? |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Every Supabase client | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + server clients (limited by RLS) | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | `src/supabase/admin.ts`: staff logins, payments, trial apply, card-photo uploads, admin APIs. Bypasses RLS | **No. Server only, never prefix with `NEXT_PUBLIC_`** |
| `NEXT_PUBLIC_SITE_URL` | Links in emails and shares; must be `https://nammainfo.in` in production | Yes |
| `RAZORPAY_KEY_ID` / `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Checkout | Yes (key id only) |
| `RAZORPAY_KEY_SECRET` | Payment signature check, fetching orders | **No** |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook signature check; without it the webhook refuses all calls | **No** |
| `NEXT_PUBLIC_PLAY_STORE_URL`, `NEXT_PUBLIC_APP_STORE_URL`, `NEXT_PUBLIC_APP_SCHEME`, `NEXT_PUBLIC_APP_IS_LIVE` | "Get the app" banner on public pages; shows *Continue on Web* until `APP_IS_LIVE=true` | Yes |

The admin console validates these at build time with zod (`src/admin/shared/config/env.ts`), so a missing or too-short key fails the build early.

### Database migrations

There is no migration runner. Each file in `supabase/migrations/` is run **once, by hand, in the Supabase SQL Editor, in date order**. Every migration is written to be safe to run twice (`if not exists`, `create or replace`, `drop ... if exists`).

Before running a new one on production, test it on a local Postgres with stub `auth` schema and roles (`anon`, `authenticated`, `service_role`). That's how the security migrations in this repo were checked.

> Some early migrations (maps URL, save-card-on-tap, business type, team logins and contacts) were deleted from the folder but are still in git history. Recover them with `git log --all -- supabase/` if you need to rebuild a database from scratch.

### Supabase settings that must be right

- **Authentication → URL Configuration:** Site URL `https://nammainfo.in`; Redirect URLs `https://nammainfo.in/**` and `http://localhost:3000/**`. A `vercel.app` Site URL makes reset links ask people to log in to Vercel.
- **Custom SMTP** (for example Resend): the built-in sender is for testing only and is heavily rate-limited.
- **Storage:** private bucket `business-cards` (created by migration `20261026_contact_business_cards.sql`).

### Deploying

Vercel builds every push. `main` deploys to nammainfo.in; other branches get preview URLs (protected by Vercel login). The checklist for a release that includes SQL:

1. Run the new migration in the Supabase SQL Editor.
2. Check the Vercel environment variables.
3. Merge to `main`.
4. Smoke test: sign in, open a public page, save a contact, and (if payments changed) a test payment in Razorpay test mode.

## Authentication and routing

Login is Supabase Auth with email and password. The session lives in cookies (via `@supabase/ssr`), so the browser, server components, API routes and middleware all read the same user.

### The three Supabase clients

| File | Function | Use it for |
| --- | --- | --- |
| `src/supabase/client.ts` | `createClient()` | Client components. Anon key + the user's session; RLS applies. Auth and database calls go through `/sb` (see below) |
| `src/supabase/server.ts` | `createClient()` | Server components and API routes acting **as the signed-in user** |
| `src/supabase/server.ts` | `createPublicClient()` / `createCachedPublicClient(30)` | Public pages: anon, no session. The cached one goes through Next's data cache for 30 s |
| `src/supabase/admin.ts` | `createAdminClient()` | **Server only.** Service role, bypasses RLS. Payments, staff logins, trial apply, card-photo upload links, admin APIs |

### Sign-up

1. `src/components/auth/signup-and-signin-page.tsx` asks for email, **mobile number** and password, then calls `supabase.auth.signUp()` with the number in `options.data.phone` (account metadata). Email links point at `getSiteUrl()` (`src/lib/site-url.ts`), which always returns nammainfo.in, never a Vercel preview.
2. In the database, the `on_auth_user_created` trigger runs `handle_new_user()`. It creates a `profiles` row (copying the sign-up `phone` into `profiles.phone` since migration `20261104`) and a `cards` row with a starter slug like `user1a2b3c4d`. Slugs must match `^[a-z0-9]{4,32}$`; the function retries if one is taken.
3. The user lands on `/onboarding` (`src/features/onboarding/components/onboarding-wizard.tsx`). The 3 steps update `profiles` and set `cards.public_slug` to the chosen username. Step 2 is pre-filled with the sign-up number and won't continue without a valid one.

Errors are turned into plain messages by `friendlyAuthError()` in the same file (can't connect, wrong password, unconfirmed email, rate limits).

### Mobile number is required

Every owner account must have a valid Indian mobile number, because customers call and WhatsApp it from the card. It is enforced in four places, all using `src/lib/phone.ts`:

| Where | File | What happens |
| --- | --- | --- |
| Sign-up form | `src/components/auth/signup-and-signin-page.tsx` | Required field with +91; invalid numbers are rejected before `signUp()` |
| Setup step 2 | `src/features/onboarding/components/onboarding-wizard.tsx` | Pre-filled from sign-up; Continue and Launch both check it |
| Edit Profile | `src/features/profile/components/profile-editor.tsx` | "Mobile number" can't be cleared or saved invalid |
| Older accounts | `src/components/layout/dashboard-shell.tsx` + `src/features/phone-required/components/phone-required-popup.tsx` | If `profiles.phone` is empty: copied from sign-up metadata if present, otherwise a one-time popup that can't be dismissed. Not shown to staff logins |

```ts
// src/lib/phone.ts — accepts "98765 43210", "+91-98765-43210", "098765 43210"
export function indianMobileDigits(input) {
  let d = (input ?? "").replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : null;
}
// formatIndianMobile() stores one consistent form: "+91 98765 43210"
```

### Networks that block Supabase (the `/sb` route)

Some office firewalls and Indian ISPs block `*.supabase.co`. Users on those networks saw "can't connect" while their internet worked. So in the browser, `src/supabase/client.ts` passes a custom `fetch` to `createBrowserClient()` that sends **auth, rest and functions** calls to `https://nammainfo.in/sb/...` instead; `next.config.js` `rewrites()` forwards `/sb/auth/v1/*`, `/sb/rest/v1/*` and `/sb/functions/v1/*` to the real Supabase URL.

- The client is still created with the real Supabase URL, so the session cookie name (`sb-<ref>-auth-token`) and public storage URLs don't change.
- **Storage** (photo uploads and downloads) still goes direct, to keep large files off Vercel. On a blocking network, images may not load even though sign-in works.
- Server code (route handlers, middleware, server components) talks to Supabase directly; only browsers needed the detour.
- Turn it off with `NEXT_PUBLIC_SUPABASE_PROXY=off`.

### Middleware (`src/middleware.ts`)

Runs on `/`, `/login`, `/signin`, `/signup`, `/dashboard/*`, `/onboarding/*` and `/admin/*`. In order:

1. Refreshes the session and reads it with `supabase.auth.getClaims()`. This verifies the JWT locally, with no network call per request.
2. **`admin.*` subdomain:** rewrites clean URLs (`admin.nammainfo.in/`) to `/admin`, and sends signed-out users to `/login`.
3. **`/login`, `/signin`:** redirect to `/signup?mode=signin` (or `/dashboard` if already signed in).
4. **`/admin/*`:** signed-out → `/admin/login`. Signed in but not staff (checked in `profiles.is_admin / role`) → `/dashboard`.
5. **Admins** opening `/dashboard` or `/onboarding` → `/admin`.
6. **`/dashboard/*` signed out** → `/signup`.
7. **`/` or `/signup` signed in** → `/dashboard` (admins → `/admin`).

```ts
// src/middleware.ts (excerpt)
const { data } = await supabase.auth.getClaims();
const user = data?.claims?.sub ? { id: data.claims.sub } : null;

if (pathname.startsWith("/dashboard") && !user) {
  const url = request.nextUrl.clone();
  url.pathname = "/signup";
  return NextResponse.redirect(url);
}
```

### Email links and password reset

- `src/components/auth/forgot-password-page.tsx` calls `resetPasswordForEmail(email, { redirectTo: getSiteUrl() + "/auth/callback?next=/reset-password" })`.
- `src/app/(auth)/auth/callback/route.ts` accepts both link styles: `?code=` (`exchangeCodeForSession`, same browser only) and `?token_hash=&type=recovery` (`verifyOtp`, works on any device once the email template uses it). `next` must be a same-site path. Failed or expired links go to `/forgot-password?expired=1`.
- `src/components/auth/reset-password-page.tsx` calls `updateUser({ password })`.

### Owners vs staff

A staff login is a normal Supabase user created by the server (`/api/team/access`) with `user_metadata.role = "employee"`, `profiles.account_type = "employee"` and `employees.user_id` set. `src/components/layout/dashboard-shell.tsx` and `src/components/auth/owner-or-employee-gate.tsx` show the employee screens (`src/features/employee-dashboard`) instead of the owner's. The database decides what they can read (see *Database and security*); the UI switch is only for layout.

> **Never trust `user_metadata` for permissions.** Users can edit their own metadata. Permissions come from `app_metadata` (set by the server) or from database tables protected by RLS and triggers.

## Database and security model

The browser talks to Supabase directly with the public anon key. So **the database itself enforces every rule**: row-level security (RLS) decides which rows a user can touch, guard triggers decide which columns, and `SECURITY DEFINER` functions do the few things a visitor may do without being allowed to write tables directly.

### Tables

| Table | Holds | Who can read / write |
| --- | --- | --- |
| `profiles` | One row per account: business details, username, plan fields, trial fields, `is_admin` / `role` | Anyone reads (public pages). Owner updates own row, **except protected fields** (trigger). Admins: all |
| `cards` | A card per profile: `public_slug`, `is_active`, `tap_count` | Anyone reads. Taps only via `record_card_tap()` |
| `employees` | Team members of a business; `user_id` + `login_enabled` for staff logins; `is_premium`, expiry | Anyone reads (public team pages). Owner manages, **except billing fields and paid-slot limit** (trigger). Staff can only change their own photos |
| `connections` | Saved cards: `user_id` saved `connected_user_id` | Own rows. Writes via `save_card()` / `unsave_card()` |
| `contacts` | Visitors who shared their details; card photo paths; category, note | Owner sees all; staff see their own card's. Writes via `submit_contact()`; owners edit name, phone, email, category, note |
| `card_upload_tickets` | One-time upload permissions for card photos | Server only (no policies) |
| `reviews` | In-app reviews (rating + comment) | Public insert via `/api/reviews`; public read |
| `posts` | Feed posts (early feature) | Owner |
| `orders` | Card orders and payments | Customer reads own; may change only design and shipping while under review. Created only by the server |
| `profile_admin_notes` | Admin follow-up notes (trial + company) | Staff read, admins write. Never public |

Storage buckets: `avatars` (profile, logo, cover, gallery, team photos; public) and `business-cards` (visitors' card photos; private, 500 KB limit, JPEG/WebP only).

### Database functions

| Function | What it does |
| --- | --- |
| `handle_new_user()` | Trigger on `auth.users`: creates the profile and card for every new sign-up |
| `record_card_tap(p_card_id, p_profile_id)` | Adds 1 to `cards.tap_count` (the anon key can't update `cards`) |
| `save_card(p_owner_id)` / `unsave_card(...)` | Adds or removes a saved card for the signed-in user |
| `submit_contact(...)` | Records a visitor's details (dedupes by phone/email, normalises Indian numbers, rate-limits, checks card-photo tickets) |
| `my_employee_record()`, `update_my_employee_photo(...)`, `team_saved_cards()` | Staff dashboard reads and photo updates |
| `is_admin()`, `is_staff()`, `is_designer()` | Role checks used inside policies |

### Guard triggers (from `20261030_security_lockdown.sql`)

RLS works per **row**, but customers may update their own profile row. So a trigger decides which **columns** they may change. For requests from a customer's session (`current_user` is `anon` or `authenticated`, and not an admin), protected fields quietly keep their old value; the rest of the edit saves normally.

```sql
create or replace function public.profiles_protect_privileged()
returns trigger language plpgsql set search_path = public as $$
declare
  locked text[] := array['is_admin','role','status','subscription_plan',
    'subscription_started_at','membership_expires_at','is_member',
    'purchased_id_count','primary_card_count','account_type','card_designed',
    'trial_status','trial_coupon_code','trial_requested_at','trial_approved_at',
    'trial_extension_days','trial_follow_up_milestone','trial_follow_up_status',
    'trial_follow_up_notes'];
  n jsonb; o jsonb; c text;
begin
  if not public.is_customer_request() then return new; end if; -- server, SQL editor, admins
  n := to_jsonb(new); o := to_jsonb(old);
  foreach c in array locked loop
    if n ? c then n := jsonb_set(n, array[c], coalesce(o -> c, 'null')); end if;
  end loop;
  return jsonb_populate_record(new, n);
end $$;
```

The same pattern guards `employees` (billing fields; adding a member needs a free paid slot), `orders` (customers change only `design_url`, `design_mode`, `shipping_address`), `contacts` (`contacts_guard`) and staff edits (`employees_guard`).

**Rule for new code:** plan, role, trial and billing changes must run on the server with `createAdminClient()`. The same update from the browser is silently ignored.

### Migrations

| File | What it adds |
| --- | --- |
| `20261014_admin_and_subscriptions.sql` | `is_admin`, `status`, plan fields, employee billing fields, admin policies |
| `20261016_create_orders_table.sql` | `orders` table and policies |
| `20261026_contact_business_cards.sql` | Card-photo bucket, `card_upload_tickets`, contact photo columns, new `submit_contact` |
| `20261026_fix_signup_profiles_updated_at.sql` | Fixes sign-up: missing columns, new `handle_new_user()` with valid slugs |
| `20261029_free_trial_and_milestones.sql` | Trial columns |
| `20261030_designer_role_and_staff.sql` | `role` column, `is_staff()`, staff read policies |
| `20261030_security_lockdown.sql` | Guard triggers, `profile_admin_notes`, unique payment ids, `primary_card_count` |
| `20261104_testimonials_clients_phone.sql` | `profiles.testimonials` and `profiles.clients` (jsonb arrays with size checks); `handle_new_user()` copies the sign-up phone into `profiles.phone` |

> **Known gap:** profiles are readable column-by-column by anyone, including email, phone, GST and bank details. That's intended for public cards, but the long-term fix is a public view with only display columns.

## Public profile pages

A public page is a **server component cached for 30 seconds** (ISR). Most visits are served from cache, so a busy card costs almost nothing in database reads, and an owner's edit shows within about 30 seconds.

| URL | File | Shows |
| --- | --- | --- |
| `/<slug>` | `src/app/[slug]/page.tsx` | A business page. `slug` is a username, a card `public_slug` or a card id |
| `/<slug>/<member>` | `src/app/[slug]/[employee]/page.tsx` | A team member's page |
| `/c/<cardId>` | `src/app/c/[cardId]/page.tsx` | Old card links, kept working |

### Services and products on the page

`ServicesTabs` renders the Services and Products grids. Both show the item's `image_url` when it has one (square photo on the card, larger photo in the service details popup); without a photo, services show their emoji and products a placeholder. Services used to ignore `image_url`, so photos owners added to services never appeared.

### Photo sizes

All photo crops go through `src/components/ui/image-crop-modal.tsx`. It shows the recommended size under the title (`sizeHint()`), worked out from the crop shape, so every screen that uses it (owner profile, team page, staff profile) tells people the same thing:

| Photo | Crop shape | Saved at | We recommend |
| --- | --- | --- | --- |
| Cover | 16:9 | 1200 × 675 | 1920 × 1080 (at least 1200 × 675) |
| Logo / profile photo | Square | 400 × 400 | At least 400 × 400 |

The owner's profile also shows the cover size on the cover itself.

### How `/<slug>` is resolved

`resolveSlug()` in `src/app/[slug]/page.tsx` tries the **username** first, then a **card** by `public_slug` (or by `id` when the slug is a UUID). It's wrapped in React `cache()`, so `generateMetadata` (page title, Open Graph image) and the page share one set of queries per request.

```ts
const resolveSlug = cache(async (slug: string) => {
  const supabase = createCachedPublicClient();   // anon key, 30 s data cache
  const { data: byUsername } = await supabase
    .from("profiles").select("*").eq("username", slug).maybeSingle();
  if (byUsername) return { profile: byUsername, card: null };
  const { data: card } = await supabase
    .from("cards").select("*")
    .eq(UUID_RE.test(slug) ? "id" : "public_slug", slug).maybeSingle();
  if (!card || !card.is_active) return null;
  // ...load the card's profile
});
```

The page then loads the active card, the latest 10 reviews and active team members in parallel, and renders `PublicProfileView` (`src/features/public-profile/components/public-profile-view.tsx`).

### Who gets a live page

Before rendering, the page asks the shared membership rule (`src/lib/membership.ts`, see *Plans and payments*):

```ts
const membership = getMembership(profile);
if (membership.isSuspended) return <GatedProfileView profile={profile} reason="suspended" />;
if (membership.isFree)      return <GatedProfileView profile={profile} reason="free" />;
if (membership.isExpired)   return <GatedProfileView profile={profile} reason="expired" />;
```

`GatedProfileView` (`src/components/GatedProfileView.tsx`) shows the business name and photo with a short reason and a sign-in button for the owner.

### Tap counting

Because the page is cached, server code doesn't run once per visitor. So taps are counted in the browser by `TapTracker` (`src/features/public-profile/components/tap-counter.tsx`):

- once per visitor per browser session (a `sessionStorage` key `nammainfo:tap:<profileId>`), and
- through the `record_card_tap` database function, because the anon key may not update `cards`.

### What the page component does

`public-profile-view.tsx` (about 2,100 lines) renders the header, contact buttons, About, services and products, gallery, brochure, bank details, team, reviews and review suggestions. It also mounts the visitor details popup (`VisitorDetailsGate`), the auto-save for saved cards and the save-before-leaving prompt. It is the biggest file in the app and the first candidate for splitting into smaller components.

> **Known gap:** team-member pages (`/[slug]/[employee]`) don't apply the membership rule yet, so a member's page can stay visible when the business's plan has ended.

## Save contact (vCard)

"Add to Contacts" downloads a **vCard 3.0** file generated on the server. Getting this right on iPhone took three decisions, each in the code.

| Piece | File | Job |
| --- | --- | --- |
| Builder | `src/features/save-contact/lib/vcard.ts` | `buildVCard()` / `buildEmployeeVCard()`: name, org, title, phones, email, website, address, page URL and an embedded photo |
| Endpoints | `src/app/api/vcard/[profileId]/route.ts`, `src/app/api/vcard/employee/[employeeId]/route.ts` | Load the profile with the anon client, fetch the photo, return the `.vcf` |
| Trigger | `src/features/save-contact/lib/save-contact.ts` | `saveContactFromUrl()`: opens the file the right way per platform |

### Why it's built this way

1. **Hand-built, not a library.** Job titles like *SALES ,MARKETING & OPERATIONS HEAD* and addresses with commas or semicolons must be escaped exactly, or iOS mis-reads the card. `esc()` escapes backslashes, `;`, `,` and newlines; `fold()` wraps lines at 75 characters as the vCard standard requires (iOS is strict about the photo line).
2. **The photo is embedded, safely.** `fetchVCardPhoto()` downloads the avatar or logo with a 4-second timeout, accepts only JPEG or PNG (iOS Contacts ignores WebP), and skips anything over 400 KB. It never throws: a missing photo must never block saving.
3. **iPhone needs a real URL, not a download.** On iOS, a `blob:` or `data:` link opens a Quick Look preview whose tick button just closes it, so nothing is saved. Navigating to the real `https` URL makes Safari show the native contact card with *Create New Contact*.

```ts
// src/features/save-contact/lib/save-contact.ts
export function saveContactFromUrl(url: string, fileName = "contact.vcf") {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); // iPadOS
  if (isIOS) { window.location.href = url; return; }   // native contact sheet
  const a = document.createElement("a");               // Android / desktop: download
  a.href = url; a.download = fileName; a.click();
}
```

The response uses `Content-Type: text/vcard` and `Content-Disposition: inline` with no caching, so an updated phone number is never served stale.

## Saved cards

When a signed-in person opens someone's card, it's saved to their **Saved → Cards** at once, with no button to press. The design goal was *instant*: the UI never waits for the database.

| Piece | File | Job |
| --- | --- | --- |
| Service | `src/features/saved-cards/services/saved-cards.service.ts` | Local cache, optimistic save/unsave, pending queue for signed-out taps |
| Auto-save | `src/features/saved-cards/components/auto-save-card.tsx` | Mounted on public pages; saves on open, shows a toast with **Undo** |
| Exit prompt | `src/features/saved-cards/components/save-card-before-leaving-popup.tsx` | For signed-out visitors: offers sign-up when they try to leave |
| Saved screen | `src/features/saved-cards/components/saved-cards-and-contacts.tsx` | The Saved tab: Cards and Contacts lists |
| Database | `connections` table, `save_card(p_owner_id)` and `unsave_card(p_owner_id)` functions | One row per (user, saved card) |

### The flow

1. **Signed in:** `AutoSaveCard` reads the session locally (`getCurrentUser()`, no network wait). If it's someone else's card, it calls `saveCard()`. Your own card is skipped. A card that's already saved is moved to the top quietly, without a toast.
2. **`saveCard()` is optimistic:** it writes the card into the local cache first (`localStorage` key `nammainfo:saved:<userId>`), then calls `save_card`. If the call fails, the cache entry is removed again.
3. **Saved tab:** renders the local cache immediately, then refreshes from the database. A card saved a second ago is already there.

```ts
export async function saveCard(userId: string, card: SavedCardSummary) {
  upsertCache(userId, card);                        // instant
  const { error } = await createClient()
    .rpc("save_card", { p_owner_id: card.id } as never);
  if (error) { removeFromCache(userId, card.id); throw error; }
}
```

### Signed-out visitors

The exit prompt arms on the visitor's first touch by pushing a history entry. When they press Back, `popstate` fires and the prompt opens instead of leaving. On desktop it opens when the mouse leaves the top of the window. It shows once per card per session.

If they sign up from the prompt, the card is saved in two ways, so it survives every path:

- **Same phone:** `queuePendingSave(cardId)` adds it to `localStorage` (`nammainfo:pendingSaves`).
- **Different browser** (they open the confirmation email elsewhere): sign-up stores `pending_save` in the account's `user_metadata`.

`flushPendingSaves()` runs after sign-in, sign-up and on the dashboard. It saves both sources, then clears them. Concurrent callers share one in-flight promise, so the Saved page always loads after the save has finished. If any save fails, the queue is kept for next time.

## Visitor contacts and business-card upload

When someone opens a card, the card owner (or the employee whose card it is) gets that visitor's name and number in **Contacts**. The visitor can also photograph their own paper business card.

| Piece | File | Job |
| --- | --- | --- |
| Popup | `src/features/contacts/components/visitor-details-popup.tsx` | "Share your contact details" form; decides when to show it |
| Compression | `src/features/contacts/lib/compress-card-photo.ts` | Shrinks a 3–5 MB camera photo to about 80–180 KB |
| Upload service | `src/features/contacts/services/business-card-upload.service.ts` | Gets upload links, uploads, makes view links, deletes |
| Upload-link API | `src/app/api/contacts/card-upload/route.ts` | Server: checks the card and rate limits, issues 2 one-time links |
| Database | `supabase/migrations/20261026_contact_business_cards.sql` | Private bucket, `card_upload_tickets`, `submit_contact()`, `contacts_guard` |
| Contacts screen | `src/features/saved-cards/components/saved-cards-and-contacts.tsx` | Contacts tab with the card photos |

### When the popup shows

- **Signed-in Namma Info user:** no form. Their details are shared silently from their profile.
- **Visitor who filled it once before on this phone:** no form. Shared silently from `localStorage` (`nammainfo:visitorDetails`), with a short "shared" note.
- **The business's own owner or team:** nothing is recorded (the database function ignores them).
- **Skipped once:** not shown again in this browser session.
- Otherwise the form shows. Submitting closes it instantly; the save runs in the background.

### Business-card photos: why it's built this way

The aim was near-zero server and storage cost, and no way for strangers to fill the bucket with junk.

1. `<input type="file" capture="environment">` opens the back camera directly: front, then back. After the back photo the visitor goes straight to the profile.
2. `compressCardPhoto()` resizes to a 1400 px longest side and encodes WebP (JPEG on old Safari), lowering quality only until it's under \~180 KB.
3. The browser asks `/api/contacts/card-upload` for two **signed upload links**. The server checks the card exists and applies abuse limits: 30 uploads per business and 10 per network every 10 minutes. The IP is stored only as a hash.
4. The photos upload **straight from the phone to Supabase Storage**, never through our server.
5. `submit_contact()` saves the contact. It accepts photo paths only if a matching, unused ticket exists from the last day, then marks the ticket used.

```sql
-- inside submit_contact(): only photos the server issued for this card
select id, front_path into v_ticket, v_front
from card_upload_tickets
where owner_id = p_owner_id
  and front_path = p_card_front
  and not used
  and created_at > now() - interval '1 day';
```

### Security

- The `business-cards` bucket is **private**, images only, 500 KB maximum.
- Paths look like `<ownerId>/<employeeId or "owner">/<random>-front.webp`. Storage policies use the folder names: the owner can read everything under their id; an employee reads only their own folder.
- There is no upload policy at all. Uploads only work through the server's one-time links.
- Photos are shown through signed URLs that expire after one hour.
- `submit_contact()` normalises numbers ("+91 98450 12345" and "098450 12345" both become `9845012345`), merges repeat visitors by phone or email, and caps new contacts at 60 per business per 10 minutes.
- The `contacts_guard` trigger lets the owner fix the name, number and email, but not who the contact belongs to or its photo paths.

## Testimonials and clients

Two optional profile sections an owner fills in from **Profile → Testimonials** and **Profile → Our Clients**. Both are stored as jsonb arrays on `profiles` (migration `20261104_testimonials_clients_phone.sql`), so the public page gets them with its existing `select("*")` and no extra query.

| Piece | File | Job |
| --- | --- | --- |
| Data shapes and clean-up | `src/features/testimonials/types.ts`, `src/features/clients/types.ts` | `Testimonial`, `ClientItem`, limits, `cleanTestimonials()`, `cleanClients()`, `normalizeWebsite()` |
| Editors | `src/features/testimonials/components/testimonials-editor.tsx`, `src/features/clients/components/clients-editor.tsx` | Edit-sheet bodies used by the profile editor; upload images, validate, save the array |
| Public sections | `src/features/testimonials/components/public-testimonials.tsx`, `src/features/clients/components/public-clients.tsx` | Swipeable quote cards; logo grid with links |
| Image processing | `src/lib/images/process-image.ts` | Shrinks photos in the browser before upload |
| Upload and delete | `src/lib/images/profile-media.ts` | `uploadProfileImage()`, `deleteProfileImage()` for the `profile-media` bucket |
| Wiring | `src/features/profile/components/profile-editor.tsx`, `src/features/public-profile/components/public-profile-view.tsx` | Sections appear only when the columns exist (`"testimonials" in profile`) |

```ts
// src/features/testimonials/types.ts
interface Testimonial { id: string; name: string; role?: string; quote: string; rating?: number; photo_url?: string }
// src/features/clients/types.ts
interface ClientItem { id: string; name: string; logo_url?: string; website?: string }
```

### Image processing: why it's built this way

Photos from phones are 3 to 5 MB; a testimonial avatar needs 320 px. So every image is processed **in the browser, before upload**, which costs nothing on the server and keeps storage tiny:

| Preset | Used for | What it does | Typical size |
| --- | --- | --- | --- |
| `AVATAR_IMAGE` | Testimonial author photo | Centre-cropped square, 320 px, WebP | 2 to 40 KB |
| `LOGO_IMAGE` | Client logo | Whole logo fitted inside 480 × 240, **transparency kept**, WebP | 4 to 60 KB |

```ts
// src/lib/images/process-image.ts (excerpt)
let blob = await toBlob(canvas, "image/webp", 0.82);
if (!webp) { /* old Safari: JPEG on a white background instead */ }
while (blob.size > opts.targetBytes && quality > 0.5) {
  quality -= 0.08;                       // step quality down only as needed
  blob = await toBlob(canvas, "image/webp", quality);
}
```

- Camera rotation is respected (`createImageBitmap(..., { imageOrientation: "from-image" })`).
- Non-images and files over 15 MB are refused with a plain message (`ImageProcessError`).
- Files go to `profile-media/<profileId>/testimonials/…` or `…/clients/…` with a random name and a one-year cache header.

### Saving and cleaning up

1. Picking a photo uploads it straight away (spinner on the thumbnail) and keeps the URL in the editor's draft.
2. **Save** validates (testimonial: name and quote required, quote ≤ 500 characters; client: name required, website optional), trims everything and writes the whole array to `profiles.testimonials` / `profiles.clients`.
3. After a successful save, photos that are no longer used (replaced or removed) are deleted. **Cancel** deletes photos uploaded in that session. Deletes are best effort.
4. Websites are normalised by `normalizeWebsite()`: `acme.com` becomes `https://acme.com/`; anything that isn't an http(s) address is rejected, so no `javascript:` links reach the page. Public links open with `target="_blank" rel="noopener noreferrer nofollow"`.

### Limits in the database

```sql
-- 20261104_testimonials_clients_phone.sql
check (jsonb_typeof(testimonials) = 'array'
       and jsonb_array_length(testimonials) <= 20
       and pg_column_size(testimonials) <= 32768);
-- clients: array, at most 50 items, at most 32 KB
```

The browser can write these columns (they belong to the owner and carry no money or permissions), so the checks stop oversized or malformed data, and `cleanTestimonials()` / `cleanClients()` re-check the shape before anything is rendered.

## Google review generator

The biggest friction in asking for a Google review is the blank text box: customers give 5 stars and leave without writing anything. So the card page offers ready-written reviews. The customer taps one, it's copied, and Google's review form opens; they paste and post.

**Approach: a template engine, not AI.** The text is assembled in the browser from hand-written sentence banks filled with the business's own data. That costs nothing per review, works offline, is instant, and never invents claims (it won't say a reseller *made* a product). There is no API key and no external call.

| Piece | Where | Job |
| --- | --- | --- |
| Generator | `generateReviewSuggestions()` in `src/features/public-profile/components/public-profile-view.tsx` | Builds 4 reviews for the business, or for one tab (a service or product category, or all services / all products) |
| Angle | `reviewRole()`, `rolePacks()` (same file) | Picks retailer, manufacturer, wholesaler, distributor, service, agency, freelancer or neutral wording |
| Clean-up | `tidy()`, `shortBizName()`, `placeName()`, `descSentence()` | Removes dashes, "Pvt Ltd", vague areas like "All India"; reuses the owner's own description |
| Copy + guide | `copyText()`, `ReviewCopiedSheet` (same file) | Clipboard with a fallback for in-app browsers; a sheet showing "now paste it on Google" |
| Google link | `googleReviewUrl()` in `src/lib/utils.ts` | Turns a `ChIJ…` Place ID into the direct "write a review" URL |
| Link resolver | `src/app/api/places/route.ts` | In the profile editor, turns any Google link (g.page, maps.app.goo.gl, CID, full Maps URL) into a review URL or Place ID |
| On-site reviews | `src/app/api/reviews/route.ts` | Separate: star ratings left on Namma Info itself (`reviews` table) |

### How one review is built

Each review has three paragraphs:

1. **The business and the people:** an opening for the role ("I bought {s} from {b} last week…"), a sentence about the people, and sometimes a fact from the profile (years in business, clients served, area).
2. **The product or service:** a main line, the owner's own description reused ("It was just as they describe it: …"), and one or two details.
3. **The recommendation**, then a short closer.

Inputs come from the profile: business name (sometimes shortened), owner's first name, `business_type`, services, products, categories, `years_in_business`, `clients_served` and `coverage_area`.

```ts
const role = reviewRole(businessType, item.kind); // e.g. "retailer"
const pack = packs[role];
const p1 = [pack.open[oi](b1, s), midPool[mi]];   // opening + people
const p2 = [pickFresh(pack.main, ...)(s)];        // the item itself
const p3 = [pickFresh(pack.rec, ...)(b3, s)];     // recommendation
const text = [p1, p2, p3].map(p => tidy(p.join(" "))).join("\n\n");
```

### Keeping reviews from looking copy-pasted

Google and readers both notice identical reviews, especially when a shop hands one phone to many customers.

- Within one batch, `pickFreshIdx()` never reuses a sentence.
- The first two sentences (what Google shows in previews) form a **signature** such as `retailer:o3m7`. When a review is copied, `rememberCopiedReview()` saves its signature in `localStorage` (`nammainfo:usedReviewOpeners:<profileId>`, last 300). Future suggestions on that phone skip those combinations.
- Business names, sentence order, lead-ins ("Five stars.") and the number of details are randomised.
- **Refresh** generates a new set for the current tab.

### Review tabs: services and products

`buildReviewTabs()` (same file) decides the tabs shown above the suggestions, besides **All**. Each tab carries a `ReviewFilter` (`{ kind?, category?, uncategorised? }`) that `generateReviewSuggestions(profile, 4, filter)` applies:

| Profile has | Tabs |
| --- | --- |
| Service categories | One tab per service category |
| Product categories | One tab per product category |
| Services and products, neither categorised | **Services**, **Products** |
| Categorised services plus some without a category | The category tabs plus **Services** (only the uncategorised ones) |
| Only one kind, no categories | No tabs; **All** covers it |

Before this, tabs were built from service categories only, so products never got their own reviews.

### Adding or changing sentences

Edit the arrays inside `rolePacks()`. Each entry is a function of `b` (business name) and `s` (the product or service). Keep sentences short, specific and in plain Indian English, avoid dashes (`tidy()` replaces them anyway), and never claim something the role can't do.

## Team cards and employee logins

A paid business can give each staff member their own card at `nammainfo.in/<business>/<employee>`. Optionally the employee also gets their own login, to see the contacts their card collects.

| Piece | File | Job |
| --- | --- | --- |
| Team page | `src/features/team/components/team-page.tsx` | Add, edit and remove members; buy more slots |
| Login controls | `src/features/team/components/employee-login-access.tsx` | Owner-side: give a login, reset password, disable, remove |
| Login API | `src/app/api/team/access/route.ts` | Server: creates and manages employee accounts with the service-role key |
| Who's signed in | `src/components/providers/account-provider.tsx` | Gives `role: "owner" \| "employee"` and the employee record (`my_employee_record()`) |
| Page gate | `src/components/auth/owner-or-employee-gate.tsx` | Shows the owner or employee version of a dashboard page; owners-only pages send employees to Home |
| Public employee card | `src/app/[slug]/[employee]/page.tsx`, `src/features/public-profile/components/employee-profile-view.tsx` | The employee's card, inside the business's branding |
| Pricing | `src/lib/pricing.ts` | Volume pricing for team cards |

### Slots: paying for team members

The owner buys **slots** (`profiles.purchased_id_count`); each team member uses one. The price per card depends on the total number of cards:

```ts
export function getCardUnitPrice(totalCards: number): number {
  if (totalCards >= 25) return 999;
  if (totalCards >= 5) return 1499;
  return 1999;
}
```

The Team page checks for a free slot before adding someone, and so does the database. The `employees_protect_billing` trigger (security lockdown migration) refuses an insert from a customer when the owner isn't on a paid plan or has used all slots. It also copies the owner's expiry onto the new member, and stops customers from editing billing fields (`is_premium`, dates, `status`) on existing members. The Team page turns that database error into a friendly "No available team card slots" message.

### Employee logins

Only the server can create Supabase users for someone else, so the Team page calls `/api/team/access` with an `action`:

| Action | What the server does |
| --- | --- |
| `grant` | `auth.admin.createUser` with `email_confirm: true` and `user_metadata.role = "employee"`; links `employees.user_id`. Marks the auto-created profile as `account_type: "employee"` and switches its stray card off. |
| `reset` | Sets a new password (the owner shares it, e.g. on WhatsApp). |
| `disable` / `enable` | Bans or unbans the auth user; flips `login_enabled`. Their contacts are kept. |
| `remove` | Deletes the auth user and clears the link (used when deleting a member). |

Every call checks with `auth.getUser()` that the caller is signed in, isn't an employee, and owns that employee row. If linking fails after the user was created, the user is deleted again, so no half-made logins are left. Passwords are generated in the browser with `crypto.getRandomValues` (10 characters, without look-alike letters).

### What an employee sees

The dashboard reads `user_metadata.role`. Each page picks its version with `EmployeeGate`: **Home**, **Profile** and **Settings** have an employee version (their own card and details); **Team** and **Feed** are owners-only, so employees are sent to Home. Employees see only their own contacts, including the card photos in their own storage folder (see the storage policies above).

## Scanner (QR and NFC)

The **Scan** tab opens other people's Namma Info cards from inside the app. It lives entirely in one client component, `src/features/scanner/components/card-scanner.tsx`, and needs no server code.

| Input | How it works | Library or API |
| --- | --- | --- |
| Live camera | Streams the back camera into the `#qr-reader` div; supports switching camera and the torch when the phone allows it | `html5-qrcode` (`Html5Qrcode`) |
| Photo or screenshot | Decodes a QR code from an image file the user picks | `Html5Qrcode.scanFile()` |
| NFC tap | Reads the URL record from a Namma Info NFC card (Android Chrome only; the button is hidden elsewhere) | Web NFC `NDEFReader` |
| Typed link | "nammainfo.in/username or card id" text box | none |

**Why html5-qrcode:** it wraps camera access and QR decoding in one small library that works in mobile browsers and in-app web views, including decoding from a file, so we didn't have to build camera handling ourselves. iPhones can't read NFC from a website (Apple doesn't support Web NFC), which is why NFC is feature-detected with `"NDEFReader" in window`.

### What happens with the result

Every input ends in the same function, which turns whatever was read into an in-app route:

```ts
const parsed = new URL(clean);            // https://nammainfo.in/aditya
const path = parsed.pathname.replace(/^\//, "");
if (path) router.push(`/${path}`);       // → /aditya
// not a URL? a bare username or "c/<id>" is pushed as-is
```

The phone vibrates briefly on success. Unrecognised codes show "Could not recognize the scanned code as a valid Namma Info card link." The camera is stopped when the user leaves the page.

### Card URLs it can open

- `/<username>`: the business card (`src/app/[slug]/page.tsx`). The slug is resolved by username, then by card `public_slug`, then by card id.
- `/<username>/<employee>`: a team member's card.
- `/c/<cardId>`: an older format kept working so NFC tags and QR codes printed earlier still open (`src/app/c/[cardId]/page.tsx`).

## Plans, membership, free trial and payments

### One rule for "is this a paid member?"

Earlier, different screens each decided this in their own way, and they disagreed. That is why a Pro company (Aditya Automotives) showed as locked on its public page. Now every screen calls one function, `getMembership()` in `src/lib/membership.ts`:

```ts
const PAID_PLANS = new Set(["pro", "trial", "lifetime", "starter", "enterprise"]);

const isPaid = PAID_PLANS.has(plan) || p?.is_member === true || Boolean(validExpiry);
const isExpired = isPaid && !isLifetime && validExpiry !== null && validExpiry.getTime() < now;
// isActive = isPaid && !isExpired && !isSuspended  → the public profile is live
```

The plan name alone must never mark someone free: members who joined before plans existed have `subscription_plan = "free"` (the column default) but `is_member = true` and an expiry date. An expiry year of 2090 or later counts as lifetime.

Used by: the public card page (`src/app/[slug]/page.tsx`, locked view when not active), Home, the profile editor, Settings, and the admin Companies list and detail routes.

### Prices

`src/lib/pricing.ts` holds volume pricing for every card, the owner's own card included: **₹1,999** each, **₹1,499** from 5 cards, **₹999** from 25 cards, per year. `calculateInitialProCost()`, `calculateTeamAddonCost()` and `calculateRenewalCost()` build each kind of order. The server calculates prices; the browser only displays them.

### Paying with Razorpay

**Why Razorpay:** it's the standard Indian gateway, supports UPI, cards, net banking and wallets in one checkout, and settles in INR.

| Step | File | What happens |
| --- | --- | --- |
| 1. Modal | `src/components/UpgradeToProModal.tsx`, `BuyTeamCardsModal.tsx`, `RenewalModal.tsx` | Customer picks quantity, design and shipping, then clicks Pay |
| 2. Create order | `src/app/api/payments/razorpay/create-order/route.ts` | Server calculates the price and creates a Razorpay order. **What's being bought (user, type, quantity, price) goes into the order's `notes`.** |
| 3. Checkout | Razorpay's own popup | Customer pays |
| 4. Verify | `src/app/api/payments/razorpay/verify/route.ts` | Checks Razorpay's signature (HMAC with `RAZORPAY_KEY_SECRET`), then calls `fulfillPayment()` |
| 4b. Webhook | `src/app/api/payments/razorpay/webhook/route.ts` | Backup for customers who close the page: `payment.captured` with a valid `x-razorpay-signature` also calls `fulfillPayment()` |
| 5. Apply | `src/lib/payments/fulfill-payment.ts` | Records the order and upgrades the account |

### Why `fulfillPayment()` is built the way it is

Three rules make payments impossible to fake and safe to repeat:

1. **Trust Razorpay, not the browser.** It fetches the order from Razorpay and reads the plan, quantity, amount and account from the notes the server wrote in step 2. The browser sends only design and shipping details. From checkout, the signed-in user must match the order's `userId`.
2. **Apply each payment once.** It first looks for an order with this `razorpay_payment_id`; a unique index on that column means that if verify and the webhook race, the second insert fails and returns "already applied".
3. **Only the server changes plans.** Updates use the service-role client, because the `profiles_protect_privileged` trigger reverts plan changes coming from customers' browsers.

```ts
if (orderType === "pro_initial") {      // 1 year Pro, team members too
  ...update({ subscription_plan: "pro", is_member: true,
              membership_expires_at: now + 1 year, status: "active" })
} else if (orderType === "renewal") {   // +1 year from the later of today or current expiry
} else if (orderType === "team_addon") { // purchased_id_count += quantity
}
```

Webhook errors return 5xx only when retrying could help (Razorpay retries those); "not our order" returns 200 so Razorpay stops.

### 100-day free trial

| Step | File |
| --- | --- |
| Customer applies with coupon **ADI100**; the profile must be at least 60% complete | `src/app/api/trial/apply/route.ts` (sets `trial_status = "pending_approval"`) |
| Admin approves: plan `trial`, expiry 100 days from the moment of approval | `src/app/api/admin/trial/approve/route.ts` |
| Admin rejects, or extends by any number of days | `.../trial/reject`, `.../trial/extend` |
| Admin follow-ups every 20 days (milestones 1–5) | `.../trial/follow-up`, notes in `profile_admin_notes` |

Trial fields are protected in the database, so all of these use the admin client on the server.

## Admin console

The console at `/admin` is where the Namma Info team runs the business: companies, orders, trials, renewals and staff. It's a separate code area, `src/admin/`, organised by layer:

| Folder | Contains |
| --- | --- |
| `src/admin/views/` | Whole screens: `AdminDashboardView`, `AdminOrdersView`, `DesignerDashboardView`, `AdminLoginView` |
| `src/admin/widgets/` | Screen sections: companies table, company detail modal, KPI metrics, orders table and modal, pending trials, free trials, upcoming renewals, expired cards, staff accounts, header, sidebar |
| `src/admin/features/` | Single actions: company filters, order filters, delete company |
| `src/admin/entities/` | Data shapes and helpers for company, employee, order, subscription |
| `src/admin/shared/` | `admin-auth.ts` (route guards), `admin-notes.ts`, `supabase-admin.ts`, `card-urls.ts`, `formatters.ts`, `config/env.ts` |
| `src/app/admin/` | The Next.js pages (`/admin`, `/admin/login`) |
| `src/app/api/admin/` | Server routes the console calls |

### Two staff roles

| Role | Set by | Can do |
| --- | --- | --- |
| **Admin** | `profiles.is_admin = true` or `role = 'admin'` | Everything |
| **Designer** | `role = 'designer'` | The Designer Studio only: read order designs and download QR codes to print cards |

Admins create staff accounts in the console (`src/app/api/admin/staff/route.ts`). The database has matching helpers: `is_admin()`, `is_staff()` (admin or designer) and `is_designer()`.

### Three locks on the console

1. **Middleware** (`src/middleware.ts`): a signed-in user who isn't staff is sent from `/admin` to `/dashboard` before the page loads.
2. **API guards** (`src/admin/shared/lib/admin-auth.ts`): every admin route starts with `requireAdminAuth()` or `requireStaffAuth()`. It verifies the session with Supabase (Bearer token or cookie), checks the role in `profiles`, and only then returns the service-role client.
3. **Database**: RLS policies and guard triggers use `is_admin()` / `is_staff()`, so even a direct database call from a non-staff browser is refused.

```ts
export async function GET(request: Request) {
  const auth = await requireStaffAuth(request);
  if (!auth.authorized) return auth.response;   // 401 or 403
  const db = auth.adminSupabase;                // service role, server only
  ...
}
```

### Server routes

| Route | Purpose |
| --- | --- |
| `companies`, `companies/[id]` | List and detail, with membership from `getMembership()` |
| `companies/[id]/validity` | Change a company's expiry date |
| `companies/[id]/suspend` | Suspend or reactivate (admin only) |
| `companies/[id]/followup` | Follow-up status and notes |
| `companies/[id]/employees/bulk`, `employees/[id]` | Manage a company's team members |
| `orders` | Orders list and status updates (under review → printing → shipped…) |
| `trial/approve`, `reject`, `extend`, `follow-up` | The free-trial workflow |
| `staff` | Create staff, change roles |

### Private notes

Follow-up notes used to sit on the public `profiles` row, where anyone could read them. They now live in `profile_admin_notes`, readable by staff and writable only by admins. `saveAdminNotes()` / `loadAdminNotes()` in `src/admin/shared/lib/admin-notes.ts` read and write them, and fall back to the old columns if the security migration hasn't been run yet.

## Themes, installable app and landing page

### Light, dark and colour themes

| Piece | File | Job |
| --- | --- | --- |
| Theme list | `src/lib/themes.ts` | 10 colour themes (default, ocean, emerald, sunset, royal, rose, amber, teal, slate, crimson), each a set of CSS variables for light and dark |
| Provider | `src/components/providers/theme-provider.tsx` | `useTheme()`: light, dark or system, plus the colour theme; saved in `localStorage` (`theme`, `colorTheme`) |
| No-flash script | `src/app/layout.tsx` | A tiny inline script applies the saved choice **before first paint** |

**Why CSS variables:** every component uses `var(--background)`, `var(--primary)` and so on, so a theme change is a handful of variable swaps on `<html>`, with no re-render. The inline script exists because React loads after the first paint; without it, dark-mode users would see a white flash on every visit.

### Installable app (PWA)

Namma Info is a website that can be added to the home screen and opens full-screen like an app, with no app store.

- `public/manifest.webmanifest`: name, icons (`public/icons/`), colours, start page.
- `public/sw.js`: a deliberately minimal service worker. It **caches nothing**, so users always get the latest version; it exists because Android requires one before offering installation, and it shows a small "You are offline" page when there's no connection.
- `src/features/install-app/components/add-to-home-screen-popup.tsx`: the "Add to Home Screen" popup. On Android it uses the browser's `beforeinstallprompt` for a one-tap install. On iPhone, where Apple doesn't let websites install themselves, it shows the Share → Add to Home Screen steps, with separate guidance for Chrome on iPhone and in-app browsers (Instagram, Facebook, LinkedIn). It never shows when already installed (`display-mode: standalone`).
- It shows **only right after login or sign-up**: the auth page calls `showInstallAfterLogin()`, which sets a `sessionStorage` flag that the dashboard reads once.

### Landing page

`nammainfo.in/` (`src/app/page.tsx`) renders `src/features/landing/components/landing-page.tsx`.

| Component | What it is |
| --- | --- |
| `hero.tsx`, `nfc-card.tsx`, `phone.tsx` | Opening scene: the NFC card and phone, with parallax as you scroll |
| `tap-story.tsx` | Pinned scroll story: tap → card opens → contact saved |
| `feature-list.tsx`, `reprint-flip.tsx` | Features; the "edit any time, never reprint" card flip |
| `business-marquee.tsx`, `faq.tsx`, `site-footer.tsx` | Business types ticker, questions, footer |
| `landing-nav.tsx`, `theme-switch.tsx`, `magnetic.tsx` | Navigation, light/dark switch, magnetic buttons |
| `landing.module.css` | All landing styles, scoped to this page |
| `hooks/use-scroll-progress.ts` | Scroll engine used by every animated section |

**How the animations stay smooth:** there's no animation library. `useScrollProgress()` reports how far an element has scrolled (0 to 1) at most once per animation frame, and only while the element is near the screen. Components write that number straight into CSS variables instead of React state, so scrolling never causes a re-render, and the CSS does the movement (`transform` and `opacity`, which the GPU handles). Users with "reduce motion" switched on get a calm version via `prefers-reduced-motion`.

## Conventions, testing and known gaps

### Conventions

- **Where code goes:** one folder per feature in `src/features/<feature>/` with `components/`, `services/` (data calls), `lib/` (pure helpers) and `hooks/`. Pages in `src/app/` stay thin and import the feature. Shared UI goes in `src/components/ui/`, shared logic in `src/lib/`.
- **Who may write what:** if a field affects money or permissions, the browser can't change it. Enforce it in the database (RLS policy or guard trigger) and change it only from a server route with the admin client.
- **Database changes:** a new file in `supabase/migrations/` named `YYYYMMDD_what_it_does.sql`, written to be safe to run twice (`if not exists`, `create or replace`, `drop … if exists`), with a header comment saying what it fixes. Run it in the Supabase SQL Editor before deploying code that depends on it.
- **Secrets:** `SUPABASE_SERVICE_ROLE_KEY`, `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` are server-only: never prefix them with `NEXT_PUBLIC_` or import them in a `"use client"` file. `.env.local` stays out of git.
- **Design rules** (from `AGENTS.md`): no sparkle icons, neon colours or glow effects; use the theme variables (`var(--primary)` etc.); `rounded-[5px]` corners; one call to action per idea.
- **Feel:** save optimistically, show results instantly, write friendly errors in plain English (see `friendlyAuthError()` in the sign-in page).
- **Images:** never upload a raw photo. Run it through `processImage()` (`src/lib/images/process-image.ts`) with a preset first.
- **Keep the manuals current:** every change that users or developers would notice updates `src/features/manuals/content/user-manual.tsx` (the `/user-manual` page) and `docs/developer-guide.md`, then regenerates the `/developers-manual` content with `python3 scripts/build-dev-manual.py docs/developer-guide.md src/features/manuals/content/developers-manual-content.ts`.

### Running and checking

| Command | Use |
| --- | --- |
| `npm install` | Install dependencies (needed after every pull that changes `package.json`) |
| `npm run dev` | Local app at `http://localhost:3000` |
| `npx tsc --noEmit` | Type check the whole project |
| `npm run lint` | ESLint |
| `npm run build` | Production build; run before pushing, it's what Vercel runs |

Useful scripts in `scripts/`: `seed-test-accounts.js` creates test accounts; `apply-migration.js` runs a migration file.

**Testing:** there is no automated test suite yet. Database changes have been checked by running each migration against a local Postgres with test cases (for example, the security lockdown was checked with 10 cases: a customer can't make themselves Pro or admin, can't add unpaid team members, can't create paid orders; admins and the server still can). Before a release, check these by hand: sign-up, sign-in, forgot password, opening a Pro and a free card, saving a card, sharing contact details with a card photo, a Razorpay test payment, and the admin console.

### Known gaps

| Gap | Why it matters | Suggested fix |
| --- | --- | --- |
| No automated tests | Regressions are found by hand | Start with Playwright tests for sign-up, card page and save card; SQL tests for the guard triggers |
| Two Supabase helper folders: `src/supabase/` and `src/lib/supabase/` | Confusing; easy to import the wrong one | Move everything to `src/supabase/` and delete the other |
| Two theme providers: `src/components/ThemeProvider.tsx` and `src/components/providers/theme-provider.tsx` | Duplicate logic | Keep `providers/theme-provider.tsx` |
| Trial coupon `ADI100` is written in code | Changing it needs a deploy | Move coupons to a database table |
| Supabase's built-in email sender | Low daily limit; email templates can't be edited | Set up custom SMTP (e.g. Resend or Brevo) in Supabase |
| `create-order` uses `any` and older cookie setup | Type safety | Switch to `createClient()` from `src/supabase/server.ts` |
| Security migration must be run once | Until then payments and admin notes use fallbacks | Run `20261030_security_lockdown.sql` |
| `avatars` / `profile-media` storage policies | Any signed-in user can update or delete any file in these buckets | Restrict update/delete to the user's own folder (`(storage.foldername(name))[1] = auth.uid()::text`), after checking team-photo paths |
| Images still load from `supabase.co` | On networks that block Supabase, photos may not show even though sign-in works | Proxy public storage URLs too, or use a Supabase custom domain |
| Testimonials and clients can't be reordered | Order is the order they were added | Add up/down buttons in the editors |
