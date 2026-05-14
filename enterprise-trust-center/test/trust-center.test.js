"use strict";

const assert = require("assert");
const sampleWorkspace = require("../data/sample-workspace.json");
const {
  buildAdminDashboard,
  buildApiCatalog,
  buildEnterpriseTrustCenter,
  computeUsageAnalytics,
  evaluateCompliance,
  packageComplianceExport,
  signWebhookEvent,
} = require("../src/trust-center");

function testAnalytics() {
  const analytics = computeUsageAnalytics(sampleWorkspace);

  assert.strictEqual(analytics.activeUsers, 3);
  assert.strictEqual(analytics.totalProjects, 3);
  assert.strictEqual(analytics.mfaCoverage, 0.6667);
  assert.strictEqual(analytics.auditLogCoverage, 0.6667);
  assert.strictEqual(analytics.webhookFailureRate, 0.3333);
  assert.strictEqual(analytics.openCriticalIncidents, 0);
  assert.strictEqual(analytics.overdueDataRequests, 1);
}

function testCompliance() {
  const compliance = evaluateCompliance(sampleWorkspace);

  assert.strictEqual(compliance.status, "blocked");
  assert.deepStrictEqual(
    compliance.failedChecks.map((check) => check.id),
    ["mfa-coverage", "data-requests", "webhook-failures", "audit-log-coverage"],
  );
}

function testApiCatalog() {
  const catalog = buildApiCatalog(sampleWorkspace);

  assert.strictEqual(catalog.length, 2);
  assert.strictEqual(catalog[0].activeKeyCount, 1);
  assert.strictEqual(catalog[1].risk, "medium");
  assert.ok(catalog[1].scopes.includes("write:projects"));
}

function testDashboardAndExport() {
  const dashboard = buildAdminDashboard(sampleWorkspace);
  const complianceExport = packageComplianceExport(sampleWorkspace);

  assert.strictEqual(dashboard.workspace.id, "inst-borealis");
  assert.strictEqual(dashboard.nextActions.length, 4);
  assert.strictEqual(complianceExport.complianceStatus, "blocked");
  assert.strictEqual(complianceExport.evidenceManifest.auditEntries, 3);
  assert.strictEqual(complianceExport.auditSummary["integration.connected"], 1);
}

function testWebhookSigning() {
  const event = {
    type: "trust_center.test",
    workspaceId: "inst-borealis",
    payload: { ok: true },
  };
  const signed = signWebhookEvent(event, "secret");

  assert.ok(signed.body.includes("trust_center.test"));
  assert.match(signed.signature, /^sha256=[a-f0-9]{64}$/);
}

function testFullBuild() {
  const trustCenter = buildEnterpriseTrustCenter(sampleWorkspace, {
    webhookSecret: "secret",
  });

  assert.strictEqual(trustCenter.dashboard.headline.status, "blocked");
  assert.ok(trustCenter.complianceExport.exportId.startsWith("inst-borealis-trust-center"));
  assert.ok(trustCenter.signedWebhookEvents.length >= 2);
  assert.match(trustCenter.signedWebhookEvents[0].signature, /^sha256=/);
}

testAnalytics();
testCompliance();
testApiCatalog();
testDashboardAndExport();
testWebhookSigning();
testFullBuild();

console.log("enterprise-trust-center tests passed");
