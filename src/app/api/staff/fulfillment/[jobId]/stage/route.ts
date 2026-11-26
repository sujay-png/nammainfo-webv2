import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffAuth } from "@/admin/shared/lib/admin-auth";
import { transitionFulfillmentJobStage } from "@/lib/fulfillment/service";

export const dynamic = "force-dynamic";

const stagePatchSchema = z.object({
  stage: z.enum([
    "awaiting_customer",
    "sent_to_designer",
    "printed_ready",
    "posted",
    "delivered",
    "cancelled",
  ]),
  courierName: z.string().max(120).nullable().optional(),
  trackingNumber: z.string().max(120).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: { jobId: string } }
) {
  const auth = await requireStaffAuth(request);
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const parsed = stagePatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid fulfillment stage payload", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const result = await transitionFulfillmentJobStage(auth.adminSupabase, {
      jobId: params.jobId,
      toStage: parsed.data.stage,
      actor: { id: auth.userId, role: auth.role },
      courierName: parsed.data.courierName,
      trackingNumber: parsed.data.trackingNumber,
      note: parsed.data.note,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true, job: result.job });
  } catch (err: any) {
    console.error("[Staff Fulfillment Stage API] Exception:", err);
    return NextResponse.json(
      { error: err.message || "Failed to update fulfillment stage" },
      { status: 500 }
    );
  }
}
