# Issue #20 Requirement Map

This module is a deterministic milestone for SCIBASE issue #20, Revenue Infrastructure. It focuses on audit-ready pricing, usage metering, top-ups, institutional invoices, entitlement decisions, anonymized analytics licensing, and reconciliation evidence for revenue leakage.

| Issue requirement | Implementation |
| --- | --- |
| Tiered subscription billing | `selectPlan()` evaluates individual/institutional plans, seats, billing cycles, annual discounts, volume discounts, and coupons. |
| Group permissions and enterprise features | `evaluateEntitlements()` derives feature access such as private projects, institutional admin, and licensing API access. |
| Secure payment integrations | `buildPaymentIntegrationReadiness()` validates non-secret Stripe, PayPal, or institutional invoice profile metadata and reports missing setup without storing credentials. |
| AI compute billing | `meterComputeUsage()` aggregates usage events, applies unit rates, subtracts included compute credits, and hashes usage records. |
| Top-ups | `applyTopUps()` creates credit ledger entries with provider metadata and audit hashes. |
| Institutional invoices | `buildInvoiceSummary()` combines subscription, usage, top-ups, licensing, tax estimate, total, and audit hash. |
| Licensing APIs and analytics | `buildLicensingExport()` redacts snapshots to allowed anonymized fields for licensed metadata products. |
| Revenue health reporting | `buildRevenuePacket()` reports recurring revenue, variable revenue, total due, entitlements, and audit hash. |
| Revenue reconciliation | `reconcileRevenue()` flags incomplete payment setup, undercharged usage, missing top-up provider metadata, total mismatches, empty licensing exports, and licensing entitlement regressions. |
| Reviewer demo | `npm run demo` prints a deterministic invoice and entitlement summary for `data/sample-revenue.json`. |

## Verification

```bash
npm run check
npm test
npm run demo
```

The module is dependency-free and isolated under `revenue-metering-ledger/`.
