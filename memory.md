# Namma Info - System State & Project Memory

**Last Updated:** October 15, 2026  
**Status:** Architecture Alignment Phase

---

## 1. Current State of the Codebase

### A. Admin Dashboard (`/admin`)
- **Authentication & RBAC:** Protected by admin-only session check (`is_admin: true`). Clean login at `/admin/login`.
- **Metrics Grid:** Real-time KPI counters for Total Companies, Active Pro Subscriptions, Primary Cards Issued, Team Member Cards, Expiring Soon, and Suspended Accounts.
- **Companies Table:**
  - Modern, non-AI-slop micro-badge styling for `Active`, `Pro`, `Free`, `Lifetime`, `Suspended`, and `Expired`.
  - Joined date separated from Card Issued date.
  - Free tier / 0 card accounts display `N/A` for validity rather than defaulting to "Lifetime".
- **Company Detail Modal:**
  - **Overview Tab:** Shows accurate registration date, card issued count, and validity status.
  - **Cards & Subscription Plan Tab:** Exclusively configures **Primary Business Cards** (Owner cards) and company tier (`Free`, `Pro`, `Lifetime`).
  - **Team / Employee IDs Tab:** Fully responsive employee roster with live search, individual 3-tier card configuration (`Free`, `Pro`, `Lifetime`), inline validity controls, and targeted bulk updates for search results.

### B. User Dashboard (`/dashboard`)
- **Profile Completion:** Dynamic percentage calculator based on 10 checklist items (`business_name`, `logo_url`, `cover_url`, `bio`, `phone`, `email`, `username`, `services`, `social_links`, `card`).
- **Recent Connections:** Reads from `public.connections`. Tracks when other users save or connect with this profile/card.
- **Validity Card (Current Status):** Previously had a fallback calculating `created_at + 365 days` for all accounts, which mistakenly showed free registered users a 365-day card countdown.

---

## 2. Explanation of Existing Mechanics

### A. What is "Recent Connections"?
- In `src/app/dashboard/home/page.tsx`, the **Connections** stat card and **Recent Connections** activity feed query the `connections` table (`user_id = auth.uid()`).
- Whenever a visitor saves a contact via the digital card or taps the NFC card to connect, a record is created.
- The dashboard displays the count and lists the 5 most recent connections with relative time (e.g., "2h ago").

### B. How the "365 days thing" worked in code
- In `ValidityCard` (`src/app/dashboard/home/page.tsx`), the code checked:
  ```ts
  const expires = profile.membership_expires_at
    ? startOfDay(new Date(profile.membership_expires_at))
    : new Date(joined.getTime() + 365 * 24 * 60 * 60 * 1000);
  ```
- Because brand new free users have `membership_expires_at = null`, it defaulted to 365 days from the moment they signed up!
- **Fix in new plan:** Free accounts will show `Validity: N/A` with an "Upgrade to Pro" banner. The 365-day countdown will **only** begin after successful payment of ₹1,999.

---

## 3. High-Level Architecture for User's New Plan

```
                                  [ User Registers (Free) ]
                                              │
                                              ▼
                                 [ 100% Profile Completion ]
                                              │
                                              ▼
                             [ Trigger "Buy Pro" Modal / Popup ]
                                              │
                       ┌──────────────────────┴──────────────────────┐
                       │                                             │
               [ Upload Card Design ]                        [ Leave Blank ]
            (User provides print file)                     (Namma Info team calls)
                       │                                             │
                       └──────────────────────┬──────────────────────┘
                                              │
                                              ▼
                             [ Shipping & Delivery Address ]
                             - Pre-fill from Profile Address
                             - [x] "Same as business profile address"
                             - Contact person name & phone for courier
                                              │
                                              ▼
                             [ Razorpay Checkout (₹1,999) ]
                                (Idempotency Key Protected)
                                              │
                                              ▼
                               [ Webhook / Payment Verified ]
                                              │
                       ┌──────────────────────┴──────────────────────┐
                       ▼                                             ▼
          [ Profile Upgraded to Pro ]                 [ Order Created in "orders" ]
          - Starts 365-day Countdown                  - Includes Shipping Address & Phone
          - Enables Custom URL (/slug)                - Initial state: "under_review"
          - Enables Public Share                      - Visible in Settings > Orders
                                                      - Allows design re-upload
                                                                     │
                                                                     ▼
                                                          [ Admin moves to "on_work" ]
                                                          - Locks design re-upload
                                                                     │
                                                                     ▼
                                                          [ Admin marks "delivered" ]
```

---

## 4. Key Architectural Pillars

### Pillar 1: Unified Volume Pricing Engine (Primary + Team Cards)
**Crucial Rule:** The primary card price is **NOT fixed** at ₹1,999. Volume discounts apply to **all cards** (both Primary owner card and Team member cards) based on the total combined card count.

**Volume Tiers:**
- **1 – 9 Total Cards:** ₹1,999 / card
- **10 – 24 Total Cards:** ₹1,499 / card (e.g. ₹1,500 / card across all cards)
- **25+ Total Cards:** ₹999 / card across all cards

**Billing & Renewal Scenarios:**
- **Initial Purchase (Solo Owner):** 1 Primary Card = 1 total card (Tier 1) → ₹1,999.
- **Mid-Cycle Team Expansion (e.g., Owner + 9 New Members):**
  - Total cards = `1 Primary + 9 Team = 10 Total Cards`.
  - Reaches Tier 2 (10+ cards) → New team members are billed at the volume rate of ₹1,499/card (`9 × ₹1,499 = ₹13,491`).
- **Annual Synchronized Renewal:**
  - Renewal bills the entire organization under the active volume tier:
    `Total Renewal = (1 Primary Card + N Active Team Cards) × (Tier Unit Price)`
  - Example with 1 Primary + 9 Team Members = 10 cards:
    `10 × ₹1,500 = ₹15,000` (The primary card renews at ₹1,500, NOT ₹1,999!).
  - If the owner prunes/deletes 2 team members before renewal (bringing total to 8 cards), it drops to Tier 1:
    `8 × ₹1,999 = ₹15,992`.

### Pillar 2: Co-Termed Company Synchronized Renewals
- **Company-wide Expiry Date:** All team member cards share the primary company's renewal date (`membership_expires_at`).
- **Joining Mid-Cycle:** Adding members halfway through (e.g., at day 326) grants them membership for the remainder of the company's cycle.
- **Renewal Alert:** When remaining days ≤ 15, an "Expiring Soon - Renew Now" banner appears on the dashboard.
- **Bulk Renewal Calculation:** Total renewal price = `(1 Primary + Active Team Members) × (Applicable Tier Price)`.
- **Dynamic Recalculation:** If an employee is removed before renewal, the team count updates immediately and recalculates the renewal invoice accordingly.

### Pillar 3: Public URL & Profile Gatekeeper
- **Free Tier User:**
  - In-app "Share Profile" button is locked; triggers the Pro Upgrade modal.
  - Visiting `nammainfo.in/[slug]` shows:
    > *"This business is currently on the Free tier. Ask them to upgrade to Pro to unlock their custom profile and NFC card."*
- **Expired / Suspended User:**
  - Visiting `nammainfo.in/[slug]` shows:
    > *"Subscription Expired. This profile is temporarily suspended pending renewal."*
- **Active Pro User:**
  - Fully renders the complete public business profile, contact details, reviews, and vCard save.

### Pillar 4: Payment Safety & Idempotency
- Generate a unique `idempotency_key` (UUID + Order ID + Timestamp) before initiating Razorpay checkout.
- Verify payment signature via secure backend API route (`/api/payments/razorpay/verify`) and Razorpay Webhook.
- Database unique constraints prevent duplicate order insertion or multiple charges for the same transaction.

### Pillar 5: Physical Card Shipping & Address Capture
- **Pre-fill from Profile:** Reads `profile.address`, `profile.phone`, and `profile.owner_name` automatically.
- **Checkbox:** `[x] Same address as in profile` (checked by default if address exists).
- **Custom Shipping Address:** Unchecking allows specifying an alternate delivery address (e.g., home or separate branch), recipient name, PIN code, and phone number for delivery partner courier calls.
- **Stored in Order:** Address is saved directly on the order record so future profile changes do not affect already placed physical card orders.

---

## 5. Implementation Roadmap Status

- [x] **Phase 1: Free vs. Pro Public URL Gating & Dashboard Normalization**
  - Gated `/[slug]` for Free (upgrade notice), Expired (renewal notice), and Suspended accounts.
  - In-app "Share" button in `/dashboard/profile` is gated for free users and opens the Upgrade modal.
  - Fixed `ValidityCard`: Free accounts show `Validity: N/A` instead of the 365-day fallback.
- [x] **Phase 2: Upgrade Modal with 3-Step Wizard**
  - `UpgradeToProModal.tsx` built with Step 1 (Design upload or team assist), Step 2 (Shipping address capture with profile pre-fill), Step 3 (Payment breakdown & Razorpay checkout).
  - 100% profile completion auto-prompts the Pro upgrade banner on the dashboard.
- [x] **Phase 3: Robust Razorpay Pipeline & Order Database Schema**
  - Created `orders` table migration (`supabase/migrations/20261016_create_orders_table.sql`).
  - Implemented `/api/payments/razorpay/create-order` with client `idempotency_key` deduplication.
  - Implemented `/api/payments/razorpay/verify` with HMAC SHA256 signature verification and account auto-upgrade.
  - Implemented `/api/payments/razorpay/webhook` for server-to-server capture events.
- [x] **Phase 4: User Orders Tab in Settings & Fulfillment Tracking**
  - Added "Card Orders & Fulfillment" item in `/dashboard/settings`.
  - Built `UserOrdersModal.tsx`: Lists orders with status pills (`under_review`, `on_work`, `delivered`).
  - Users can replace/upload design while `under_review`; re-upload is locked with a lock badge when `on_work`.
  - Implemented `/api/user/orders` GET and PATCH routes.
- [x] **Phase 5: Team Volume Pricing Engine & Synchronized Co-Termed Renewals**
  - Built `BuyTeamCardsModal.tsx` with dynamic volume pricing engine:
    - 1-9 cards: ₹1,999/card
    - 10-24 cards: ₹1,500/card (applied across all cards including primary)
    - 25+ cards: ₹999/card
  - Team page tracks slot quota (`purchased_id_count` vs. assigned members).
  - Synchronized organization renewal alert displays during last 15 days of company validity.
  - Pruning/deleting team members dynamically recalculates renewal cost.
- [x] **TypeScript Validation:** Verified across all routes with `npx tsc --noEmit` (Exit code 0).
