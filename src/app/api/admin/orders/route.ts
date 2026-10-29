import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/admin/shared/lib/admin-auth";
import type { OrderStatus, OrderType, DesignMode, AdminOrder, OrderStats } from "@/admin/entities/order/model/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAdminAuth(request);
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const supabase = auth.adminSupabase;

    // 1. Fetch all orders ordered by creation date
    const { data: ordersData, error: ordersError } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (ordersError) {
      console.error("[Admin API] Error fetching orders:", ordersError);
      return NextResponse.json({ error: ordersError.message }, { status: 500 });
    }

    const rawOrders = ordersData || [];

    // 2. Fetch associated profiles for business & customer details
    const profileIds = Array.from(new Set(rawOrders.map((o: any) => o.profile_id).filter(Boolean)));
    const profileMap = new Map<string, any>();

    if (profileIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, business_name, owner_name, email, phone, avatar_url, logo_url, username, slug")
        .in("id", profileIds);

      if (!profilesError && profiles) {
        for (const p of profiles) {
          profileMap.set(p.id, p);
        }
      }
    }

    // 3. Transform to clean AdminOrder model
    const orders: AdminOrder[] = rawOrders.map((o: any) => {
      const profile = profileMap.get(o.profile_id);
      const shipping = (o.shipping_address || {}) as any;

      return {
        id: o.id,
        profileId: o.profile_id,
        businessName: profile?.business_name || profile?.username || "Unnamed Business",
        ownerName: profile?.owner_name || shipping.fullName || "Account Owner",
        email: profile?.email || null,
        phone: profile?.phone || shipping.phone || null,
        avatarUrl: profile?.avatar_url || profile?.logo_url || null,
        orderType: (o.order_type as OrderType) || "pro_initial",
        cardQuantity: Number(o.card_quantity || 1),
        unitPrice: Number(o.unit_price || 0),
        totalAmount: Number(o.total_amount || 0),
        status: (o.status as OrderStatus) || "under_review",
        designUrl: o.design_url || null,
        designMode: (o.design_mode as DesignMode) || "team_assist",
        shippingAddress: {
          fullName: shipping.fullName || profile?.owner_name || "",
          phone: shipping.phone || profile?.phone || "",
          street: shipping.street || "",
          city: shipping.city || "",
          state: shipping.state || "",
          pincode: shipping.pincode || "",
          notes: shipping.notes || "",
          cardDetails: shipping.cardDetails || undefined,
        },
        cardDetails: shipping.cardDetails || undefined,
        razorpayOrderId: o.razorpay_order_id || null,
        razorpayPaymentId: o.razorpay_payment_id || null,
        createdAt: o.created_at,
        updatedAt: o.updated_at || o.created_at,
      };
    });

    // 4. Calculate KPI statistics
    let underReviewCount = 0;
    let inProductionCount = 0;
    let deliveredCount = 0;
    let totalRevenue = 0;

    for (const ord of orders) {
      if (ord.status === "under_review") underReviewCount++;
      else if (ord.status === "on_work") inProductionCount++;
      else if (ord.status === "delivered") deliveredCount++;

      totalRevenue += ord.totalAmount;
    }

    const stats: OrderStats = {
      totalOrders: orders.length,
      underReviewCount,
      inProductionCount,
      deliveredCount,
      totalRevenue,
    };

    return NextResponse.json({ orders, stats });
  } catch (err: any) {
    console.error("[Admin API] Failed to fetch orders:", err);
    return NextResponse.json({ error: err.message || "Failed to load orders" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAdminAuth(request);
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const supabase = auth.adminSupabase;
    const body = await request.json();
    const { orderId, status } = body;

    if (!orderId || !status) {
      return NextResponse.json({ error: "orderId and status are required" }, { status: 400 });
    }

    const allowedStatuses: OrderStatus[] = ["under_review", "on_work", "delivered"];
    if (!allowedStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Allowed values: ${allowedStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabase
      .from("orders")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (updateError) {
      console.error("[Admin API] Failed to update order status:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, orderId, status });
  } catch (err: any) {
    console.error("[Admin API] Error in PATCH order:", err);
    return NextResponse.json({ error: err.message || "Failed to update order" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAdminAuth(request);
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const supabase = auth.adminSupabase;
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get("id");

    if (!orderId) {
      return NextResponse.json({ error: "orderId query parameter is required" }, { status: 400 });
    }

    const { error: deleteError } = await supabase
      .from("orders")
      .delete()
      .eq("id", orderId);

    if (deleteError) {
      console.error("[Admin API] Failed to delete order:", deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, orderId });
  } catch (err: any) {
    console.error("[Admin API] Error in DELETE order:", err);
    return NextResponse.json({ error: err.message || "Failed to delete order" }, { status: 500 });
  }
}
