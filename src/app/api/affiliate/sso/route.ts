import { NextResponse } from "next/server";
import { createClient } from "@/supabase/server";
import { createAdminClient } from "@/supabase/admin";
import {
  getPartnerQuickDestination,
  isActivePartnerAccount,
} from "@/lib/affiliate/requests";

export const dynamic = "force-dynamic";

/**
 * Generates a seamless 1-click destination URL into the Partner Console.
 * - On nammainfo.in / www.nammainfo.in, issues a single-use magiclink token_hash
 *   and lands cleanly on https://partner.nammainfo.in/auth/callback so the
 *   partner doesn't have to type credentials again across subdomains.
 * - On localhost or preview hosts, routes directly to /partner using the
 *   existing same-origin session.
 */
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("id, is_partner, is_campaign_manager, role, email")
      .eq("id", user.id)
      .maybeSingle();

    const isPartner = Boolean(
      profile &&
        isActivePartnerAccount({
          is_partner: (profile as any).is_partner,
          is_campaign_manager: profile.is_campaign_manager,
          role: profile.role,
        })
    );

    if (!isPartner) {
      return NextResponse.json(
        { error: "Forbidden: Partner access not approved yet" },
        { status: 403 }
      );
    }

    let hostname = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
    try {
      const body = await req.json();
      if (typeof body?.hostname === "string" && body.hostname.trim()) {
        hostname = body.hostname.trim();
      }
    } catch {
      // Optional JSON body
    }

    // Strip port if present
    const bareHost = hostname.split(":")[0].toLowerCase();
    const isProdMainDomain =
      bareHost === "nammainfo.in" || bareHost === "www.nammainfo.in";

    if (isProdMainDomain && (user.email || profile?.email)) {
      const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email: (user.email || profile?.email)!,
        options: {
          redirectTo: "https://partner.nammainfo.in/",
        },
      });

      const hashedToken = linkData?.properties?.hashed_token;
      if (!linkErr && hashedToken) {
        return NextResponse.json({
          url: getPartnerQuickDestination({
            hostname: bareHost,
            tokenHash: hashedToken,
          }),
          crossSubdomain: true,
        });
      }
    }

    return NextResponse.json({
      url: getPartnerQuickDestination({ hostname: bareHost }),
      crossSubdomain: false,
    });
  } catch (err: any) {
    console.error("[Affiliate SSO POST] Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to generate Partner Portal link" },
      { status: 500 }
    );
  }
}
