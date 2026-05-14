"use strict";

const crypto = require("crypto");

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function money(value) {
  return Number(Number(value || 0).toFixed(2));
}

function hashRecord(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 18);
}

function normalizeCatalog(catalog) {
  return {
    plans: asArray(catalog && catalog.plans),
    computeRates: asArray(catalog && catalog.computeRates),
    topUpPacks: asArray(catalog && catalog.topUpPacks),
    licensingProducts: asArray(catalog && catalog.licensingProducts),
    coupons: asArray(catalog && catalog.coupons),
    paymentProviders: asArray(catalog && catalog.paymentProviders),
  };
}

function selectPlan(catalogInput, account) {
  const catalog = normalizeCatalog(catalogInput);
  const requestedPlan = account.planId;
  const plan = catalog.plans.find((candidate) => candidate.id === requestedPlan);
  if (!plan) throw new Error(`unknown plan: ${requestedPlan}`);

  const seats = Math.max(Number(account.seats || 1), 1);
  const annual = account.billingCycle === "annual";
  const seatSubtotal = money(plan.basePrice + Math.max(0, seats - plan.includedSeats) * plan.extraSeatPrice);
  const annualDiscount = annual ? money(seatSubtotal * Number(plan.annualDiscount || 0)) : 0;
  const volumeDiscount = seats >= Number(plan.volumeDiscountThreshold || Infinity)
    ? money((seatSubtotal - annualDiscount) * Number(plan.volumeDiscount || 0))
    : 0;
  const coupon = catalog.coupons.find((candidate) => candidate.id === account.couponId);
  const couponDiscount = coupon ? money((seatSubtotal - annualDiscount - volumeDiscount) * Number(coupon.percentOff || 0)) : 0;

  return {
    planId: plan.id,
    name: plan.name,
    seats,
    billingCycle: account.billingCycle || "monthly",
    includedSeats: plan.includedSeats,
    includedComputeCredits: plan.includedComputeCredits,
    subtotal: seatSubtotal,
    annualDiscount,
    volumeDiscount,
    couponDiscount,
    total: money(seatSubtotal - annualDiscount - volumeDiscount - couponDiscount),
    features: asArray(plan.features),
  };
}

function meterComputeUsage(catalogInput, account, usageEvents) {
  const catalog = normalizeCatalog(catalogInput);
  const planDecision = selectPlan(catalog, account);
  const usageByKind = {};

  for (const event of asArray(usageEvents)) {
    const kind = event.kind || "unknown";
    usageByKind[kind] = (usageByKind[kind] || 0) + Number(event.units || 0);
  }

  const lineItems = Object.entries(usageByKind).map(([kind, units]) => {
    const rate = catalog.computeRates.find((candidate) => candidate.kind === kind) || { unitPrice: 0 };
    return {
      kind,
      units: Number(units.toFixed(4)),
      unitPrice: Number(rate.unitPrice || 0),
      amount: money(units * Number(rate.unitPrice || 0)),
    };
  });

  const grossUsage = money(lineItems.reduce((sum, item) => sum + item.amount, 0));
  const creditValue = money(Number(planDecision.includedComputeCredits || 0));
  const billableUsage = money(Math.max(0, grossUsage - creditValue));

  return {
    accountId: account.id,
    includedComputeCredits: creditValue,
    lineItems,
    grossUsage,
    billableUsage,
    usageHash: hashRecord(usageEvents),
  };
}

function applyTopUps(catalogInput, account, purchases) {
  const catalog = normalizeCatalog(catalogInput);
  return asArray(purchases).map((purchase) => {
    const pack = catalog.topUpPacks.find((candidate) => candidate.id === purchase.packId);
    if (!pack) throw new Error(`unknown top-up pack: ${purchase.packId}`);
    const quantity = Number(purchase.quantity || 1);
    return {
      purchaseId: purchase.id,
      accountId: account.id,
      packId: pack.id,
      credits: Number(pack.credits || 0) * quantity,
      amount: money(Number(pack.price || 0) * quantity),
      provider: purchase.provider || "stripe",
      ledgerHash: hashRecord({ purchase, pack, accountId: account.id }),
    };
  });
}

function buildLicensingExport(catalogInput, account, analyticsSnapshot) {
  const catalog = normalizeCatalog(catalogInput);
  const requested = asArray(account.licensingProductIds);
  const products = catalog.licensingProducts.filter((product) => requested.includes(product.id));
  const allowedFields = new Set(products.flatMap((product) => asArray(product.allowedFields)));
  const redactedSnapshot = {};
  for (const [key, value] of Object.entries(analyticsSnapshot || {})) {
    if (allowedFields.has(key)) redactedSnapshot[key] = value;
  }

  return {
    accountId: account.id,
    products: products.map((product) => ({
      id: product.id,
      name: product.name,
      monthlyPrice: product.monthlyPrice,
      allowedFields: asArray(product.allowedFields),
    })),
    monthlyAmount: money(products.reduce((sum, product) => sum + Number(product.monthlyPrice || 0), 0)),
    redactedSnapshot,
    exportHash: hashRecord({ products, redactedSnapshot }),
  };
}

function buildPaymentIntegrationReadiness(catalogInput, account) {
  const catalog = normalizeCatalog(catalogInput);
  const providerId = account.billingProvider || "stripe";
  const provider = catalog.paymentProviders.find((candidate) => candidate.id === providerId) || {
    id: providerId,
    requiredFields: [],
  };
  const profile = account.paymentProfile || {};
  const missingFields = asArray(provider.requiredFields).filter((field) => !profile[field]);

  return {
    provider: provider.id,
    mode: provider.mode || "charge",
    ready: missingFields.length === 0,
    missingFields,
    nonSecretProfileHash: hashRecord({
      provider: provider.id,
      profile,
    }),
  };
}

function buildInvoiceSummary(catalogInput, account, usageEvents, topUpPurchases, analyticsSnapshot) {
  const catalog = normalizeCatalog(catalogInput);
  const planDecision = selectPlan(catalog, account);
  const usage = meterComputeUsage(catalog, account, usageEvents);
  const topUps = applyTopUps(catalog, account, topUpPurchases);
  const licensing = buildLicensingExport(catalog, account, analyticsSnapshot);
  const topUpTotal = money(topUps.reduce((sum, item) => sum + item.amount, 0));
  const subtotal = money(planDecision.total + usage.billableUsage + topUpTotal + licensing.monthlyAmount);

  return {
    invoiceId: `${account.id}-${new Date().toISOString().slice(0, 10)}`,
    accountId: account.id,
    billingProvider: account.billingProvider || "stripe",
    paymentReadiness: buildPaymentIntegrationReadiness(catalog, account),
    plan: planDecision,
    usage,
    topUps,
    licensing,
    subtotal,
    taxEstimate: money(subtotal * Number(account.taxRate || 0)),
    total: money(subtotal * (1 + Number(account.taxRate || 0))),
    auditHash: hashRecord({ account, planDecision, usage, topUps, licensing, subtotal }),
  };
}

function evaluateEntitlements(invoice) {
  const features = new Set(invoice.plan.features);
  return {
    accountId: invoice.accountId,
    canCreatePrivateProjects: features.has("private-projects"),
    canUseInstitutionalAdmin: features.has("institutional-admin"),
    canAccessLicensingApi: invoice.licensing.products.length > 0,
    computeOverageBilled: invoice.usage.billableUsage > 0,
    topUpCredits: invoice.topUps.reduce((sum, topUp) => sum + topUp.credits, 0),
  };
}

function buildRevenuePacket(catalogInput, account, usageEvents, topUpPurchases, analyticsSnapshot) {
  const invoice = buildInvoiceSummary(
    catalogInput,
    account,
    usageEvents,
    topUpPurchases,
    analyticsSnapshot,
  );
  return {
    invoice,
    entitlements: evaluateEntitlements(invoice),
    revenueHealth: {
      recurringRevenue: money(invoice.plan.total + invoice.licensing.monthlyAmount),
      variableRevenue: money(invoice.usage.billableUsage + invoice.topUps.reduce((sum, topUp) => sum + topUp.amount, 0)),
      totalDue: invoice.total,
      auditHash: invoice.auditHash,
    },
  };
}

module.exports = {
  applyTopUps,
  buildInvoiceSummary,
  buildLicensingExport,
  buildPaymentIntegrationReadiness,
  buildRevenuePacket,
  evaluateEntitlements,
  hashRecord,
  meterComputeUsage,
  normalizeCatalog,
  selectPlan,
};
