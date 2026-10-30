import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getRazorpayClient } from "@/lib/razorpay";
import {
  calculateInitialProCost,
  calculateTeamAddonCost,
  calculateRenewalCost,
} from "@/lib/pricing";

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
      orderType = "pro_initial",
      cardQuantity = 1,
      designUrl = null,
      designMode = "team_assist",
      shippingAddress = {},
      idempotencyKey,
    } = body;

    // Check if an existing order with this idempotency key already exists to prevent double charges
    if (idempotencyKey) {
      const { data: existingOrder } = await supabase
        .from("orders")
        .select("*")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();

      if (existingOrder && existingOrder.razorpay_order_id) {
        return NextResponse.json({
          orderId: existingOrder.id,
          razorpayOrderId: existingOrder.razorpay_order_id,
          amount: Math.round(Number(existingOrder.total_amount) * 100),
          currency: "INR",
          key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || "",
          isExisting: true,
        });
      }
    }

    // Fetch user profile and current card counts
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const primaryCards = Number(profile.primary_card_count || 1);

    // Calculate accurate dynamic tier pricing
    let calculation: { unitPrice: number; totalAmount: number; cardQuantity: number };

    if (orderType === "pro_initial") {
      calculation = calculateInitialProCost();
    } else if (orderType === "team_addon") {
      const { count: teamCount } = await supabase
        .from("employees")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", user.id);

      const currentTotal = primaryCards + (teamCount || 0);
      const res = calculateTeamAddonCost(currentTotal, Number(cardQuantity));
      calculation = {
        unitPrice: res.unitPrice,
        totalAmount: res.totalAmount,
        cardQuantity: Number(cardQuantity),
      };
    } else if (orderType === "renewal") {
      const { count: activeTeamCount } = await supabase
        .from("employees")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", user.id)
        .eq("is_active", true);

      const res = calculateRenewalCost(primaryCards, activeTeamCount || 0);
      calculation = {
        unitPrice: res.unitPrice,
        totalAmount: res.totalAmount,
        cardQuantity: res.totalCards,
      };
    } else {
      return NextResponse.json({ error: "Invalid order type" }, { status: 400 });
    }

    const amountInPaise = Math.round(calculation.totalAmount * 100);
    const receipt = `rcpt_${user.id.slice(0, 8)}_${Date.now().toString().slice(-6)}`;

    const razorpay = getRazorpayClient();
    if (!razorpay) {
      return NextResponse.json(
        {
          error:
            "Razorpay API keys are not configured. Please add NEXT_PUBLIC_RAZORPAY_KEY_ID (e.g. rzp_test_...) and RAZORPAY_KEY_SECRET in your .env file to enable payments.",
        },
        { status: 400 }
      );
    }

    const rzpOrder = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt,
      notes: {
        userId: user.id,
        orderType,
        businessName: profile.business_name || profile.owner_name || "",
      },
    });

    return NextResponse.json({
      razorpayOrderId: rzpOrder.id,
      amount: amountInPaise,
      currency: "INR",
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || "",
      orderType,
      cardQuantity: calculation.cardQuantity,
      unitPrice: calculation.unitPrice,
      totalAmount: calculation.totalAmount,
    });
  } catch (err: any) {
    console.error("Create order exception:", err);
    return NextResponse.json(
      { error: err.message || "Failed to initialize checkout" },
      { status: 500 }
    );
  }
}
