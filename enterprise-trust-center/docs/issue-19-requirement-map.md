# Issue #19 Requirement Map

This module is a focused milestone for SCIBASE issue #19, Enterprise Tooling. It avoids external credentials and keeps all behavior deterministic for review.

| Issue requirement | Implementation |
| --- | --- |
| Institutional admin dashboards | `buildAdminDashboard()` produces workspace headline metrics, risk status, compliance checks, integrations, and next actions. |
| Contributor, usage, and compliance analytics | `computeUsageAnalytics()` derives MFA coverage, audit-log coverage, webhook health, incidents, data requests, project totals, and integration counts. |
| Secure API catalog | `buildApiCatalog()` lists connected integrations, scopes, owners, key rotation status, risk, and webhook endpoints. |
| Webhooks | `generateWebhookEvents()` creates trust-center events and `signWebhookEvent()` signs payloads with HMAC SHA-256. |
| Export pipelines | `buildExportPipelineCatalog()` models repository, journal, and funder-portal targets with formats, required metadata, ready projects, blocked projects, and preserved identifiers. `packageComplianceExport()` includes that catalog in the audit-ready export bundle. |
| Reviewer-friendly demo | `npm run demo` prints a deterministic trust-center summary from `data/sample-workspace.json`. |
| Local verification | `npm run check` and `npm test` validate syntax and behavior without network calls. |

## Review Notes

- The module is isolated under `enterprise-trust-center/`.
- It uses only Node.js built-ins.
- It is designed as a mergeable enterprise-tooling slice rather than a placeholder integration.
- The compliance policy is intentionally configurable through `evaluateCompliance(workspace, policy)`.
