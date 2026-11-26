import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildEmployeeReferralRef,
  canSubmitAffiliateRequest,
  getPartnerQuickDestination,
  isActivePartnerAccount,
  normalizeAffiliateStatus,
  resolveAffiliateDecisionTransition,
} from "../../src/lib/affiliate/requests";

describe("Affiliate Program Request & Employee Partner Rules", () => {
  it("normalizes unknown affiliate statuses to none", () => {
    assert.equal(normalizeAffiliateStatus(undefined), "none");
    assert.equal(normalizeAffiliateStatus(""), "none");
    assert.equal(normalizeAffiliateStatus("weird"), "none");
    assert.equal(normalizeAffiliateStatus("pending"), "pending");
    assert.equal(normalizeAffiliateStatus("approved"), "approved");
    assert.equal(normalizeAffiliateStatus("rejected"), "rejected");
  });

  it("blocks duplicate pending requests, active partners, and internal staff", () => {
    assert.equal(canSubmitAffiliateRequest({ role: "user", affiliateStatus: "none" }).ok, true);
    assert.equal(canSubmitAffiliateRequest({ role: "employee", affiliateStatus: "none" }).ok, true);
    assert.equal(canSubmitAffiliateRequest({ role: "user", affiliateStatus: "rejected" }).ok, true);

    assert.equal(canSubmitAffiliateRequest({ role: "user", affiliateStatus: "pending" }).ok, false);
    assert.equal(canSubmitAffiliateRequest({ isPartner: true }).ok, false);
    assert.equal(canSubmitAffiliateRequest({ isCampaignManager: true }).ok, false);
    assert.equal(canSubmitAffiliateRequest({ isAdmin: true }).ok, false);
    assert.equal(canSubmitAffiliateRequest({ role: "designer" }).ok, false);
  });

  it("validates approve and reject decision transitions", () => {
    const approved = resolveAffiliateDecisionTransition("pending", "approve");
    assert.equal(approved.ok, true);
    assert.equal(approved.nextStatus, "approved");
    assert.equal(approved.cleanedReason, null);

    const rejected = resolveAffiliateDecisionTransition("pending", "reject", "  Incomplete info ");
    assert.equal(rejected.ok, true);
    assert.equal(rejected.nextStatus, "rejected");
    assert.equal(rejected.cleanedReason, "Incomplete info");

    // Idempotency / duplicate guard
    assert.equal(resolveAffiliateDecisionTransition("approved", "approve").ok, false);
    assert.equal(resolveAffiliateDecisionTransition("rejected", "reject").ok, false);
  });

  it("builds employee referral tokens prioritizing employee partners over company handle", () => {
    assert.equal(
      buildEmployeeReferralRef({
        employeeId: "emp-123",
        employeeIsPartner: true,
        ownerHandle: "aksharadigital",
      }),
      "emp_emp-123"
    );

    assert.equal(
      buildEmployeeReferralRef({
        employeeId: "emp-123",
        employeeIsPartner: false,
        ownerHandle: "aksharadigital",
      }),
      "aksharadigital"
    );
  });

  it("builds 1-click quick link URLs for production subdomain vs same-origin localhost", () => {
    assert.equal(
      getPartnerQuickDestination({ hostname: "nammainfo.in", tokenHash: "tok_abc" }),
      "https://partner.nammainfo.in/auth/callback?token_hash=tok_abc&type=magiclink&next=/"
    );
    assert.equal(
      getPartnerQuickDestination({ hostname: "www.nammainfo.in", tokenHash: "tok_abc" }),
      "https://partner.nammainfo.in/auth/callback?token_hash=tok_abc&type=magiclink&next=/"
    );
    assert.equal(
      getPartnerQuickDestination({ hostname: "localhost", tokenHash: "tok_abc" }),
      "/partner"
    );
  });

  it("detects active partners regardless of owner vs employee role", () => {
    assert.equal(isActivePartnerAccount({ is_partner: true, role: "employee" }), true);
    assert.equal(isActivePartnerAccount({ is_campaign_manager: true, role: "user" }), true);
    assert.equal(isActivePartnerAccount({ is_partner: false, role: "user" }), false);
  });
});
