import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { verifyRazorpaySignature } from "@/lib/razorpay";

export async function POST(req: Request) {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      orderId,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      orderType = "pro_initial",
      cardQuantity = 1,
      unitPrice,
      totalAmount,
      designUrl = null,
      designMode = "team_assist",
      shippingAddress = {},
      idempotencyKey,
    } = body;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return NextResponse.json(
        { error: "Missing required Razorpay payment verification parameters" },
        { status: 400 }
      );
    }

    // Verify cryptographic signature strictly
    if (!process.env.RAZORPAY_KEY_SECRET) {
      return NextResponse.json(
        { error: "RAZORPAY_KEY_SECRET is not configured on the server" },
        { status: 500 }
      );
    }

    const isValid = verifyRazorpaySignature({
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      signature: razorpaySignature,
    });

    if (!isValid) {
      return NextResponse.json({ error: "Invalid payment signature from Razorpay" }, { status: 400 });
    }

    let confirmedOrderId = orderId;

    if (orderId) {
      const { data: existing } = await supabase
        .from("orders")
        .select("id")
        .eq("id", orderId)
        .eq("profile_id", user.id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("orders")
          .update({
            razorpay_payment_id: razorpayPaymentId,
            status: "under_review",
            updated_at: new Date().toISOString(),
          })
          .eq("id", orderId);
        confirmedOrderId = existing.id;
      }
    }

    if (!confirmedOrderId) {
      const { data: newOrder, error: orderInsertError } = await supabase
        .from("orders")
        .insert({
          profile_id: user.id,
          order_type: orderType,
          card_quantity: Number(cardQuantity || 1),
          unit_price: Number(unitPrice || totalAmount || 1999),
          total_amount: Number(totalAmount || 1999),
          status: "under_review",
          design_url: designUrl,
          design_mode: designMode,
          shipping_address: shippingAddress,
          razorpay_order_id: razorpayOrderId,
          razorpay_payment_id: razorpayPaymentId,
          idempotency_key: idempotencyKey || null,
        })
        .select()
        .single();

      if (orderInsertError) {
        console.error("Order insertion error on verify:", orderInsertError);
        return NextResponse.json(
          { error: "Failed to persist order: " + orderInsertError.message },
          { status: 500 }
        );
      }
      confirmedOrderId = newOrder.id;
    }

    // Apply plan upgrades to user's profile
    const now = new Date();
    const oneYearLater = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString();

    const effectiveOrderType = orderType;

    if (effectiveOrderType === "pro_initial") {
      const updates: any = {
        subscription_plan: "pro",
        primary_card_count: 1,
        subscription_started_at: now.toISOString(),
        membership_expires_at: oneYearLater,
        is_member: true,
        status: "active",
      };

      const { error: updErr } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", user.id);

      // Gracefully retry without primary_card_count if column does not exist in live schema
      if (updErr && updErr.message?.includes("primary_card_count")) {
        delete updates.primary_card_count;
        await supabase
          .from("profiles")
          .update(updates)
          .eq("id", user.id);
      }

      // Synchronize team members automatically to Pro plan and validity
      await supabase
        .from("employees")
        .update({
          is_premium: true,
          subscription_expires_at: oneYearLater,
          subscription_started_at: now.toISOString(),
        })
        .eq("owner_id", user.id);
    } else if (effectiveOrderType === "renewal") {
      const { data: currentProfile } = await supabase
        .from("profiles")
        .select("membership_expires_at")
        .eq("id", user.id)
        .single();

      const baseTime = currentProfile?.membership_expires_at
        ? Math.max(now.getTime(), new Date(currentProfile.membership_expires_at).getTime())
        : now.getTime();

      const newExpiry = new Date(baseTime + 365 * 24 * 60 * 60 * 1000).toISOString();

      await supabase
        .from("profiles")
        .update({
          membership_expires_at: newExpiry,
          is_member: true,
          status: "active",
        })
        .eq("id", user.id);

      // Synchronize team members automatically to renewed validity
      await supabase
        .from("employees")
        .update({
          is_premium: true,
          subscription_expires_at: newExpiry,
        })
        .eq("owner_id", user.id);
    } else if (effectiveOrderType === "team_addon") {
      const { data: currentProfile } = await supabase
        .from("profiles")
        .select("purchased_id_count")
        .eq("id", user.id)
        .single();

      const existingQuota = Number(currentProfile?.purchased_id_count || 0);
      const newQuota = existingQuota + Number(cardQuantity || 1);

      await supabase
        .from("profiles")
        .update({
          purchased_id_count: newQuota,
        })
        .eq("id", user.id);
    }

    return NextResponse.json({
      success: true,
      message: "Payment successfully verified and subscription activated!",
    });
  } catch (err: any) {
    console.error("Payment verification exception:", err);
    return NextResponse.json(
      { error: err.message || "Failed to verify payment" },
      { status: 500 }
    );
  }
}
