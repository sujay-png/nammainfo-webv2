import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import PublicProfileView from "@/features/public-profile/components/public-profile-view";
import EmployeeProfileView from "@/features/public-profile/components/employee-profile-view";
import { applyBranch } from "@/features/branches/lib/apply-branch";
import { employeePath } from "@/features/branches/lib/paths";
import {
  findBranch,
  findEmployee,
  getBranches,
  loadPageData,
  membershipGate,
  publicHandle,
  resolveOwner,
} from "@/features/branches/services/public-pages.service";

/**
 * /<business>/<x> is either a BRANCH (nammainfo.in/abc/mangaluru) or a
 * TEAM MEMBER (nammainfo.in/abc/sujay). The database keeps the two link
 * sets apart per business, so at most one matches. Branches are checked
 * first.
 *
 * A team member who now belongs to a branch is redirected to
 * /<business>/<branch>/<member>, so cards printed before branches existed
 * keep working.
 */

// ISR: revalidate every 30 seconds
export const revalidate = 30;

type Params = Promise<{ slug: string; employee: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug, employee: seg } = await params;
  const result = await resolveOwner(slug);
  if (!result) return { title: "Not Found" };
  const owner = result.profile;
  const business = owner.business_name ?? "Namma Info";

  const branch = await findBranch(owner.id, seg);
  if (branch) {
    const p = applyBranch(owner, branch);
    return {
      title: `${business} · ${branch.name}`,
      description:
        owner.bio ?? `${business}, ${branch.name}. Call, WhatsApp or get directions on Namma Info.`,
      openGraph: {
        title: `${business} · ${branch.name}`,
        images: p.cover_url || p.logo_url ? [(p.cover_url || p.logo_url) as string] : undefined,
      },
    };
  }

  const emp = await findEmployee(owner.id, seg);
  if (!emp) return { title: "Not Found" };
  return {
    title: `${emp.name} · ${business}`,
    description: `${emp.designation} at ${business}`,
  };
}

export default async function BranchOrEmployeePage({ params }: { params: Params }) {
  const { slug, employee: seg } = await params;
  const result = await resolveOwner(slug);
  if (!result) notFound();
  const owner = result.profile;
  const handle = publicHandle(owner, slug);

  const [branch, employee, branches] = await Promise.all([
    findBranch(owner.id, seg),
    findEmployee(owner.id, seg),
    getBranches(owner.id),
  ]);

  // ---- Branch page -------------------------------------------------
  if (branch) {
    const gate = membershipGate(owner);
    if (gate) return gate;
    const { card, reviews, employees } = await loadPageData(owner.id, result.card);
    return (
      <PublicProfileView
        profile={applyBranch(owner, branch)}
        card={card}
        reviews={reviews}
        employees={employees.filter((e) => e.branch_id === branch.id)}
        branch={branch}
        branches={branches}
        handle={handle}
      />
    );
  }

  // ---- Team member -------------------------------------------------
  if (!employee) notFound();

  const ownBranch = employee.branch_id ? branches.find((b) => b.id === employee.branch_id) : null;
  if (ownBranch) redirect(employeePath(handle, employee.slug, ownBranch.slug));

  const gate = membershipGate(owner);
  if (gate) return gate;

  const { card, reviews, employees } = await loadPageData(owner.id, result.card);
  return (
    <EmployeeProfileView
      employee={employee}
      owner={owner}
      card={card}
      reviews={reviews}
      employees={employees}
      branches={branches}
      handle={handle}
    />
  );
}
