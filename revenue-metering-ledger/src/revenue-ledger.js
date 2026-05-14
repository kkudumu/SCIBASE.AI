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
      provider: purchase.provider || null,
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

function buildSubscriptionLifecycle(catalogInput, account, usage) {
  const catalog = normalizeCatalog(catalogInput);
  const plan = selectPlan(catalog, account);
  const trialEndsAt = account.trialEndsAt || null;
  const now = account.evaluatedAt || "2026-05-14T00:00:00Z";
  const inTrial = trialEndsAt ? new Date(now) < new Date(trialEndsAt) : false;
  const renewalCadence = plan.billingCycle === "annual" ? "annual" : "monthly";
  const consortiumEligible = Boolean(account.consortiumId || account.couponId || plan.volumeDiscount > 0);
  const usageRatio = plan.includedComputeCredits
    ? Number((Number((usage && usage.grossUsage) || 0) / Number(plan.includedComputeCredits || 1)).toFixed(4))
    : 0;
  const recommendedTopUp = catalog.topUpPacks
    .filter((pack) => Number(pack.credits || 0) >= Math.max(0, Number((usage && usage.grossUsage) || 0) - Number(plan.includedComputeCredits || 0)))
    .sort((left, right) => Number(left.price || 0) - Number(right.price || 0))[0] || null;

  return {
    accountId: account.id,
    planId: plan.planId,
    lifecycleStatus: inTrial ? "trialing" : "active",
    trial: {
      startedAt: account.trialStartedAt || null,
      endsAt: trialEndsAt,
      active: inTrial,
      convertsToPlanId: plan.planId,
    },
    renewal: {
      cadence: renewalCadence,
      nextRenewalAt: account.nextRenewalAt || null,
      autoRenew: account.autoRenew !== false,
    },
    consortiumPricing: {
      eligible: consortiumEligible,
      consortiumId: account.consortiumId || null,
      couponId: account.couponId || null,
      volumeDiscount: plan.volumeDiscount,
      annualDiscount: plan.annualDiscount,
    },
    autoScaling: {
      usageRatio,
      recommendation: usageRatio >= 1.2
        ? "buy-top-up-or-upgrade-plan"
        : usageRatio >= 0.8
          ? "monitor-usage"
          : "no-change",
      recommendedTopUpPackId: recommendedTopUp ? recommendedTopUp.id : null,
    },
    lifecycleHash: hashRecord({ accountId: account.id, plan, usageRatio, trialEndsAt }),
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

function addFinding(findings, code, message, evidence) {
  findings.push({
    code,
    severity: code === "INVOICE_TOTAL_MISMATCH" ? "high" : "medium",
    message,
    evidence: evidence || {},
  });
}

function reconcileRevenue(invoice, entitlements) {
  const findings = [];
  const expectedSubtotal = money(
    invoice.plan.total
      + invoice.usage.billableUsage
      + invoice.topUps.reduce((sum, topUp) => sum + Number(topUp.amount || 0), 0)
      + invoice.licensing.monthlyAmount,
  );
  const expectedTotal = money(invoice.subtotal + invoice.taxEstimate);

  if (!invoice.paymentReadiness.ready) {
    addFinding(findings, "PAYMENT_SETUP_INCOMPLETE", "Billing provider profile is missing required metadata.", {
      provider: invoice.paymentReadiness.provider,
      missingFields: invoice.paymentReadiness.missingFields,
    });
  }

  if (invoice.usage.grossUsage > invoice.usage.includedComputeCredits && invoice.usage.billableUsage === 0) {
    addFinding(findings, "USAGE_UNDERCHARGED", "Usage exceeded included credits but no overage was billed.", {
      grossUsage: invoice.usage.grossUsage,
      includedComputeCredits: invoice.usage.includedComputeCredits,
      billableUsage: invoice.usage.billableUsage,
    });
  }

  for (const topUp of invoice.topUps) {
    if (!topUp.provider) {
      addFinding(findings, "TOP_UP_WITHOUT_PROVIDER", "Top-up ledger entry is missing payment provider metadata.", {
        purchaseId: topUp.purchaseId,
        packId: topUp.packId,
      });
    }
  }

  if (expectedSubtotal !== invoice.subtotal || expectedTotal !== invoice.total) {
    addFinding(findings, "INVOICE_TOTAL_MISMATCH", "Invoice total does not reconcile to component charges and tax.", {
      expectedSubtotal,
      actualSubtotal: invoice.subtotal,
      expectedTotal,
      actualTotal: invoice.total,
    });
  }

  if (invoice.licensing.products.length > 0 && Object.keys(invoice.licensing.redactedSnapshot).length === 0) {
    addFinding(findings, "LICENSING_EXPORT_EMPTY", "Licensed analytics products produced an empty redacted export.", {
      productIds: invoice.licensing.products.map((product) => product.id),
    });
  }

  if (invoice.licensing.products.length > 0 && entitlements && !entitlements.canAccessLicensingApi) {
    addFinding(findings, "ENTITLEMENT_REGRESSION", "Licensed analytics products are present but licensing API access is disabled.", {
      productIds: invoice.licensing.products.map((product) => product.id),
    });
  }

  return {
    status: findings.length === 0 ? "pass" : "review",
    findings,
    reconciliationHash: hashRecord({
      invoiceId: invoice.invoiceId,
      findings,
      subtotal: invoice.subtotal,
      total: invoice.total,
    }),
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
  const entitlements = evaluateEntitlements(invoice);
  const reconciliation = reconcileRevenue(invoice, entitlements);
  const subscriptionLifecycle = buildSubscriptionLifecycle(catalogInput, account, invoice.usage);
  return {
    invoice,
    subscriptionLifecycle,
    entitlements,
    reconciliation,
    revenueHealth: {
      recurringRevenue: money(invoice.plan.total + invoice.licensing.monthlyAmount),
      variableRevenue: money(invoice.usage.billableUsage + invoice.topUps.reduce((sum, topUp) => sum + topUp.amount, 0)),
      totalDue: invoice.total,
      auditHash: invoice.auditHash,
      reconciliationStatus: reconciliation.status,
      lifecycleStatus: subscriptionLifecycle.lifecycleStatus,
    },
  };
}

module.exports = {
  applyTopUps,
  buildInvoiceSummary,
  buildLicensingExport,
  buildPaymentIntegrationReadiness,
  buildRevenuePacket,
  buildSubscriptionLifecycle,
  evaluateEntitlements,
  hashRecord,
  meterComputeUsage,
  normalizeCatalog,
  reconcileRevenue,
  selectPlan,
};
