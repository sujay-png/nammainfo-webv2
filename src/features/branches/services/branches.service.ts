import { createClient } from "@/supabase/client";
import type { Branch, BranchDraft } from "../types";
import { branchErrorMessage } from "../types";

/**
 * Owner-side reads and writes for branches. Row-level security limits
 * every call to the signed-in owner's own branches; the branches_guard
 * trigger adds the paid-plan check, the 50-branch cap and the
 * "link already used by a team member" check.
 */

export type Result<T> = { ok: true; data: T } | { ok: false; error: string; missingTable?: boolean };

const missing = (m: string) => /relation .*branches.* does not exist|branches.*schema cache|Could not find the table/i.test(m);

/** Trims text fields; empty text becomes NULL (= use the main profile). */
function clean(d: Partial<BranchDraft>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(d)) {
    out[k] = typeof v === "string" ? (v.trim() === "" ? null : v.trim()) : v;
  }
  if (typeof d.name === "string") out.name = d.name.trim();
  if (typeof d.slug === "string") out.slug = d.slug.trim().toLowerCase();
  return out;
}

export async function listMyBranches(ownerId: string): Promise<Result<Branch[]>> {
  const { data, error } = await createClient()
    .from("branches")
    .select("*")
    .eq("owner_id", ownerId)
    .order("sort_order")
    .order("created_at");
  if (error) return { ok: false, error: branchErrorMessage(error.message), missingTable: missing(error.message) };
  return { ok: true, data: (data ?? []) as unknown as Branch[] };
}

export async function createBranch(ownerId: string, draft: BranchDraft): Promise<Result<Branch>> {
  const { data, error } = await createClient()
    .from("branches")
    .insert({ ...clean(draft), owner_id: ownerId })
    .select("*")
    .single();
  if (error) return { ok: false, error: branchErrorMessage(error.message), missingTable: missing(error.message) };
  return { ok: true, data: data as unknown as Branch };
}

export async function updateBranch(id: string, patch: Partial<BranchDraft>): Promise<Result<Branch>> {
  const { data, error } = await createClient()
    .from("branches")
    .update(clean(patch))
    .eq("id", id)
    .select("*")
    .single();
  if (error) return { ok: false, error: branchErrorMessage(error.message) };
  return { ok: true, data: data as unknown as Branch };
}

/** Deleting a branch keeps its team members; they move back to the main office (branch_id → NULL). */
export async function deleteBranch(id: string): Promise<Result<null>> {
  const { error } = await createClient().from("branches").delete().eq("id", id);
  if (error) return { ok: false, error: branchErrorMessage(error.message) };
  return { ok: true, data: null };
}

/** Saves a new order (sort_order = position). */
export async function reorderBranches(ids: string[]): Promise<void> {
  const supabase = createClient();
  await Promise.all(ids.map((id, i) => supabase.from("branches").update({ sort_order: i }).eq("id", id)));
}
