import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminAuth } from "@/admin/shared/lib/admin-auth";
import { sendWhatsAppTemplate } from "@/lib/whatsapp";

const validityUpdateSchema = z.object({
  subscriptionStartedAt: z.string().nullable().optional(),
  membershipExpiresAt: z.string().nullable().optional(),
  primaryCardCount: z.number().int().min(0).optional(),
  purchasedIdCount: z.number().int().min(0).optional(),
  subscriptionPlan: z.enum(["free", "pro", "trial", "lifetime"]).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdminAuth(request);
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const { id } = params;
    const body = await request.json();
    const parsed = validityUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid parameters", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const updates: Record<string, any> = {};
    if (parsed.data.subscriptionStartedAt !== undefined) {
      updates.subscription_started_at = parsed.data.subscriptionStartedAt;
    }
    if (parsed.data.membershipExpiresAt !== undefined) {
      updates.membership_expires_at = parsed.data.membershipExpiresAt;
    }
    if (parsed.data.primaryCardCount !== undefined) {
      updates.primary_card_count = parsed.data.primaryCardCount;
    }
    if (parsed.data.purchasedIdCount !== undefined) {
      updates.purchased_id_count = parsed.data.purchasedIdCount;
    }
    if (parsed.data.subscriptionPlan !== undefined) {
      updates.subscription_plan = parsed.data.subscriptionPlan;
      updates.is_member = parsed.data.subscriptionPlan !== "free";
      if (parsed.data.subscriptionPlan === "free") {
        updates.membership_expires_at = null;
        updates.subscription_started_at = null;
        updates.trial_status = "none";
      } else if (parsed.data.subscriptionPlan === "trial") {
        const now = new Date();
        const oneHundredDaysMs = 100 * 24 * 60 * 60 * 1000;
        if (!updates.membership_expires_at) {
          updates.membership_expires_at = new Date(now.getTime() + oneHundredDaysMs).toISOString();
        }
        if (!updates.subscription_started_at) {
          updates.subscription_started_at = now.toISOString();
        }
        updates.trial_status = "approved";
        updates.trial_approved_at = now.toISOString();
        updates.trial_extension_days = 0;
        updates.status = "active";
        updates.is_member = true;
        if (updates.primary_card_count === undefined) {
          updates.primary_card_count = 1;
        }
      }
    }

    const supabase = auth.adminSupabase;

    // Check current status so we never override manual admin suspensions
    const { data: currentProfile } = await supabase
      .from("profiles")
      .select("status, slug, username, phone, owner_name, business_name, subscription_plan")
      .eq("id", id)
      .single();

    if (currentProfile && currentProfile.status !== "suspended") {
      if (parsed.data.subscriptionPlan === "free") {
        updates.status = "active";
      } else if (updates.membership_expires_at !== undefined) {
        if (updates.membership_expires_at) {
          const isFuture = new Date(updates.membership_expires_at).getTime() > Date.now();
          updates.status = isFuture ? "active" : "expired";
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ message: "No fields to update" });
    }

    let { error: updateError } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", id);

    if (updateError?.message?.includes("primary_card_count")) {
      delete updates.primary_card_count;
      ({ error: updateError } = await supabase.from("profiles").update(updates).eq("id", id));
    }

    if (updateError) {
      console.error("[Admin API] Failed to update profile validity:", updateError);
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    // Ensure digital card exists and is active for public access
    if (parsed.data.subscriptionPlan === "trial" || parsed.data.subscriptionPlan === "pro") {
      const { data: existingCard } = await supabase
        .from("cards")
        .select("id")
        .eq("profile_id", id)
        .maybeSingle();

      if (!existingCard) {
        await supabase.from("cards").insert({
          profile_id: id,
          public_slug: currentProfile?.slug || currentProfile?.username || `user-${id.slice(0, 6)}`,
          is_active: true,
        });
      } else {
        await supabase
          .from("cards")
          .update({ is_active: true })
          .eq("id", existingCard.id);
      }
    }

    // Trigger automated WhatsApp notification if plan was set/switched to Free Trial
    if (parsed.data.subscriptionPlan === "trial" && currentProfile?.phone) {
      const recipientName = currentProfile.owner_name || currentProfile.business_name || "Valued Customer";
      const cardSlug = currentProfile.username || currentProfile.slug || "";
      sendWhatsAppTemplate({
        toPhone: currentProfile.phone,
        templateName: "trial_approved",
        languageCode: "en_IN",
        bodyParameters: [cardSlug, recipientName],
        buttonParameters: [cardSlug],
      }).catch((waErr) => {
        console.error("[Admin Validity] WhatsApp notification error:", waErr);
      });
    }

    // Synchronize team members according to company plan:
    // If company is set to Free -> all team members become Free
    if (parsed.data.subscriptionPlan === "free") {
      await supabase
        .from("employees")
        .update({
          is_premium: false,
          subscription_expires_at: null,
          subscription_started_at: null,
          status: "active",
        })
        .eq("owner_id", id);
    } else if (updates.membership_expires_at !== undefined) {
      // If company validity is renewed/updated, sync expiry and status only for employees on Pro plan
      const isFuture = updates.membership_expires_at
        ? new Date(updates.membership_expires_at).getTime() > Date.now()
        : true;
      const empUpdates: Record<string, any> = {
        subscription_expires_at: updates.membership_expires_at,
        status: isFuture ? "active" : "expired",
      };
      if (updates.subscription_started_at !== undefined) {
        empUpdates.subscription_started_at = updates.subscription_started_at;
      }
      await supabase
        .from("employees")
        .update(empUpdates)
        .eq("owner_id", id)
        .eq("is_premium", true);
    }

    // Purge Next.js ISR & route cache so public profile and user dashboard reflect immediately
    try {
      if (currentProfile?.slug) revalidatePath(`/${currentProfile.slug}`);
      if (currentProfile?.username) revalidatePath(`/${currentProfile.username}`);
      revalidatePath("/dashboard/home");
      revalidatePath("/dashboard/settings");
      revalidatePath("/dashboard/team");
    } catch (revalErr) {
      console.warn("[Admin API] Failed to revalidate cache paths:", revalErr);
    }

    return NextResponse.json({ success: true, updates });
  } catch (err: any) {
    console.error("[Admin API] Error updating validity:", err);
    return NextResponse.json(
      { error: err.message || "Failed to update validity" },
      { status: 500 }
    );
  }
}
