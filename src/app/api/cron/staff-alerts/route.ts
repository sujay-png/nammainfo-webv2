import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/admin/shared/lib/admin-auth";
import { createAdminClient } from "@/supabase/admin";
import { runScheduledAlertSweep } from "@/lib/fulfillment/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization") || "";

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    const admin = createAdminClient();
    const result = await runScheduledAlertSweep(admin);
    return NextResponse.json({ success: true, ...result });
  }

  // Otherwise require signed-in Admin
  const auth = await requireAdminAuth(request);
  if (!auth.authorized) {
    return auth.response;
  }

  const result = await runScheduledAlertSweep(auth.adminSupabase);
  return NextResponse.json({ success: true, ...result });
}
