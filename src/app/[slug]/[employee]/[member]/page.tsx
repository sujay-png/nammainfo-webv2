import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
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
 * /<business>/<branch>/<member>: a team member of a branch, e.g.
 * nammainfo.in/abc/mangaluru/sujay. Their card shows the branch's details
 * (address, directions, branch services) under "Company Profile".
 *
 * If the member moved to another branch, or the branch was hidden, the
 * visitor is sent to the member's current link instead of a 404.
 */

// The folder is still called [employee] (it was the team-member segment
// before branches); here it holds the BRANCH link.
type Params = Promise<{ slug: string; employee: string; member: string }>;

export const revalidate = 30;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug, employee: branchSlug, member } = await params;
  const result = await resolveOwner(slug);
  if (!result) return { title: "Not Found" };
  const owner = result.profile;
  const [branch, emp] = await Promise.all([findBranch(owner.id, branchSlug), findEmployee(owner.id, member)]);
  if (!emp) return { title: "Not Found" };
  const business = owner.business_name ?? "Namma Info";
  const where = branch ? `${business}, ${branch.name}` : business;
  return {
    title: `${emp.name} · ${where}`,
    description: `${emp.designation} at ${where}`,
  };
}

export default async function BranchMemberPage({ params }: { params: Params }) {
  const { slug, employee: branchSlug, member } = await params;
  const result = await resolveOwner(slug);
  if (!result) notFound();
  const owner = result.profile;
  const handle = publicHandle(owner, slug);

  const [branch, employee, branches] = await Promise.all([
    findBranch(owner.id, branchSlug),
    findEmployee(owner.id, member),
    getBranches(owner.id),
  ]);
  if (!employee) notFound();

  // Not (or no longer) in this branch → their current link.
  if (!branch || employee.branch_id !== branch.id) {
    const current = employee.branch_id ? branches.find((b) => b.id === employee.branch_id) : null;
    redirect(employeePath(handle, employee.slug, current?.slug ?? null));
  }

  const gate = membershipGate(owner);
  if (gate) return gate;

  const { card, reviews, employees } = await loadPageData(owner.id, result.card);
  return (
    <EmployeeProfileView
      employee={employee}
      owner={applyBranch(owner, branch)}
      card={card}
      reviews={reviews}
      employees={employees.filter((e) => e.branch_id === branch.id)}
      branch={branch}
      branches={branches}
      handle={handle}
    />
  );
}
