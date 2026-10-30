import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { verifyRazorpaySignature } from "@/lib/razorpay";
import { fulfillPayment } from "@/lib/payments/fulfill-payment";

/**
 * Called by the checkout modals after Razorpay reports a successful
 * payment. Checks Razorpay's signature, then applies the purchase on the
 * server (see lib/payments/fulfill-payment). What was bought is read from
 * Razorpay, not from this request; only design/shipping details come from
 * the browser.
 */
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
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      designUrl = null,
      designMode = "team_assist",
      shippingAddress = {},
      idempotencyKey = null,
    } = body ?? {};

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return NextResponse.json(
        { error: "Missing required Razorpay payment verification parameters" },
        { status: 400 }
      );
    }
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

    const result = await fulfillPayment({
      razorpayOrderId,
      razorpayPaymentId,
      expectedUserId: user.id,
      designUrl: typeof designUrl === "string" ? designUrl : null,
      designMode: typeof designMode === "string" ? designMode : null,
      shippingAddress:
        shippingAddress && typeof shippingAddress === "object" ? (shippingAddress as Record<string, unknown>) : {},
      idempotencyKey: typeof idempotencyKey === "string" ? idempotencyKey : null,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({
      success: true,
      orderId: result.orderId,
      message: "Payment successfully verified and subscription activated!",
    });
  } catch (err: unknown) {
    console.error("Payment verification exception:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to verify payment" },
      { status: 500 }
    );
  }
}
