/**
 * Card counting shared by billing screens and the payment server.
 *
 *   primary card     the company            nammainfo.in/abc
 *   secondary cards  branches + team        nammainfo.in/abc/<x>
 *   tertiary cards   team of a branch       nammainfo.in/abc/<branch>/<x>
 *
 * Branches and every team member (main office or branch) are all
 * "secondary or tertiary" cards: they share the slots the owner bought
 * (profiles.purchased_id_count) and are priced together with the primary
 * card (src/lib/pricing.ts). The database enforces the same rule
 * (secondary_cards_used() in 20261120_branch_card_slots.sql).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnySupabase = { from: (table: any) => any };

/** Number of branches a business has (hidden ones too: they keep their slot). 0 if the table doesn't exist yet. */
export async function countBranches(supabase: AnySupabase, ownerId: string): Promise<number> {
  const { count, error } = await supabase
    .from("branches")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId);
  return error ? 0 : count ?? 0;
}
