import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createAdminClient } from "@/supabase/admin";
import { z } from "zod";

export const dynamic = "force-dynamic";

const cardProcessStepSchema = z.object({
  stepKey: z.string(),
  completed: z.boolean(),
  date: z.string().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = cookies();
    const supabaseUser = createServerClient(
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
    } = await supabaseUser.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    const { id: targetUserId } = params;

    // Check partner authorization
    const { data: partnerProfile } = await admin
      .from("profiles")
      .select("id, is_partner, is_campaign_manager, role, is_admin")
      .eq("id", user.id)
      .single();

    const isAuthorized = Boolean(
      partnerProfile?.is_admin ||
      partnerProfile?.role === "admin" ||
      (partnerProfile as any)?.is_partner ||
      partnerProfile?.is_campaign_manager ||
      partnerProfile?.role === "partner" ||
      partnerProfile?.role === "campaign_manager"
    );

    if (!isAuthorized) {
      return NextResponse.json({ error: "Forbidden: Not an active Partner" }, { status: 403 });
    }

    // Verify ownership of the referral unless admin
    if (!partnerProfile?.is_admin && partnerProfile?.role !== "admin") {
      const { data: refRecord } = await admin
        .from("referrals")
        .select("id")
        .eq("campaign_manager_id", user.id)
        .eq("referred_user_id", targetUserId)
        .maybeSingle();

      if (!refRecord) {
        // Also check if profiles.referred_by matches
        const { data: targetProfileCheck } = await admin
          .from("profiles")
          .select("referred_by")
          .eq("id", targetUserId)
          .maybeSingle();

        if (targetProfileCheck?.referred_by !== user.id) {
          return NextResponse.json(
            { error: "Forbidden: You are not the referring partner for this customer" },
            { status: 403 }
          );
        }
      }
    }

    const body = await req.json();
    const parsed = cardProcessStepSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { stepKey, completed, date } = parsed.data;
    const nowIso = date || new Date().toISOString();

    // Fetch existing card_process for target user
    const { data: targetProfile, error: fetchErr } = await admin
      .from("profiles")
      .select("id, card_process")
      .eq("id", targetUserId)
      .single();

    if (fetchErr || !targetProfile) {
      return NextResponse.json({ error: "Customer profile not found" }, { status: 404 });
    }

    const existingProcess =
      targetProfile.card_process && typeof targetProfile.card_process === "object"
        ? targetProfile.card_process
        : {};

    const updatedCardProcess = {
      ...existingProcess,
      [stepKey]: {
        completed,
        updated_at: completed ? nowIso : null,
      },
    };

    const { error: updateErr } = await admin
      .from("profiles")
      .update({ card_process: updatedCardProcess })
      .eq("id", targetUserId);

    if (updateErr) {
      console.error("[Partner Card Process] Update error:", updateErr);
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      cardProcess: updatedCardProcess,
    });
  } catch (err: any) {
    console.error("[Partner Card Process API] Exception:", err);
    return NextResponse.json(
      { error: err.message || "Failed to update milestone" },
      { status: 500 }
    );
  }
}
