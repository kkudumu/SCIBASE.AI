"use strict";

const assert = require("assert");
const sampleWorkspace = require("../data/sample-workspace.json");
const {
  buildAdminDashboard,
  buildApiCatalog,
  buildEnterpriseTrustCenter,
  buildExportPipelineCatalog,
  buildProcurementReadinessReport,
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

function testExportPipelineCatalog() {
  const pipelines = buildExportPipelineCatalog(sampleWorkspace);
  const journal = pipelines.find((pipeline) => pipeline.id === "journal-submission");

  assert.strictEqual(pipelines.length, 3);
  assert.ok(journal.formats.includes("jats"));
  assert.ok(journal.formats.includes("docx"));
  assert.ok(journal.formats.includes("latex"));
  assert.deepStrictEqual(journal.readyProjectIds, ["p-101"]);
  assert.ok(journal.blockedProjects.some((project) => project.projectId === "p-102" && project.missingFields.includes("orcid")));
  assert.ok(journal.preservedIdentifiers.includes("doi"));
}

function testDashboardAndExport() {
  const dashboard = buildAdminDashboard(sampleWorkspace);
  const complianceExport = packageComplianceExport(sampleWorkspace);

  assert.strictEqual(dashboard.workspace.id, "inst-borealis");
  assert.strictEqual(dashboard.exportPipelines.length, 3);
  assert.strictEqual(dashboard.nextActions.length, 4);
  assert.strictEqual(complianceExport.complianceStatus, "blocked");
  assert.strictEqual(complianceExport.evidenceManifest.exportTargets, 3);
  assert.strictEqual(complianceExport.evidenceManifest.procurementStatus, "blocked");
  assert.strictEqual(complianceExport.evidenceManifest.auditEntries, 3);
  assert.strictEqual(complianceExport.auditSummary["integration.connected"], 1);
}

function testProcurementReadiness() {
  const report = buildProcurementReadinessReport(sampleWorkspace);
  const ready = buildProcurementReadinessReport({
    ...sampleWorkspace,
    projects: sampleWorkspace.projects.map((project) => ({
      ...project,
      auditLogEnabled: true,
      exportMetadata: {
        doi: project.exportMetadata.doi || "10.5555/ready",
        orcid: project.exportMetadata.orcid || "0000-0000-0000-0000",
        license: project.exportMetadata.license || "CC-BY-4.0",
        versionHistory: project.exportMetadata.versionHistory || true,
        grantId: project.exportMetadata.grantId || "GRANT-READY",
        openAccessStatus: "compliant",
      },
    })),
    events: sampleWorkspace.events.map((event) => ({ ...event, status: "delivered" })),
    procurement: {
      ...sampleWorkspace.procurement,
      evidence: {
        samlConfigured: true,
        dpaSigned: true,
        securityQuestionnaireComplete: true,
        slaHours: 12,
        activeKeyRotationDaysMax: 90,
      },
    },
  });

  assert.strictEqual(report.status, "blocked");
  assert.ok(report.blockers.includes("webhook-failure-rate-high"));
  assert.ok(report.blockers.includes("export-pipeline-metadata-incomplete"));
  assert.ok(report.approvalRoute.includes("/procurement/approve"));
  assert.strictEqual(ready.status, "ready-for-procurement-review");
  assert.deepStrictEqual(ready.blockers, []);
  assert.ok(ready.procurementHash.length >= 12);
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
testExportPipelineCatalog();
testDashboardAndExport();
testProcurementReadiness();
testWebhookSigning();
testFullBuild();

console.log("enterprise-trust-center tests passed");
