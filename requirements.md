# Namma Info - Technical Requirements & Specification

**Document Version:** 1.0.0  
**Last Updated:** October 16, 2026  
**Status:** In Progress — Phase 1 Underway

---

## 1. Executive Summary
This document specifies the technical requirements and architecture for upgrading Namma Info from a basic profile management app into a full-featured commercial digital identity platform. It introduces:
1. **Dynamic Volume Pricing Engine:** Tiered pricing applying across all cards (Primary + Team cards).
2. **Pro Upgrade Funnel:** 100% profile completion trigger, physical card design upload, shipping address capture with profile pre-fill, and Razorpay checkout.
3. **Razorpay Payment Pipeline:** Endpoints for order generation, signature verification with idempotency keys, and webhook capture.
4. **Physical Card Orders Lifecycle:** Tracking via Settings (`under_review` → `on_work` → `delivered`).
5. **Public Access & Custom URL Gatekeeper:** Access control for free vs. expired vs. pro profiles on `/[slug]`.
6. **Co-Termed Annual Renewals:** 15-day warning alert and synchronized organizational renewal with dynamic recalculation.

---

## 2. Dynamic Pricing Engine Specifications

The system calculates unit price dynamically based on **Total Cards = Primary Business Cards + Team Member Cards**:

| Total Organization Cards | Price Per Card | Billing Rule |
| :--- | :--- | :--- |
| **Tier 1 (1 – 9 cards)** | **₹1,999** / card | Full price across all cards |
| **Tier 2 (10 – 24 cards)** | **₹1,500** / card | Volume rate across all cards including Primary |
| **Tier 3 (25+ cards)** | **₹999** / card | Enterprise rate across all cards including Primary |

### Core Mathematical Formulas:
```ts
function getCardUnitPrice(totalCards: number): number {
  if (totalCards >= 25) return 999;
  if (totalCards >= 10) return 1500;
  return 1999;
}

function calculateTeamAdditionCost(currentCards: number, additionalCards: number): {
  unitPrice: number;
  totalAmount: number;
  newTotalCards: number;
} {
  const newTotalCards = currentCards + additionalCards;
  const unitPrice = getCardUnitPrice(newTotalCards);
  return {
    unitPrice,
    totalAmount: additionalCards * unitPrice,
    newTotalCards,
  };
}

function calculateRenewalCost(primaryCards: number, activeTeamMembers: number): {
  totalCards: number;
  unitPrice: number;
  totalAmount: number;
} {
  const totalCards = primaryCards + activeTeamMembers;
  const unitPrice = getCardUnitPrice(totalCards);
  return {
    totalCards,
    unitPrice,
    totalAmount: totalCards * unitPrice,
  };
}
```

---

## 3. Database Schema Requirements

### A. New Table: `public.orders`
Stores all card orders, payments, design assets, and fulfillment states.
```sql
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  order_type TEXT NOT NULL CHECK (order_type IN ('pro_initial', 'team_addon', 'renewal')),
  card_quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL,
  total_amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'under_review' CHECK (status IN ('under_review', 'on_work', 'delivered', 'cancelled')),
  design_url TEXT,
  design_mode TEXT NOT NULL CHECK (design_mode IN ('uploaded', 'team_assist')),
  shipping_address JSONB NOT NULL,
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_profile_id ON public.orders(profile_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
```

### B. Shipping Address JSONB Structure
```json
{
  "fullName": "John Doe",
  "phone": "+91 9876543210",
  "street": "123 Commercial St, Tech Park",
  "city": "Bengaluru",
  "state": "Karnataka",
  "pincode": "560001",
  "notes": "Deliver to front desk"
}
```

---

## 4. Razorpay Integration Pipeline

### Environment Variables
```env
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_WEBHOOK_SECRET=...
```

### Endpoints
1. `POST /api/payments/razorpay/create-order`
   - Validates user authentication.
   - Computes amount based on dynamic pricing engine.
   - Generates or checks `idempotency_key` to avoid duplicate orders.
   - Creates Razorpay order with receipt ID and returns order ID, currency, and amount.
2. `POST /api/payments/razorpay/verify`
   - Computes HMAC SHA256 of `razorpay_order_id + "|" + razorpay_payment_id` using `RAZORPAY_KEY_SECRET`.
   - Compares with `razorpay_signature`.
   - On success:
     - Updates order status to `'under_review'`.
     - Updates profile `subscription_plan = 'pro'`, `subscription_started_at = now()`, `membership_expires_at = now() + 365 days`.
3. `POST /api/payments/razorpay/webhook`
   - Handles `payment.captured` and `payment.failed` asynchronous events.

---

## 5. Phased Implementation Roadmap

- [ ] **Phase 1: Public Profile Gatekeeper & Dashboard Free-State Normalization**
  - Fix `HomePage` card validity countdown (free accounts show `Validity: N/A` instead of 365-day fallback).
  - Gate `/dashboard/profile` share button for free users (opens upgrade modal).
  - Update `/[slug]` page:
    - Free user: Display polite Free-tier upgrade notice.
    - Expired user: Display subscription expired notice.
    - Active Pro: Render full public business profile.

- [ ] **Phase 2: Upgrade Modal with 3-Step Wizard**
  - Triggered at 100% profile completion or on clicking Pro upgrade triggers.
  - Step 1: Card Design upload or check "Design assistance needed".
  - Step 2: Shipping address capture with `[x] Same as business address in profile` pre-fill.
  - Step 3: Razorpay checkout launcher.

- [ ] **Phase 3: Robust Razorpay Server Pipeline**
  - Install Razorpay SDK / API integration.
  - Implement `/api/payments/razorpay/create-order` and `/api/payments/razorpay/verify`.
  - Database migration script for `orders` table.

- [ ] **Phase 4: Orders Tab in Settings & Admin Fulfillment**
  - New "Orders" tab in `/dashboard/settings`.
  - Live status tracking (`under_review` → `on_work` → `delivered`).
  - Ability to re-upload design while `under_review`; lock when `on_work`.

- [ ] **Phase 5: Dynamic Team Member Add-ons & Synchronized Renewals**
  - Team member add-on counter with live volume tier pricing calculation.
  - Synchronized co-termed renewal date calculation.
  - 15-day expiration alert banner.
  - Member pruning price recalculation.
