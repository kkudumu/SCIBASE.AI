# Enterprise Trust Center

Self-contained enterprise tooling milestone for [SCIBASE.AI issue #19](https://github.com/SCIBASE-AI/SCIBASE.AI/issues/19).

The module gives institutional administrators a deterministic trust-center workflow for compliance analytics, secure API cataloging, webhook events, and audit-ready exports. It is credential-free and uses only Node.js built-ins so reviewers can run it locally without setup friction.

## What It Adds

- Admin dashboard summary for workspace status, active users, projects, integrations, and next actions.
- Compliance analytics for MFA coverage, audit-log coverage, webhook health, open incidents, and overdue data requests.
- Secure API catalog showing integration scopes, owners, active key counts, rotation timestamps, risk, and webhook endpoints.
- HMAC-signed trust-center webhook events.
- Export pipeline catalog for repositories, journal submission packages, and funder portals with required metadata checks.
- Compliance export bundle with evidence manifest and audit summary.
- Sample workspace data, tests, and a deterministic CLI demo.

## Run

```bash
cd enterprise-trust-center
npm run check
npm test
npm run demo
```

Expected demo shape:

```json
{
  "workspace": "Borealis Research Institute",
  "status": "blocked",
  "activeUsers": 3,
  "integrations": 2,
  "exportPipelines": [
    {
      "id": "journal-submission",
      "formats": ["jats", "docx", "latex"],
      "readyProjects": 1,
      "blockedProjects": 2
    }
  ],
  "nextActions": [
    {
      "checkId": "mfa-coverage",
      "title": "MFA coverage",
      "remediation": "Require MFA for remaining active users before renewing institutional access."
    }
  ],
  "firstSignedWebhook": {
    "type": "trust_center.compliance_evaluated",
    "signature": "sha256=..."
  }
}
```

## Demo Artifact

See [docs/demo.gif](docs/demo.gif) for a short visual walkthrough of the dashboard, export, and signed webhook flow. The SVG source is also included at [docs/demo.svg](docs/demo.svg).

## Files

- `src/trust-center.js` - core enterprise trust-center functions, including export pipeline readiness checks.
- `data/sample-workspace.json` - reviewable institutional workspace fixture.
- `test/trust-center.test.js` - dependency-free Node assertions.
- `scripts/demo.js` - CLI demo for reviewer smoke testing.
- `docs/issue-19-requirement-map.md` - maps the implementation to the bounty requirements.

## AI-Assisted Disclosure

This contribution was produced with AI assistance and manually verified with the local commands above.
