"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { createClient } from "@/supabase/client";
import { getCurrentUser } from "@/supabase/current-user";

/**
 * Who is using the dashboard: the business owner, or an employee the owner
 * gave a login to. Employees get the same app, read-only, except their
 * photos and password. (The database enforces this too — see
 * supabase/migrations/20261025_team_logins_and_contacts.sql.)
 */
export interface EmployeeRecord {
  id: string;
  owner_id: string;
  name: string;
  designation: string;
  email: string | null;
  phone: string | null;
  slug: string;
  avatar_url: string | null;
  cover_url: string | null;
  is_active: boolean;
  owner_username: string | null;
  owner_business_name: string | null;
  owner_logo_url: string | null;
  owner_theme: string | null;
}

interface AccountState {
  loading: boolean;
  userId: string | null;
  email: string | null;
  role: "owner" | "employee";
  employee: EmployeeRecord | null;
  refresh: () => Promise<void>;
}

const AccountContext = createContext<AccountState>({
  loading: true,
  userId: null,
  email: null,
  role: "owner",
  employee: null,
  refresh: async () => {},
});

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Omit<AccountState, "refresh">>({
    loading: true,
    userId: null,
    email: null,
    role: "owner",
    employee: null,
  });

  const load = useCallback(async () => {
    const user = await getCurrentUser();
    if (!user) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }
    const isEmployee = (user.user_metadata as { role?: string } | undefined)?.role === "employee";
    if (!isEmployee) {
      setState({ loading: false, userId: user.id, email: user.email ?? null, role: "owner", employee: null });
      return;
    }
    const supabase = createClient();
    const { data } = await supabase.rpc("my_employee_record");
    const employee = (Array.isArray(data) ? data[0] : data) as EmployeeRecord | undefined;
    setState({
      loading: false,
      userId: user.id,
      email: user.email ?? null,
      role: "employee",
      employee: employee ?? null,
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return <AccountContext.Provider value={{ ...state, refresh: load }}>{children}</AccountContext.Provider>;
}

export function useAccount() {
  return useContext(AccountContext);
}

/** Public link of an employee's card. */
export function employeeCardUrl(e: Pick<EmployeeRecord, "owner_username" | "slug">) {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://nammainfo.in";
  return e.owner_username ? `${origin}/${e.owner_username}/${e.slug}` : null;
}
