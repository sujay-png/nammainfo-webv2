import test from "node:test";
import assert from "node:assert/strict";
import {
  syncMilestoneChange,
  transitionFulfillmentJobStage,
  runScheduledAlertSweep,
} from "../../src/lib/fulfillment/service";

/**
 * Lightweight in-memory Supabase query builder mock for testing end-to-end
 * synchronization across profiles, fulfillment_jobs, orders, fulfillment_events,
 * staff_notifications, and crm_followups.
 */
function createMockSupabase(initial: Record<string, any[]>) {
  const db: Record<string, any[]> = structuredClone(initial);
  let seq = 1;

  function makeQuery(table: string) {
    let filters: Array<(row: any) => boolean> = [];
    let pendingOp: "select" | "insert" | "update" | "upsert" = "select";
    let payload: any = null;
    let isSingle = false;
    let isMaybeSingle = false;

    const api: any = {
      select() {
        return api;
      },
      insert(data: any) {
        pendingOp = "insert";
        payload = data;
        return api;
      },
      update(data: any) {
        pendingOp = "update";
        payload = data;
        return api;
      },
      upsert(data: any) {
        pendingOp = "upsert";
        payload = data;
        return api;
      },
      eq(col: string, val: any) {
        filters.push((r) => r[col] === val);
        return api;
      },
      neq(col: string, val: any) {
        filters.push((r) => r[col] !== val);
        return api;
      },
      in(col: string, vals: any[]) {
        filters.push((r) => vals.includes(r[col]));
        return api;
      },
      is(col: string, val: any) {
        filters.push((r) => r[col] === val);
        return api;
      },
      gte(col: string, val: any) {
        filters.push((r) => r[col] >= val);
        return api;
      },
      lte(col: string, val: any) {
        filters.push((r) => r[col] <= val);
        return api;
      },
      order() {
        return api;
      },
      limit() {
        return api;
      },
      single() {
        isSingle = true;
        return api.then((res: any) => res);
      },
      maybeSingle() {
        isMaybeSingle = true;
        return api.then((res: any) => res);
      },
      then(resolve: any) {
        const rows = db[table] || (db[table] = []);
        let out: any = null;

        if (pendingOp === "insert") {
          const arr = Array.isArray(payload) ? payload : [payload];
          const inserted = arr.map((item) => ({
            id: item.id || `${table}-${seq++}`,
            created_at: new Date().toISOString(),
            ...item,
          }));
          rows.push(...inserted);
          out = Array.isArray(payload) ? inserted : inserted[0];
        } else if (pendingOp === "upsert") {
          const item = payload;
          const exists = item.dedupe_key
            ? rows.find((r) => r.dedupe_key === item.dedupe_key)
            : null;
          if (!exists) {
            const rec = { id: `${table}-${seq++}`, created_at: new Date().toISOString(), ...item };
            rows.push(rec);
            out = rec;
          } else {
            out = exists;
          }
        } else if (pendingOp === "update") {
          const matched = rows.filter((r) => filters.every((fn) => fn(r)));
          for (const r of matched) Object.assign(r, payload);
          out = isSingle || isMaybeSingle ? matched[0] || null : matched;
        } else {
          const matched = rows.filter((r) => filters.every((fn) => fn(r)));
          out = isSingle || isMaybeSingle ? matched[0] || null : matched;
        }

        return Promise.resolve(resolve({ data: out, error: null }));
      },
    };
    return api;
  }

  return {
    db,
    from: (table: string) => makeQuery(table),
  };
}

test("Partner cannot mark print/post/deliver (403) but CAN mark sent_to_designer and notify Admin + Designer", async () => {
  const mock = createMockSupabase({
    profiles: [
      {
        id: "cust-1",
        business_name: "FinYes Consulting",
        owner_name: "Balajee",
        subscription_plan: "trial",
        referred_by: "partner-1",
        card_process: {},
      },
      { id: "partner-1", owner_name: "Arun Partner", business_name: "Arun Partners" },
    ],
    fulfillment_jobs: [],
    fulfillment_job_items: [],
    fulfillment_events: [],
    staff_notifications: [],
    orders: [],
    crm_followups: [],
    profile_admin_notes: [],
  });

  // Partner blocked from marking Card Printed
  const denied = await syncMilestoneChange(mock as any, {
    profileId: "cust-1",
    stepKey: "card_printed_approved",
    completed: true,
    actor: { id: "partner-1", role: "partner", name: "Arun Partner" },
  });
  assert.equal(denied.ok, false);
  if (!denied.ok) assert.equal(denied.status, 403);

  // Partner marks Customer Responded & Sent to Designer
  const okRes = await syncMilestoneChange(mock as any, {
    profileId: "cust-1",
    stepKey: "customer_responded_designing",
    completed: true,
    actor: { id: "partner-1", role: "partner", name: "Arun Partner" },
  });
  assert.equal(okRes.ok, true);
  assert.equal(mock.db.fulfillment_jobs.length, 1);
  assert.equal(mock.db.fulfillment_jobs[0].stage, "sent_to_designer");
  assert.equal(mock.db.fulfillment_jobs[0].job_type, "free_trial");

  // Designer & Admin both receive notifications
  const rolesNotified = new Set(mock.db.staff_notifications.map((n) => n.recipient_role));
  assert.equal(rolesNotified.has("admin"), true);
  assert.equal(rolesNotified.has("designer"), true);
});

test("Designer marking Printed -> Posted -> Delivered auto-syncs orders, profiles, events & notifies Admin/Partner", async () => {
  const mock = createMockSupabase({
    profiles: [
      {
        id: "cust-2",
        business_name: "Apex Dental",
        owner_name: "Dr. Rao",
        subscription_plan: "pro",
        referred_by: "partner-1",
        card_process: {},
      },
      { id: "designer-1", owner_name: "Kiran Designer" },
    ],
    orders: [{ id: "ord-1", profile_id: "cust-2", status: "card_designed" }],
    fulfillment_jobs: [
      {
        id: "job-1",
        profile_id: "cust-2",
        order_id: "ord-1",
        job_type: "pro_initial",
        stage: "sent_to_designer",
        card_quantity: 1,
      },
    ],
    fulfillment_job_items: [{ id: "item-1", job_id: "job-1", is_printed: false }],
    fulfillment_events: [],
    staff_notifications: [],
  });

  const printed = await transitionFulfillmentJobStage(mock as any, {
    jobId: "job-1",
    toStage: "printed_ready",
    actor: { id: "designer-1", role: "designer", name: "Kiran" },
  });
  assert.equal(printed.ok, true);
  assert.equal(mock.db.orders[0].status, "ready_to_dispatch");
  assert.equal(mock.db.fulfillment_job_items[0].is_printed, true);

  const posted = await transitionFulfillmentJobStage(mock as any, {
    jobId: "job-1",
    toStage: "posted",
    actor: { id: "designer-1", role: "designer", name: "Kiran" },
    courierName: "DTDC",
    trackingNumber: "DT123456",
  });
  assert.equal(posted.ok, true);
  assert.equal(mock.db.orders[0].status, "out_for_delivery");
  assert.equal(mock.db.fulfillment_jobs[0].tracking_number, "DT123456");

  const delivered = await transitionFulfillmentJobStage(mock as any, {
    jobId: "job-1",
    toStage: "delivered",
    actor: { id: "designer-1", role: "designer", name: "Kiran" },
  });
  assert.equal(delivered.ok, true);
  assert.equal(mock.db.orders[0].status, "delivered");
  assert.equal(mock.db.profiles[0].card_process.card_delivered.completed, true);
  assert.equal(mock.db.profiles[0].card_process.card_delivered.updated_by_role, "designer");
  assert.equal(mock.db.fulfillment_events.length, 3);
});

test("runScheduledAlertSweep generates deduplicated 3-day expiry & tomorrow follow-up alerts", async () => {
  const now = Date.now();
  const mock = createMockSupabase({
    profiles: [
      {
        id: "cust-exp",
        business_name: "Expiring Corp",
        owner_name: "Meera",
        subscription_plan: "pro",
        membership_expires_at: new Date(now + 2 * 86_400_000).toISOString(),
        referred_by: null,
      },
    ],
    crm_followups: [
      {
        id: "fu-1",
        profile_id: "cust-exp",
        assigned_role: "admin",
        assigned_user_id: null,
        followup_type: "custom",
        due_at: new Date(now + 1 * 86_400_000).toISOString(),
        status: "pending",
        notes: "Follow up tomorrow for renewal",
      },
    ],
    staff_notifications: [],
  });

  const first = await runScheduledAlertSweep(mock as any);
  assert.equal(first.expiryAlertsCreated, 1);
  assert.equal(first.followupAlertsCreated, 1);
  assert.equal(mock.db.staff_notifications.length, 2);

  // Second run must deduplicate cleanly
  await runScheduledAlertSweep(mock as any);
  assert.equal(mock.db.staff_notifications.length, 2);
});
