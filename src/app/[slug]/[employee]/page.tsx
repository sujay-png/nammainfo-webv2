import { notFound } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import type { Profile, Employee } from "@/lib/supabase/types";
import EmployeeCardView from "@/components/EmployeeCardView";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; employee: string }>;
}): Promise<Metadata> {
  const { slug, employee: empSlug } = await params;
  const supabase = createPublicClient();

  const { data: owner } = await supabase
    .from("profiles")
    .select("id, business_name")
    .eq("username", slug)
    .maybeSingle();
  if (!owner) return { title: "Not Found" };

  const { data: emp } = await supabase
    .from("employees")
    .select("name, designation")
    .eq("owner_id", (owner as { id: string }).id)
    .eq("slug", empSlug)
    .eq("is_active", true)
    .maybeSingle();
  if (!emp) return { title: "Not Found" };

  const e = emp as { name: string; designation: string };
  const o = owner as { business_name: string | null };
  return {
    title: `${e.name} · ${o.business_name ?? "Namma Info"}`,
    description: `${e.designation} at ${o.business_name ?? "Namma Info"}`,
  };
}

export default async function EmployeePage({
  params,
}: {
  params: Promise<{ slug: string; employee: string }>;
}) {
  const { slug, employee: empSlug } = await params;
  const supabase = createPublicClient();

  // Get the owner profile by username
  const { data: ownerData } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", slug)
    .maybeSingle();

  if (!ownerData) notFound();
  const owner = ownerData as unknown as Profile;

  // Get the employee
  const { data: empData } = await supabase
    .from("employees")
    .select("*")
    .eq("owner_id", owner.id)
    .eq("slug", empSlug)
    .eq("is_active", true)
    .maybeSingle();

  if (!empData) notFound();
  const employee = empData as unknown as Employee;

  return <EmployeeCardView employee={employee} owner={owner} />;
}
