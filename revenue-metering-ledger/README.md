# Revenue Metering Ledger

Self-contained revenue infrastructure milestone for [SCIBASE.AI issue #20](https://github.com/SCIBASE-AI/SCIBASE.AI/issues/20).

The issue asks for subscriptions, usage-based AI compute billing, top-ups, institutional invoices, and licensing APIs. This module focuses on an audit-ready revenue ledger that can evaluate pricing decisions and produce deterministic invoice packets without external payment credentials.

## What It Adds

- Tiered plan evaluation with seats, annual discounts, volume discounts, and coupons.
- AI compute metering for summarization, peer review, and reproducibility checks.
- Top-up credit ledger entries with provider metadata and hashes.
- Payment-provider readiness checks for Stripe, PayPal, and institutional invoice profiles using non-secret metadata.
- Anonymized analytics licensing export that only includes allowed fields.
- Institutional invoice summary with tax estimate, total due, and audit hash.
- Entitlement decisions for private projects, institutional admin, licensing API access, overage billing, and top-up credits.
- Revenue reconciliation findings for payment setup gaps, unbilled usage, top-ups without provider metadata, invoice total mismatches, empty licensing exports, and entitlement regressions.
- Sample revenue fixture, tests, requirement map, CLI demo, and short demo GIF.

## Run

```bash
cd revenue-metering-ledger
npm run check
npm test
npm run demo
```

Expected demo shape:

```json
{
  "accountId": "acct-northstar-university",
  "billingProvider": "institutional-invoice",
  "paymentReadiness": {
    "provider": "institutional-invoice",
    "ready": true
  },
  "billableUsage": 85.8,
  "licensingMonthly": 350,
  "entitlements": {
    "canUseInstitutionalAdmin": true,
    "canAccessLicensingApi": true
  },
  "reconciliation": {
    "status": "pass",
    "findings": []
  }
}
```

## Demo Artifact

See [docs/demo.gif](docs/demo.gif) for a short visual walkthrough. The SVG source is included at [docs/demo.svg](docs/demo.svg).

## Files

- `src/revenue-ledger.js` - pricing, metering, top-ups, licensing, invoices, entitlements, and revenue reconciliation.
- `data/sample-revenue.json` - reviewable catalog/account/usage fixture.
- `test/revenue-ledger.test.js` - dependency-free Node tests.
- `scripts/demo.js` - CLI demo.
- `docs/issue-20-requirement-map.md` - maps implementation to bounty requirements.

## AI-Assisted Disclosure

This contribution was produced with AI assistance and manually verified with the local commands above.
