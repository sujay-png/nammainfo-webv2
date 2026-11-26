import { NextResponse } from "next/server";
import { requireStaffAuth } from "@/admin/shared/lib/admin-auth";
import { buildPublicCardUrl } from "@/admin/shared/lib/card-urls";
import { legacyOrderStatusToStage, type FulfillmentStage } from "@/lib/fulfillment/state-machine";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireStaffAuth(request);
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const supabase = auth.adminSupabase;

    // Fetch canonical fulfillment_jobs + items
    const { data: jobsData, error: jobsErr } = await supabase
      .from("fulfillment_jobs")
      .select("*")
      .order("created_at", { ascending: false });

    // Fetch profiles, employees, branches, and orders so Designer & Admin have full context
    const [{ data: profiles }, { data: employees }, { data: branches }] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "id, business_name, owner_name, email, phone, avatar_url, logo_url, username, slug, subscription_plan, status, membership_expires_at, referred_by, referred_by_code, default_card_template_url, default_card_design_notes, card_process"
        ),
      supabase
        .from("employees")
        .select("id, owner_id, name, designation, email, phone, slug, avatar_url, branch_id, is_active, card_design_mode, card_design_url, card_design_notes")
        .order("created_at", { ascending: true }),
      supabase
        .from("branches")
        .select("id, owner_id, name, slug, contact_person, contact_title, phone, city, logo_url, cover_url, is_active, card_design_mode, card_design_url, card_design_notes")
        .order("sort_order", { ascending: true }),
    ]);

    const profileMap = new Map<string, any>((profiles || []).map((p: any) => [p.id, p]));
    const employeeMap = new Map<string, any>((employees || []).map((e: any) => [e.id, e]));
    const branchMap = new Map<string, any>((branches || []).map((b: any) => [b.id, b]));

    // Fallback: if fulfillment_jobs table doesn't exist yet in DB, synthesize from orders + active trials
    if (jobsErr) {
      console.warn("[Staff Fulfillment API] Falling back to orders+profiles:", jobsErr.message);
      const { data: rawOrders } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });

      const syntheticJobs = (rawOrders || [])
        .filter((o: any) => o.order_type !== "renewal")
        .map((o: any) => {
          const p = profileMap.get(o.profile_id);
          const ownerSlug = p?.username || p?.slug || o.profile_id;
          const shipping = (o.shipping_address || {}) as any;
          const stage: FulfillmentStage = legacyOrderStatusToStage(o.status);

          return {
            id: o.id,
            profileId: o.profile_id,
            orderId: o.id,
            jobType:
              o.order_type === "team_addon"
                ? "team_addon"
                : o.order_type === "primary_card_addon"
                ? "primary_addon"
                : "pro_initial",
            stage,
            cardQuantity: Number(o.card_quantity || 1),
            masterTemplateUrl: o.design_url || shipping?.cardDetails?.fileUrl || p?.default_card_template_url || null,
            designNotes: shipping?.cardDetails?.designNotes || null,
            shippingAddress: shipping,
            courierName: null,
            trackingNumber: null,
            lastUpdatedByRole: null,
            lastUpdatedByName: null,
            createdAt: o.created_at,
            updatedAt: o.updated_at || o.created_at,
            company: p
              ? {
                  id: p.id,
                  businessName: p.business_name || p.username || "Unnamed Business",
                  ownerName: p.owner_name || "Owner",
                  phone: p.phone,
                  email: p.email,
                  username: p.username,
                  slug: p.slug,
                  subscriptionPlan: p.subscription_plan || "free",
                  logoUrl: p.logo_url || p.avatar_url,
                  defaultCardTemplateUrl: p.default_card_template_url || null,
                }
              : null,
            items: [
              {
                id: `item-${o.id}`,
                jobId: o.id,
                profileId: o.profile_id,
                targetType: "primary",
                displayName: p?.business_name || p?.owner_name || "Primary Card",
                designation: p?.owner_name || "Owner",
                phone: p?.phone || shipping?.phone || null,
                photoUrl: p?.avatar_url || null,
                publicCardUrl: buildPublicCardUrl(ownerSlug),
                designMode: o.design_url ? "custom_upload" : "team_assist",
                designFileUrl: o.design_url || shipping?.cardDetails?.fileUrl || null,
                designNotes: shipping?.cardDetails?.designNotes || null,
                isPrinted: ["printed_ready", "posted", "delivered"].includes(stage),
              },
            ],
          };
        });

      return NextResponse.json({ jobs: syntheticJobs, fallback: true });
    }

    const jobIds = (jobsData || []).map((j: any) => j.id);
    let itemsByJob = new Map<string, any[]>();

    if (jobIds.length > 0) {
      const { data: itemsData } = await supabase
        .from("fulfillment_job_items")
        .select("*")
        .in("job_id", jobIds)
        .order("created_at", { ascending: true });

      for (const item of itemsData || []) {
        const emp = item.employee_id ? employeeMap.get(item.employee_id) : null;
        const br = item.branch_id ? branchMap.get(item.branch_id) : null;
        const list = itemsByJob.get(item.job_id) || [];
        list.push({
          id: item.id,
          jobId: item.job_id,
          profileId: item.profile_id,
          targetType: item.target_type,
          employeeId: item.employee_id,
          branchId: item.branch_id,
          displayName: item.display_name,
          designation: item.designation,
          phone: item.phone,
          photoUrl: item.photo_url || emp?.avatar_url || br?.logo_url || null,
          publicCardUrl: item.public_card_url,
          designMode: item.design_mode,
          designFileUrl: item.design_file_url || emp?.card_design_url || br?.card_design_url || null,
          designNotes: item.design_notes || emp?.card_design_notes || br?.card_design_notes || null,
          isPrinted: Boolean(item.is_printed),
          createdAt: item.created_at,
        });
        itemsByJob.set(item.job_id, list);
      }
    }

    const jobs = (jobsData || []).map((j: any) => {
      const p = profileMap.get(j.profile_id);
      return {
        id: j.id,
        profileId: j.profile_id,
        orderId: j.order_id,
        jobType: j.job_type,
        stage: j.stage,
        cardQuantity: Number(j.card_quantity || 1),
        masterTemplateUrl: j.master_template_url || p?.default_card_template_url || null,
        designNotes: j.design_notes || p?.default_card_design_notes || null,
        shippingAddress: j.shipping_address || {},
        courierName: j.courier_name || null,
        trackingNumber: j.tracking_number || null,
        sentToDesignerAt: j.sent_to_designer_at || null,
        printedAt: j.printed_at || null,
        postedAt: j.posted_at || null,
        deliveredAt: j.delivered_at || null,
        lastUpdatedByRole: j.last_updated_by_role || null,
        lastUpdatedByName: j.last_updated_by_name || null,
        createdAt: j.created_at,
        updatedAt: j.updated_at,
        company: p
          ? {
              id: p.id,
              businessName: p.business_name || p.username || "Unnamed Business",
              ownerName: p.owner_name || "Owner",
              phone: p.phone,
              email: p.email,
              username: p.username,
              slug: p.slug,
              subscriptionPlan: p.subscription_plan || "free",
              logoUrl: p.logo_url || p.avatar_url,
              defaultCardTemplateUrl: p.default_card_template_url || null,
            }
          : null,
        items: itemsByJob.get(j.id) || [],
      };
    });

    return NextResponse.json({ jobs, fallback: false });
  } catch (err: any) {
    console.error("[Staff Fulfillment API] Exception:", err);
    return NextResponse.json({ error: err.message || "Failed to load fulfillment jobs" }, { status: 500 });
  }
}
