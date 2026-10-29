import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/supabase/server";
import { createAdminClient } from "@/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Owner-only: manage an employee's login.
 *
 * POST { action, employeeId, email?, password? }
 *   grant    — create a login (email + password) for the employee
 *   reset    — set a new password
 *   disable  — block the login (their saved cards/contacts are kept)
 *   enable   — allow the login again
 *   remove   — delete the login completely (used when deleting an employee)
 *
 * The caller must be signed in AND own the employee. Employees can never
 * reach this (they don't own any employee rows).
 */
type Body = {
  action?: "grant" | "reset" | "disable" | "enable" | "remove";
  employeeId?: string;
  email?: string;
  password?: string;
};

const err = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return err("Invalid request");
  }
  const { action, employeeId } = body;
  if (!action || !employeeId) return err("Missing action or employee");

  // 1. Who is calling? (verified with Supabase Auth, not just the cookie)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("Please sign in again", 401);
  if ((user.user_metadata as { role?: string } | undefined)?.role === "employee") {
    return err("Only the business owner can do this", 403);
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return err("Employee logins are not set up on the server yet (missing SUPABASE_SERVICE_ROLE_KEY).", 500);
  }

  // 2. The employee must belong to this owner.
  const { data: emp } = await admin
    .from("employees")
    .select("id, owner_id, name, user_id, login_email")
    .eq("id", employeeId)
    .maybeSingle();
  if (!emp || emp.owner_id !== user.id) return err("Employee not found", 404);

  const password = (body.password ?? "").trim();
  const passwordOk = password.length >= 8 && password.length <= 72;

  switch (action) {
    case "grant": {
      if (emp.user_id) return err("This employee already has a login");
      const email = (body.email ?? "").trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return err("Enter a valid email address");
      if (!passwordOk) return err("Password must be at least 8 characters");

      const { data: created, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // owner vouches for them; no confirmation email
        user_metadata: { role: "employee", employee_id: emp.id, owner_id: user.id, name: emp.name },
      });
      if (error || !created.user) {
        const msg = error?.message ?? "";
        return err(
          /already|registered|exists/i.test(msg)
            ? "This email already has a Namma Info account. Use a different email for this employee."
            : msg || "Could not create the login"
        );
      }
      const newId = created.user.id;

      const { error: linkError } = await admin
        .from("employees")
        .update({ user_id: newId, login_email: email, login_enabled: true })
        .eq("id", emp.id);
      if (linkError) {
        await admin.auth.admin.deleteUser(newId); // don't leave a half-made login
        return err("Could not link the login. Has the database update been run?");
      }

      // The sign-up trigger gives every new user a profile + card. For an
      // employee login those are not a business: mark the profile and turn
      // the stray card off so it never shows up publicly.
      await admin.from("profiles").update({ account_type: "employee" }).eq("id", newId);
      await admin.from("cards").update({ is_active: false }).eq("profile_id", newId);

      return NextResponse.json({ ok: true, email });
    }

    case "reset": {
      if (!emp.user_id) return err("This employee has no login yet");
      if (!passwordOk) return err("Password must be at least 8 characters");
      const { error } = await admin.auth.admin.updateUserById(emp.user_id, { password });
      if (error) return err(error.message);
      return NextResponse.json({ ok: true, email: emp.login_email });
    }

    case "disable":
    case "enable": {
      if (!emp.user_id) return err("This employee has no login yet");
      const { error } = await admin.auth.admin.updateUserById(emp.user_id, {
        ban_duration: action === "disable" ? "876000h" : "none",
      });
      if (error) return err(error.message);
      await admin.from("employees").update({ login_enabled: action === "enable" }).eq("id", emp.id);
      return NextResponse.json({ ok: true });
    }

    case "remove": {
      if (emp.user_id) {
        const { error } = await admin.auth.admin.deleteUser(emp.user_id);
        if (error && !/not found/i.test(error.message)) return err(error.message);
      }
      await admin
        .from("employees")
        .update({ user_id: null, login_email: null, login_enabled: false })
        .eq("id", emp.id);
      return NextResponse.json({ ok: true });
    }

    default:
      return err("Unknown action");
  }
}
