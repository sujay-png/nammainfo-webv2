import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyWebhookSignature } from "@/lib/razorpay";

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature");

    if (process.env.RAZORPAY_WEBHOOK_SECRET && signature) {
      const isValid = verifyWebhookSignature({
        body: rawBody,
        signature,
      });

      if (!isValid) {
        return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
      }
    }

    const event = JSON.parse(rawBody);

    if (event.event === "payment.captured") {
      const payment = event.payload.payment.entity;
      const razorpayOrderId = payment.order_id;
      const razorpayPaymentId = payment.id;

      if (razorpayOrderId) {
        // Use service role or standard client to fulfill order
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        const { data: order } = await supabase
          .from("orders")
          .select("*")
          .eq("razorpay_order_id", razorpayOrderId)
          .maybeSingle();

        if (order) {
          await supabase
            .from("orders")
            .update({
              razorpay_payment_id: razorpayPaymentId,
              status: "under_review",
              updated_at: new Date().toISOString(),
            })
            .eq("id", order.id);

          const now = new Date();
          const oneYearLater = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString();

          if (order.order_type === "pro_initial") {
            await supabase
              .from("profiles")
              .update({
                subscription_plan: "pro",
                primary_card_count: 1,
                subscription_started_at: now.toISOString(),
                membership_expires_at: oneYearLater,
                is_member: true,
                status: "active",
              })
              .eq("id", order.profile_id);
          }
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("Webhook processing error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
