"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "@/hooks/use-account";

/**
 * Picks the owner or employee version of a dashboard page.
 * `employee` = null means "owners only": employees are sent to Home.
 */
export default function EmployeeGate({
  owner,
  employee,
}: {
  owner: React.ReactNode;
  employee: React.ReactNode | null;
}) {
  const { loading, role } = useAccount();
  const router = useRouter();
  const blocked = !loading && role === "employee" && employee === null;

  useEffect(() => {
    if (blocked) router.replace("/dashboard/home");
  }, [blocked, router]);

  if (loading || blocked) {
    return (
      <div className="mx-auto max-w-lg space-y-4 px-4 pt-5">
        <div className="skeleton h-7 w-44 rounded-md" />
        <div className="skeleton h-40 rounded-xl" />
        <div className="skeleton h-20 rounded-xl" />
      </div>
    );
  }
  return <>{role === "employee" ? employee : owner}</>;
}
