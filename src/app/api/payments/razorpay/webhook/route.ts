import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/razorpay";
import { fulfillPayment } from "@/lib/payments/fulfill-payment";

/**
 * Razorpay webhook (payment.captured). Backup for customers who close the
 * page before checkout finishes: applies the purchase on the server.
 * Every request must carry a valid Razorpay signature.
 */
export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature");

    if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
      console.error("[webhook] RAZORPAY_WEBHOOK_SECRET is not set; ignoring webhook");
      return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
    }
    if (!signature || !verifyWebhookSignature({ body: rawBody, signature })) {
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
    }

    const event = JSON.parse(rawBody);
    if (event.event === "payment.captured") {
      const payment = event.payload?.payment?.entity;
      if (payment?.order_id && payment?.id) {
        const result = await fulfillPayment({
          razorpayOrderId: payment.order_id,
          razorpayPaymentId: payment.id,
        });
        if (!result.ok) {
          console.error("[webhook] fulfil failed:", result.error);
          // 5xx makes Razorpay retry later; anything else means "not ours", stop retrying.
          return NextResponse.json({ error: result.error }, { status: result.status >= 500 ? 500 : 200 });
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: unknown) {
    console.error("Webhook processing error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Webhook error" }, { status: 500 });
  }
}
