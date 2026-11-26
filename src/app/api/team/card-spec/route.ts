import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { z } from "zod";
import { createAdminClient } from "@/supabase/admin";
import { buildPublicCardUrl } from "@/admin/shared/lib/card-urls";
import { createStaffNotification } from "@/lib/fulfillment/service";

export const dynamic = "force-dynamic";

const cardSpecSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("save_company_template"),
    templateUrl: z.string().url().nullable(),
    designNotes: z.string().max(1000).nullable().optional(),
  }),
  z.object({
    action: z.literal("submit_card_spec"),
    targetType: z.enum(["employee", "branch"]),
    targetId: z.string().uuid(),
    designMode: z.enum(["company_template", "custom_upload", "team_assist"]),
    designFileUrl: z.string().url().nullable().optional(),
    designNotes: z.string().max(1000).nullable().optional(),
  }),
]);

export async function POST(request: Request) {
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

    const body = await request.json();
    const parsed = cardSpecSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid card spec request", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("id, business_name, owner_name, slug, username, default_card_template_url, default_card_design_notes, purchased_id_count")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const bizName = profile.business_name || profile.owner_name || "Customer";
    const ownerSlug = profile.username || profile.slug || profile.id;

    if (parsed.data.action === "save_company_template") {
      const { templateUrl, designNotes } = parsed.data;
      await admin
        .from("profiles")
        .update({
          default_card_template_url: templateUrl,
          default_card_design_notes: designNotes ?? null,
        })
        .eq("id", user.id);

      // Also attach template to any awaiting_customer team_addon job without a template
      if (templateUrl) {
        await admin
          .from("fulfillment_jobs")
          .update({
            master_template_url: templateUrl,
            ...(designNotes ? { design_notes: designNotes } : {}),
            updated_at: new Date().toISOString(),
          })
          .eq("profile_id", user.id)
          .eq("job_type", "team_addon")
          .eq("stage", "awaiting_customer")
          .is("master_template_url", null);

        await createStaffNotification(admin, {
          recipientRole: "admin",
          eventType: "company_template_uploaded",
          severity: "action_required",
          title: `Card Template Uploaded: ${bizName}`,
          message: `${bizName} uploaded a reusable Company Card Template for their team/branch cards.`,
          entityType: "profile",
          entityId: user.id,
          profileId: user.id,
        });
      }

      return NextResponse.json({ success: true, templateUrl });
    }

    // Submit Employee or Branch Card Print Spec
    const { targetType, targetId, designMode, designFileUrl, designNotes } = parsed.data;
    const nowIso = new Date().toISOString();

    let displayName = "";
    let designation = "";
    let phone: string | null = null;
    let photoUrl: string | null = null;
    let publicCardUrl = "";

    if (targetType === "employee") {
      const { data: emp, error: empErr } = await admin
        .from("employees")
        .select("*")
        .eq("id", targetId)
        .eq("owner_id", user.id)
        .single();

      if (empErr || !emp) {
        return NextResponse.json({ error: "Employee not found" }, { status: 404 });
      }

      await admin
        .from("employees")
        .update({
          card_design_mode: designMode,
          card_design_url: designFileUrl ?? null,
          card_design_notes: designNotes ?? null,
        })
        .eq("id", emp.id);

      displayName = emp.name;
      designation = emp.designation || "Team Member";
      phone = emp.phone || null;
      photoUrl = emp.avatar_url || null;

      if (emp.branch_id) {
        const { data: br } = await admin
          .from("branches")
          .select("slug")
          .eq("id", emp.branch_id)
          .maybeSingle();
        publicCardUrl = br?.slug
          ? buildPublicCardUrl(ownerSlug, `${br.slug}/${emp.slug || emp.id}`)
          : buildPublicCardUrl(ownerSlug, emp.slug || emp.id);
      } else {
        publicCardUrl = buildPublicCardUrl(ownerSlug, emp.slug || emp.id);
      }
    } else {
      const { data: branch, error: brErr } = await admin
        .from("branches")
        .select("*")
        .eq("id", targetId)
        .eq("owner_id", user.id)
        .single();

      if (brErr || !branch) {
        return NextResponse.json({ error: "Branch not found" }, { status: 404 });
      }

      await admin
        .from("branches")
        .update({
          card_design_mode: designMode,
          card_design_url: designFileUrl ?? null,
          card_design_notes: designNotes ?? null,
        })
        .eq("id", branch.id);

      displayName = branch.name;
      designation = branch.contact_person
        ? `Branch • ${branch.contact_person}`
        : branch.city
        ? `Branch • ${branch.city}`
        : "Branch Card";
      phone = branch.phone || null;
      photoUrl = branch.logo_url || null;
      publicCardUrl = buildPublicCardUrl(ownerSlug, branch.slug);
    }

    const effectiveFileUrl =
      designMode === "custom_upload"
        ? designFileUrl ?? null
        : designMode === "company_template"
        ? profile.default_card_template_url ?? null
        : null;

    // Attach to an open team_addon job if available, else create a new awaiting_customer team_addon job
    let { data: openJob } = await admin
      .from("fulfillment_jobs")
      .select("id, card_quantity, stage")
      .eq("profile_id", user.id)
      .eq("job_type", "team_addon")
      .in("stage", ["awaiting_customer", "sent_to_designer"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!openJob) {
      const { data: newJob } = await admin
        .from("fulfillment_jobs")
        .insert({
          profile_id: user.id,
          job_type: "team_addon",
          stage: "awaiting_customer",
          card_quantity: 1,
          master_template_url: profile.default_card_template_url || null,
          design_notes: profile.default_card_design_notes || null,
          last_updated_by: user.id,
          last_updated_by_role: "customer",
          last_updated_by_name: bizName,
        })
        .select("id, card_quantity, stage")
        .single();
      openJob = newJob;
    }

    if (openJob) {
      const matchCol = targetType === "employee" ? "employee_id" : "branch_id";
      const { data: existingItem } = await admin
        .from("fulfillment_job_items")
        .select("id")
        .eq("job_id", openJob.id)
        .eq(matchCol, targetId)
        .maybeSingle();

      if (existingItem) {
        await admin
          .from("fulfillment_job_items")
          .update({
            display_name: displayName,
            designation,
            phone,
            photo_url: photoUrl,
            public_card_url: publicCardUrl,
            design_mode: designMode,
            design_file_url: effectiveFileUrl,
            design_notes: designNotes ?? null,
            updated_at: nowIso,
          })
          .eq("id", existingItem.id);
      } else {
        await admin.from("fulfillment_job_items").insert({
          job_id: openJob.id,
          profile_id: user.id,
          target_type: targetType,
          employee_id: targetType === "employee" ? targetId : null,
          branch_id: targetType === "branch" ? targetId : null,
          display_name: displayName,
          designation,
          phone,
          photo_url: photoUrl,
          public_card_url: publicCardUrl,
          design_mode: designMode,
          design_file_url: effectiveFileUrl,
          design_notes: designNotes ?? null,
        });
      }
    }

    await createStaffNotification(admin, {
      recipientRole: "admin",
      eventType: targetType === "employee" ? "employee_card_submitted" : "branch_card_submitted",
      severity: "action_required",
      title: `${targetType === "employee" ? "Employee" : "Branch"} Card Ready: ${bizName}`,
      message: `${bizName} added/updated ${displayName} (${designation}) using ${
        designMode === "company_template"
          ? "Company Master Template"
          : designMode === "custom_upload"
          ? "Custom Artwork"
          : "Team Design Request"
      }.`,
      entityType: "profile",
      entityId: user.id,
      profileId: user.id,
    });

    return NextResponse.json({ success: true, jobId: openJob?.id || null });
  } catch (err: any) {
    console.error("[Team Card Spec API] Exception:", err);
    return NextResponse.json(
      { error: err.message || "Failed to save card specification" },
      { status: 500 }
    );
  }
}
