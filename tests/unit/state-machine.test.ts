import test from "node:test";
import assert from "node:assert/strict";
import {
  canRoleToggleMilestone,
  canRoleTransitionStage,
  getCoTerminationWarning,
  applyMilestoneWithAttribution,
  stageToLegacyOrderStatus,
  legacyOrderStatusToStage,
} from "../../src/lib/fulfillment/state-machine";

test("partner milestone scope allows onboarding & follow-ups, blocks print/post/deliver", () => {
  assert.equal(canRoleToggleMilestone("partner", "greetings_sent"), true);
  assert.equal(canRoleToggleMilestone("partner", "customer_responded_designing"), true);
  assert.equal(canRoleToggleMilestone("partner", "followup_1_done"), true);
  assert.equal(canRoleToggleMilestone("partner", "followup_2_done"), true);
  assert.equal(canRoleToggleMilestone("partner", "followup_3_done"), true);

  assert.equal(canRoleToggleMilestone("partner", "card_printed_approved"), false);
  assert.equal(canRoleToggleMilestone("partner", "card_posted"), false);
  assert.equal(canRoleToggleMilestone("partner", "card_delivered"), false);
  assert.equal(canRoleToggleMilestone("partner", "pro_active"), false);
});

test("designer milestone scope allows ONLY printed/posted/delivered", () => {
  assert.equal(canRoleToggleMilestone("designer", "card_printed_approved"), true);
  assert.equal(canRoleToggleMilestone("designer", "card_posted"), true);
  assert.equal(canRoleToggleMilestone("designer", "card_delivered"), true);

  assert.equal(canRoleToggleMilestone("designer", "greetings_sent"), false);
  assert.equal(canRoleToggleMilestone("designer", "customer_responded_designing"), false);
  assert.equal(canRoleToggleMilestone("designer", "followup_1_done"), false);
});

test("designer stage transitions require Admin sent_to_designer handoff first", () => {
  const blockedFromAwaiting = canRoleTransitionStage("designer", "awaiting_customer", "printed_ready");
  assert.equal(blockedFromAwaiting.allowed, false);

  const blockedRevertingToCustomer = canRoleTransitionStage("designer", "sent_to_designer", "awaiting_customer");
  assert.equal(blockedRevertingToCustomer.allowed, false);

  assert.equal(canRoleTransitionStage("designer", "sent_to_designer", "printed_ready").allowed, true);
  assert.equal(canRoleTransitionStage("designer", "printed_ready", "posted").allowed, true);
  assert.equal(canRoleTransitionStage("designer", "posted", "delivered").allowed, true);
  assert.equal(canRoleTransitionStage("admin", "awaiting_customer", "sent_to_designer").allowed, true);
});

test("100-day co-termination validity warning triggers dynamically for <= 100 days remaining", () => {
  const baseNow = new Date("2026-11-26T00:00:00.000Z").getTime();
  const day = 86_400_000;

  const at101 = getCoTerminationWarning(new Date(baseNow + 101 * day).toISOString(), "pro", baseNow);
  assert.equal(at101.shouldWarn, false);
  assert.equal(at101.daysRemaining, 101);

  const at100 = getCoTerminationWarning(new Date(baseNow + 100 * day).toISOString(), "pro", baseNow);
  assert.equal(at100.shouldWarn, true);
  assert.equal(at100.daysRemaining, 100);

  const at98 = getCoTerminationWarning(new Date(baseNow + 98 * day).toISOString(), "pro", baseNow);
  assert.equal(at98.shouldWarn, true);
  assert.equal(at98.daysRemaining, 98);

  const expired = getCoTerminationWarning(new Date(baseNow - 1 * day).toISOString(), "pro", baseNow);
  assert.equal(expired.isExpired, true);
  assert.equal(expired.shouldWarn, false);

  const freePlan = getCoTerminationWarning(new Date(baseNow + 10 * day).toISOString(), "free", baseNow);
  assert.equal(freePlan.shouldWarn, false);
});

test("stage <-> legacy order status mapping and attribution metadata", () => {
  assert.equal(stageToLegacyOrderStatus("sent_to_designer"), "card_designed");
  assert.equal(stageToLegacyOrderStatus("printed_ready"), "ready_to_dispatch");
  assert.equal(stageToLegacyOrderStatus("posted"), "out_for_delivery");
  assert.equal(stageToLegacyOrderStatus("delivered"), "delivered");
  assert.equal(legacyOrderStatusToStage("card_designed"), "sent_to_designer");
  assert.equal(legacyOrderStatusToStage("on_work"), "sent_to_designer");

  const next = applyMilestoneWithAttribution(
    {},
    "greetings_sent",
    true,
    { id: "p-1", role: "partner", name: "Arun" },
    "2026-11-26T10:00:00.000Z"
  );
  assert.equal(next.greetings_sent.completed, true);
  assert.equal(next.greetings_sent.updated_by_role, "partner");
  assert.equal(next.greetings_sent.updated_by_name, "Arun");
});
