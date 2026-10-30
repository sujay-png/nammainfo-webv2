/**
 * Trial follow-up notes are private to the admin team, so they live in
 * their own table (profile_admin_notes) instead of on the public profile
 * row. Server-only helpers, called with the admin Supabase client.
 *
 * Until the 20261030_security_lockdown migration is run, the table does
 * not exist yet; these helpers then fall back to the old profile columns
 * so the admin console keeps working.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export interface AdminNotes {
  trialFollowUpMilestone: number;
  trialFollowUpStatus: "unattended" | "attended";
  trialFollowUpNotes: string;
  followUpStatus: "unattended" | "attended";
  followUpNotes: string;
}

export interface AdminNotesPatch {
  /** Trial follow-up */
  milestone?: number;
  status?: "unattended" | "attended";
  notes?: string;
  /** General company follow-up */
  companyStatus?: "unattended" | "attended";
  companyNotes?: string;
}

export async function saveAdminNotes(db: Db, profileId: string, patch: AdminNotesPatch) {
  const row: Record<string, unknown> = { profile_id: profileId, updated_at: new Date().toISOString() };
  if (typeof patch.milestone === "number") row.trial_follow_up_milestone = patch.milestone;
  if (patch.status) row.trial_follow_up_status = patch.status;
  if (typeof patch.notes === "string") row.trial_follow_up_notes = patch.notes;
  if (patch.companyStatus) row.follow_up_status = patch.companyStatus;
  if (typeof patch.companyNotes === "string") row.follow_up_notes = patch.companyNotes;

  const { error } = await db.from("profile_admin_notes").upsert(row, { onConflict: "profile_id" });
  if (!error) return { error: null };

  // Table not there yet (migration pending): use the old profile columns.
  const legacy: Record<string, unknown> = {};
  if ("trial_follow_up_milestone" in row) legacy.trial_follow_up_milestone = row.trial_follow_up_milestone;
  if ("trial_follow_up_status" in row) legacy.trial_follow_up_status = row.trial_follow_up_status;
  if ("trial_follow_up_notes" in row) legacy.trial_follow_up_notes = row.trial_follow_up_notes;
  if (Object.keys(legacy).length === 0) return { error };
  const { error: legacyError } = await db.from("profiles").update(legacy).eq("id", profileId);
  return { error: legacyError ?? null };
}

/** Notes for many profiles at once, keyed by profile id. */
export async function loadAdminNotes(db: Db, profileIds: string[]): Promise<Map<string, AdminNotes>> {
  const map = new Map<string, AdminNotes>();
  if (profileIds.length === 0) return map;
  for (let i = 0; i < profileIds.length; i += 500) {
    const { data, error } = await db
      .from("profile_admin_notes")
      .select("profile_id, trial_follow_up_milestone, trial_follow_up_status, trial_follow_up_notes, follow_up_status, follow_up_notes")
      .in("profile_id", profileIds.slice(i, i + 500));
    if (error) return map; // table not there yet: callers use profile columns
    for (const r of data ?? []) {
      map.set(r.profile_id, {
        trialFollowUpMilestone: Number(r.trial_follow_up_milestone ?? 0),
        trialFollowUpStatus: r.trial_follow_up_status === "attended" ? "attended" : "unattended",
        trialFollowUpNotes: r.trial_follow_up_notes ?? "",
        followUpStatus: r.follow_up_status === "attended" ? "attended" : "unattended",
        followUpNotes: r.follow_up_notes ?? "",
      });
    }
  }
  return map;
}
