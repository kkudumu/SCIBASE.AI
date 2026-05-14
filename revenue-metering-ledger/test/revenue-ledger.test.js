"use strict";

const assert = require("assert");
const sample = require("../data/sample-revenue.json");
const {
  applyTopUps,
  buildInvoiceSummary,
  buildLicensingExport,
  buildPaymentIntegrationReadiness,
  buildRevenuePacket,
  evaluateEntitlements,
  meterComputeUsage,
  selectPlan,
} = require("../src/revenue-ledger");

function testPlanSelection() {
  const plan = selectPlan(sample.catalog, sample.account);

  assert.strictEqual(plan.planId, "institutional");
  assert.strictEqual(plan.seats, 80);
  assert.ok(plan.annualDiscount > 0);
  assert.ok(plan.volumeDiscount > 0);
  assert.ok(plan.couponDiscount > 0);
  assert.ok(plan.features.includes("institutional-admin"));
}

function testUsageMetering() {
  const usage = meterComputeUsage(sample.catalog, sample.account, sample.usageEvents);

  assert.strictEqual(usage.lineItems.length, 3);
  assert.strictEqual(usage.grossUsage, 335.8);
  assert.strictEqual(usage.billableUsage, 85.8);
  assert.ok(usage.usageHash.length >= 12);
}

function testTopUps() {
  const topUps = applyTopUps(sample.catalog, sample.account, sample.topUpPurchases);

  assert.strictEqual(topUps.length, 1);
  assert.strictEqual(topUps[0].credits, 500);
  assert.strictEqual(topUps[0].amount, 425);
}

function testLicensingExportRedactsPrivateFields() {
  const licensing = buildLicensingExport(sample.catalog, sample.account, sample.analyticsSnapshot);

  assert.strictEqual(licensing.monthlyAmount, 350);
  assert.ok(licensing.redactedSnapshot.topicTrends);
  assert.strictEqual(licensing.redactedSnapshot.privateProjectTitles, undefined);
}

function testPaymentIntegrationReadiness() {
  const ready = buildPaymentIntegrationReadiness(sample.catalog, sample.account);
  const missing = buildPaymentIntegrationReadiness(sample.catalog, {
    ...sample.account,
    billingProvider: "paypal",
    paymentProfile: { payerId: "payer-123" },
  });

  assert.strictEqual(ready.provider, "institutional-invoice");
  assert.strictEqual(ready.ready, true);
  assert.ok(ready.nonSecretProfileHash.length >= 12);
  assert.strictEqual(missing.ready, false);
  assert.deepStrictEqual(missing.missingFields, ["billingAgreementId"]);
}

function testInvoiceAndEntitlements() {
  const invoice = buildInvoiceSummary(
    sample.catalog,
    sample.account,
    sample.usageEvents,
    sample.topUpPurchases,
    sample.analyticsSnapshot,
  );
  const entitlements = evaluateEntitlements(invoice);

  assert.strictEqual(invoice.billingProvider, "institutional-invoice");
  assert.strictEqual(invoice.paymentReadiness.ready, true);
  assert.ok(invoice.total > invoice.subtotal);
  assert.strictEqual(entitlements.canUseInstitutionalAdmin, true);
  assert.strictEqual(entitlements.canAccessLicensingApi, true);
  assert.strictEqual(entitlements.computeOverageBilled, true);
}

function testRevenuePacket() {
  const packet = buildRevenuePacket(
    sample.catalog,
    sample.account,
    sample.usageEvents,
    sample.topUpPurchases,
    sample.analyticsSnapshot,
  );

  assert.ok(packet.revenueHealth.recurringRevenue > 0);
  assert.ok(packet.revenueHealth.variableRevenue > 0);
  assert.strictEqual(packet.revenueHealth.totalDue, packet.invoice.total);
}

testPlanSelection();
testUsageMetering();
testTopUps();
testLicensingExportRedactsPrivateFields();
testPaymentIntegrationReadiness();
testInvoiceAndEntitlements();
testRevenuePacket();

console.log("revenue-metering-ledger tests passed");
