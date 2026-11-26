import test from "node:test";
import assert from "node:assert/strict";
import {
  getCardUnitPrice,
  calculateInitialProCost,
  calculatePrimaryCardAddonCost,
  calculateTeamAddonCost,
  calculateRenewalCost,
} from "../../src/lib/pricing";

test("volume pricing tiers match 1-4, 5-24, and 25+ thresholds", () => {
  assert.equal(getCardUnitPrice(1), 1999);
  assert.equal(getCardUnitPrice(4), 1999);
  assert.equal(getCardUnitPrice(5), 1499);
  assert.equal(getCardUnitPrice(24), 1499);
  assert.equal(getCardUnitPrice(25), 999);
  assert.equal(getCardUnitPrice(50), 999);
});

test("primary card addon is strictly ₹500 per physical card one-time", () => {
  const one = calculatePrimaryCardAddonCost(1);
  assert.equal(one.unitPrice, 500);
  assert.equal(one.totalAmount, 500);

  const three = calculatePrimaryCardAddonCost(3);
  assert.equal(three.unitPrice, 500);
  assert.equal(three.totalAmount, 1500);
});

test("calculateRenewalCost NEVER multiplies extra ₹500 primary physical cards", () => {
  // Owner bought 1 Pro + 4 extra physical primary cards (primary_card_count = 5), 0 team cards
  const soloWithExtraPrimary = calculateRenewalCost(5, 0);
  assert.equal(soloWithExtraPrimary.primarySubscriptions, 1);
  assert.equal(soloWithExtraPrimary.totalCards, 1);
  assert.equal(soloWithExtraPrimary.unitPrice, 1999);
  assert.equal(soloWithExtraPrimary.totalAmount, 1999);

  // Owner has 3 physical primary cards + 4 team/branch cards -> total renewing = 1 + 4 = 5 (tier 1499)
  const teamFive = calculateRenewalCost(3, 4);
  assert.equal(teamFive.totalCards, 5);
  assert.equal(teamFive.unitPrice, 1499);
  assert.equal(teamFive.totalAmount, 5 * 1499);

  // Owner has 2 physical primary cards + 24 team/branch cards -> total renewing = 25 (tier 999)
  const teamTwentyFive = calculateRenewalCost(2, 24);
  assert.equal(teamTwentyFive.totalCards, 25);
  assert.equal(teamTwentyFive.unitPrice, 999);
  assert.equal(teamTwentyFive.totalAmount, 25 * 999);
});

test("initial pro cost charges 1999 base + 500 per extra physical primary card", () => {
  const single = calculateInitialProCost(1);
  assert.equal(single.totalAmount, 1999);

  const triple = calculateInitialProCost(3);
  assert.equal(triple.extraCards, 2);
  assert.equal(triple.extraCost, 1000);
  assert.equal(triple.totalAmount, 2999);
});

test("team addon cost applies volume tier across new total seats", () => {
  const res = calculateTeamAddonCost(3, 2); // 3 + 2 = 5 -> 1499/card
  assert.equal(res.newTotalCards, 5);
  assert.equal(res.unitPrice, 1499);
  assert.equal(res.totalAmount, 2 * 1499);
});
