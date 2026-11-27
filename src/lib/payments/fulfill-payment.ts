import { createAdminClient } from "@/supabase/admin";
import { getRazorpayClient } from "@/lib/razorpay";
import { revalidatePath } from "next/cache";
import { createFulfillmentJobForOrder, createStaffNotification } from "@/lib/fulfillment/service";
import { getCouponRewardAmount, parseDiscountFromCouponCode } from "@/lib/coupons/tiers";

/**
 * Applies a successful Razorpay payment to the customer's account.
 * SERVER ONLY. Used by both the checkout "verify" call and the Razorpay
 * webhook, so a customer who closes the page mid-payment still gets
 * upgraded.
 *
 * Safety rules:
 * - What was bought (plan, quantity, amount, whose account) comes from
 *   Razorpay's own record of the order (created by /create-order), never
 *   from the browser.
 * - Each payment is applied once: the order row is keyed by the Razorpay
 *   payment id, and a repeat call returns "already applied".
 * - Profile and team updates use the service-role client, because
 *   customers can no longer change plan fields themselves.
 */

export type OrderType = "pro_initial" | "team_addon" | "renewal" | "primary_card_addon";

export interface FulfillInput {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  /** When called from checkout: the signed-in customer. Must match the order. */
  expectedUserId?: string;
  /** Customer-chosen extras (not price-related). */
  designUrl?: string | null;
  designMode?: string | null;
  shippingAddress?: Record<string, unknown> | null;
  idempotencyKey?: string | null;
}

export type FulfillResult =
  | { ok: true; orderId: string; alreadyApplied: boolean; orderType: OrderType }
  | { ok: false; status: number; error: string };

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const ORDER_TYPES: OrderType[] = ["pro_initial", "team_addon", "renewal", "primary_card_addon"];

export async function fulfillPayment(input: FulfillInput): Promise<FulfillResult> {
  const razorpay = getRazorpayClient();
  if (!razorpay) {
    return { ok: false, status: 500, error: "Payments are not configured on the server." };
  }
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, status: 500, error: "SUPABASE_SERVICE_ROLE_KEY is not set on the server." };
  }

  // 1. Already applied? (same payment sent twice, or verify + webhook)
  const { data: existing } = await admin
    .from("orders")
    .select("id, order_type")
    .eq("razorpay_payment_id", input.razorpayPaymentId)
    .maybeSingle();
  if (existing) {
    return { ok: true, orderId: existing.id, alreadyApplied: true, orderType: existing.order_type };
  }

  // 2. What was actually bought, from Razorpay.
  let rzpOrder: {
    amount: number | string;
    amount_paid?: number | string;
    status?: string;
    notes?: Record<string, string | number | null> | null;
  };
  try {
    rzpOrder = (await razorpay.orders.fetch(input.razorpayOrderId)) as typeof rzpOrder;
  } catch (e) {
    console.error("[payments] could not fetch Razorpay order", e);
    return { ok: false, status: 502, error: "Could not confirm the payment with Razorpay. Please try again." };
  }

  const notes = rzpOrder.notes ?? {};
  const userId = String(notes.userId ?? "");
  const orderType = String(notes.orderType ?? "") as OrderType;
  if (!userId || !ORDER_TYPES.includes(orderType)) {
    return { ok: false, status: 400, error: "This payment is not linked to a Namma Info order." };
  }
  if (input.expectedUserId && input.expectedUserId !== userId) {
    return { ok: false, status: 403, error: "This payment belongs to a different account." };
  }

  const totalAmount = Number(notes.totalAmount ?? Number(rzpOrder.amount) / 100);
  const cardQuantity = Math.max(1, Number(notes.cardQuantity ?? 1));
  const unitPrice = Number(notes.unitPrice ?? totalAmount / cardQuantity);

  // 3. Record the order (once). The unique payment id stops double-applying
  //    if two calls race each other.
  const { data: order, error: orderErr } = await admin
    .from("orders")
    .insert({
      profile_id: userId,
      order_type: orderType,
      card_quantity: cardQuantity,
      unit_price: unitPrice,
      total_amount: totalAmount,
      status: "under_review",
      design_url: input.designUrl ?? null,
      design_mode: input.designMode === "uploaded" ? "uploaded" : "team_assist",
      shipping_address: input.shippingAddress ?? {},
      razorpay_order_id: input.razorpayOrderId,
      razorpay_payment_id: input.razorpayPaymentId,
      idempotency_key: input.idempotencyKey || null,
    })
    .select("id")
    .single();

  if (orderErr || !order) {
    // Lost a race with the other call: it has applied the payment.
    const { data: again } = await admin
      .from("orders")
      .select("id")
      .eq("razorpay_payment_id", input.razorpayPaymentId)
      .maybeSingle();
    if (again) return { ok: true, orderId: again.id, alreadyApplied: true, orderType };
    console.error("[payments] order insert failed", orderErr);
    return { ok: false, status: 500, error: "Payment received, but saving the order failed. Our team will fix it." };
  }

  // 4. Apply the plan change.
  const now = new Date();
  const { data: profile } = await admin
    .from("profiles")
    .select("membership_expires_at, purchased_id_count, primary_card_count, slug, username")
    .eq("id", userId)
    .single();

  if (orderType === "pro_initial") {
    const expires = new Date(now.getTime() + YEAR_MS).toISOString();
    const upgrade: Record<string, unknown> = {
      subscription_plan: "pro",
      primary_card_count: Math.max(1, cardQuantity),
      subscription_started_at: now.toISOString(),
      membership_expires_at: expires,
      is_member: true,
      status: "active",
    };
    const { error } = await admin.from("profiles").update(upgrade).eq("id", userId);
    if (error?.message?.includes("primary_card_count")) {
      // Database migration not run yet: upgrade without that column.
      delete upgrade.primary_card_count;
      await admin.from("profiles").update(upgrade).eq("id", userId);
    }
    await admin
      .from("employees")
      .update({ is_premium: true, subscription_expires_at: expires, subscription_started_at: now.toISOString() })
      .eq("owner_id", userId);
  } else if (orderType === "renewal") {
    const current = profile?.membership_expires_at ? new Date(profile.membership_expires_at).getTime() : 0;
    const expires = new Date(Math.max(now.getTime(), current) + YEAR_MS).toISOString();
    await admin
      .from("profiles")
      .update({ membership_expires_at: expires, is_member: true, subscription_plan: "pro", status: "active" })
      .eq("id", userId);
    await admin
      .from("employees")
      .update({ is_premium: true, subscription_expires_at: expires })
      .eq("owner_id", userId);
  } else if (orderType === "team_addon") {
    await admin
      .from("profiles")
      .update({ purchased_id_count: Number(profile?.purchased_id_count ?? 0) + cardQuantity })
      .eq("id", userId);
  } else if (orderType === "primary_card_addon") {
    const currentPrimary = Number(profile?.primary_card_count ?? 1);
    await admin
      .from("profiles")
      .update({ primary_card_count: currentPrimary + cardQuantity })
      .eq("id", userId);
  }

  // 5. Handle Campaign Referral conversion & rewards
  try {
    const couponCodeFromOrder = typeof notes.couponCode === "string" ? notes.couponCode.trim().toUpperCase() : null;

    if (orderType === "pro_initial") {
      const { data: existingRef } = await admin
        .from("referrals")
        .select("id, amount_converted, coupon_code")
        .eq("referred_user_id", userId)
        .maybeSingle();

      // Lookup coupon reward if a coupon code was applied on checkout or signup
      const effectiveCouponCode = couponCodeFromOrder || existingRef?.coupon_code || null;
      let matchedCoupon: { id: string; campaign_manager_id: string; code: string; discount_amount?: number; reward_amount?: number } | null = null;
      if (effectiveCouponCode) {
        const { data: cpn } = await admin
          .from("campaign_coupons")
          .select("id, campaign_manager_id, code, discount_amount, reward_amount")
          .eq("code", effectiveCouponCode)
          .maybeSingle();
        if (cpn) matchedCoupon = cpn as any;
      }

      const couponReward = matchedCoupon
        ? Number(matchedCoupon.reward_amount) ||
          getCouponRewardAmount(Number(matchedCoupon.discount_amount) || parseDiscountFromCouponCode(matchedCoupon.code) || 500)
        : effectiveCouponCode
        ? getCouponRewardAmount(parseDiscountFromCouponCode(effectiveCouponCode) || 500)
        : 1000;

      if (existingRef) {
        // Partner reward pool is ₹1,000 minus customer coupon discount (₹800 for ₹200 off, ₹700 for ₹300 off, ₹500 for ₹500 off, ₹1,000 with no coupon)
        const earnedCommission = effectiveCouponCode ? couponReward : 1000;
        await admin
          .from("referrals")
          .update({
            status: "converted",
            amount_pending: 0,
            amount_converted: Math.max(earnedCommission, Number(existingRef.amount_converted) || earnedCommission),
            coupon_code: couponCodeFromOrder || existingRef.coupon_code || null,
            converted_at: now.toISOString(),
            updated_at: now.toISOString(),
          })
          .eq("id", existingRef.id);
      } else if (couponCodeFromOrder && matchedCoupon && matchedCoupon.campaign_manager_id !== userId) {
        await admin.from("referrals").insert({
          campaign_manager_id: matchedCoupon.campaign_manager_id,
          referred_user_id: userId,
          coupon_code: matchedCoupon.code,
          source: "coupon",
          status: "converted",
          amount_pending: 0,
          amount_converted: couponReward,
          converted_at: now.toISOString(),
        });
        await admin
          .from("profiles")
          .update({
            referred_by: matchedCoupon.campaign_manager_id,
            referred_by_code: matchedCoupon.code,
          })
          .eq("id", userId);
      }
    } else if (orderType === "renewal") {
      const { data: refRow } = await admin
        .from("referrals")
        .select("id, amount_converted, renewal_count")
        .eq("referred_user_id", userId)
        .maybeSingle();

      if (refRow) {
        const curConverted = Number(refRow.amount_converted) || 0;
        const curCount = Number(refRow.renewal_count) || 0;
        await admin
          .from("referrals")
          .update({
            amount_converted: curConverted + 500,
            renewal_count: curCount + 1,
            updated_at: now.toISOString(),
          })
          .eq("id", refRow.id);
      }
    }
  } catch (refRewardErr) {
    console.error("[Fulfill Payment] Referral reward error:", refRewardErr);
  }

  try {
    const { data: paidProfile } = await admin
      .from("profiles")
      .select("business_name, owner_name")
      .eq("id", userId)
      .maybeSingle();
    const bizName = paidProfile?.business_name || paidProfile?.owner_name || "Customer";

    if (orderType === "pro_initial" || orderType === "team_addon" || orderType === "primary_card_addon") {
      await createFulfillmentJobForOrder(admin, {
        profileId: userId,
        orderId: order.id,
        orderType,
        cardQuantity,
        designUrl: input.designUrl,
        designMode: input.designMode,
        shippingAddress: input.shippingAddress,
      });
    }

    const orderLabel =
      orderType === "pro_initial"
        ? "New Pro Upgrade"
        : orderType === "team_addon"
        ? `Team Card Slots (+${cardQuantity})`
        : orderType === "primary_card_addon"
        ? `Extra Primary Card (+${cardQuantity})`
        : "Annual Subscription Renewal";

    await createStaffNotification(admin, {
      recipientRole: "admin",
      eventType: `payment_${orderType}`,
      severity: orderType === "renewal" ? "info" : "action_required",
      title: `${orderLabel}: ${bizName}`,
      message: `${bizName} completed ₹${totalAmount.toLocaleString("en-IN")} payment (${cardQuantity} card${cardQuantity === 1 ? "" : "s"}).`,
      entityType: "order",
      entityId: order.id,
      profileId: userId,
      dedupeKey: `payment_${input.razorpayPaymentId}`,
    });
  } catch (notifyErr) {
    console.warn("[Fulfill Payment] Fulfillment/Notification hook warning:", notifyErr);
  }

  try {
    if (profile?.slug) revalidatePath(`/${profile.slug}`);
    if (profile?.username) revalidatePath(`/${profile.username}`);
    revalidatePath("/dashboard/home");
    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/team");
  } catch (revalErr) {
    console.warn("[Fulfill Payment] Failed to revalidate cache paths:", revalErr);
  }

  return { ok: true, orderId: order.id, alreadyApplied: false, orderType };
}
