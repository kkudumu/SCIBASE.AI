"use strict";

const sample = require("../data/sample-revenue.json");
const { buildRevenuePacket } = require("../src/revenue-ledger");

const packet = buildRevenuePacket(
  sample.catalog,
  sample.account,
  sample.usageEvents,
  sample.topUpPurchases,
  sample.analyticsSnapshot,
);

console.log(
  JSON.stringify(
    {
      accountId: packet.invoice.accountId,
      billingProvider: packet.invoice.billingProvider,
      paymentReadiness: packet.invoice.paymentReadiness,
      planTotal: packet.invoice.plan.total,
      billableUsage: packet.invoice.usage.billableUsage,
      licensingMonthly: packet.invoice.licensing.monthlyAmount,
      invoiceTotal: packet.invoice.total,
      entitlements: packet.entitlements,
      auditHash: packet.revenueHealth.auditHash,
    },
    null,
    2,
  ),
);
