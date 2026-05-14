"use strict";

const crypto = require("crypto");

const DEFAULT_POLICY = {
  minMfaCoverage: 0.9,
  maxOpenCriticalIncidents: 0,
  maxOverdueDataRequests: 0,
  maxWebhookFailureRate: 0.02,
  minAuditLogCoverage: 0.95,
};

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function percent(numerator, denominator) {
  const top = toNumber(numerator);
  const bottom = toNumber(denominator);
  if (bottom <= 0) return 0;
  return Number((top / bottom).toFixed(4));
}

function normalizeWorkspace(workspace) {
  if (!workspace || typeof workspace !== "object") {
    throw new TypeError("workspace must be an object");
  }

  return {
    id: String(workspace.id || "workspace-unknown"),
    name: String(workspace.name || "Unnamed workspace"),
    plan: String(workspace.plan || "enterprise"),
    users: asArray(workspace.users),
    projects: asArray(workspace.projects),
    integrations: asArray(workspace.integrations),
    events: asArray(workspace.events),
    dataRequests: asArray(workspace.dataRequests),
    incidents: asArray(workspace.incidents),
    apiKeys: asArray(workspace.apiKeys),
    auditLog: asArray(workspace.auditLog),
    exportTargets: asArray(workspace.exportTargets),
    procurement: workspace.procurement || {},
  };
}

function buildApiCatalog(workspaceInput) {
  const workspace = normalizeWorkspace(workspaceInput);

  return workspace.integrations.map((integration) => {
    const scopes = asArray(integration.scopes);
    const owners = asArray(integration.owners);
    const activeKeys = workspace.apiKeys.filter(
      (key) => key.integrationId === integration.id && key.status === "active",
    );

    return {
      id: integration.id,
      name: integration.name,
      category: integration.category || "custom",
      scopes,
      owners,
      activeKeyCount: activeKeys.length,
      lastRotatedAt: activeKeys
        .map((key) => key.rotatedAt)
        .filter(Boolean)
        .sort()
        .at(-1) || null,
      risk: integration.risk || (scopes.includes("write:projects") ? "medium" : "low"),
      webhookUrl: integration.webhookUrl || null,
    };
  });
}

function computeUsageAnalytics(workspaceInput) {
  const workspace = normalizeWorkspace(workspaceInput);
  const activeUsers = workspace.users.filter((user) => user.status === "active");
  const mfaUsers = activeUsers.filter((user) => user.mfaEnabled);
  const auditCoveredProjects = workspace.projects.filter((project) => project.auditLogEnabled);
  const deliveredWebhooks = workspace.events.filter((event) => event.status === "delivered");
  const failedWebhooks = workspace.events.filter((event) => event.status === "failed");
  const criticalIncidents = workspace.incidents.filter(
    (incident) => incident.severity === "critical" && incident.status !== "resolved",
  );
  const overdueRequests = workspace.dataRequests.filter((request) => request.status === "overdue");

  return {
    activeUsers: activeUsers.length,
    totalProjects: workspace.projects.length,
    mfaCoverage: percent(mfaUsers.length, activeUsers.length),
    auditLogCoverage: percent(auditCoveredProjects.length, workspace.projects.length),
    webhookDeliveryRate: percent(deliveredWebhooks.length, workspace.events.length),
    webhookFailureRate: percent(failedWebhooks.length, workspace.events.length),
    openCriticalIncidents: criticalIncidents.length,
    overdueDataRequests: overdueRequests.length,
    apiIntegrations: workspace.integrations.length,
  };
}

function buildExportPipelineCatalog(workspaceInput) {
  const workspace = normalizeWorkspace(workspaceInput);
  const defaultTargets = [
    {
      id: "zenodo",
      name: "Zenodo deposition",
      category: "indexed-repository",
      formats: ["datacite-json", "archive-zip"],
      requiredFields: ["doi", "license", "versionHistory"],
    },
    {
      id: "journal-submission",
      name: "Journal submission package",
      category: "journal",
      formats: ["jats", "docx", "latex"],
      requiredFields: ["doi", "orcid", "license"],
    },
    {
      id: "funder-portal",
      name: "Funder compliance report",
      category: "grant-portal",
      formats: ["grant-report-json", "csv"],
      requiredFields: ["grantId", "openAccessStatus"],
    },
  ];
  const targets = workspace.exportTargets.length ? workspace.exportTargets : defaultTargets;

  return targets.map((target) => {
    const requiredFields = asArray(target.requiredFields);
    const projects = workspace.projects.map((project) => {
      const exportMetadata = project.exportMetadata || {};
      const missingFields = requiredFields.filter((field) => !exportMetadata[field]);
      return {
        projectId: project.id,
        title: project.title,
        ready: missingFields.length === 0,
        missingFields,
      };
    });

    return {
      id: target.id,
      name: target.name,
      category: target.category || "custom",
      formats: asArray(target.formats),
      requiredFields,
      route: `/enterprise/${workspace.id}/exports/${target.id}`,
      readyProjectIds: projects.filter((project) => project.ready).map((project) => project.projectId),
      blockedProjects: projects.filter((project) => !project.ready),
      preservedIdentifiers: ["doi", "orcid", "citationIds", "versionHistory"].filter((field) =>
        requiredFields.includes(field) || asArray(target.preservedIdentifiers).includes(field),
      ),
    };
  });
}

function evaluateCompliance(workspaceInput, policyInput = {}) {
  const policy = { ...DEFAULT_POLICY, ...policyInput };
  const analytics = computeUsageAnalytics(workspaceInput);
  const checks = [
    {
      id: "mfa-coverage",
      label: "MFA coverage",
      value: analytics.mfaCoverage,
      threshold: policy.minMfaCoverage,
      passed: analytics.mfaCoverage >= policy.minMfaCoverage,
      remediation: "Require MFA for remaining active users before renewing institutional access.",
    },
    {
      id: "critical-incidents",
      label: "Open critical incidents",
      value: analytics.openCriticalIncidents,
      threshold: policy.maxOpenCriticalIncidents,
      passed: analytics.openCriticalIncidents <= policy.maxOpenCriticalIncidents,
      remediation: "Resolve or formally risk-accept critical incidents before export approval.",
    },
    {
      id: "data-requests",
      label: "Overdue data requests",
      value: analytics.overdueDataRequests,
      threshold: policy.maxOverdueDataRequests,
      passed: analytics.overdueDataRequests <= policy.maxOverdueDataRequests,
      remediation: "Close overdue privacy and data export requests with audit notes.",
    },
    {
      id: "webhook-failures",
      label: "Webhook failure rate",
      value: analytics.webhookFailureRate,
      threshold: policy.maxWebhookFailureRate,
      passed: analytics.webhookFailureRate <= policy.maxWebhookFailureRate,
      remediation: "Rotate webhook credentials or disable unhealthy endpoints.",
    },
    {
      id: "audit-log-coverage",
      label: "Project audit log coverage",
      value: analytics.auditLogCoverage,
      threshold: policy.minAuditLogCoverage,
      passed: analytics.auditLogCoverage >= policy.minAuditLogCoverage,
      remediation: "Enable immutable audit logging on projects that host manuscripts or datasets.",
    },
  ];

  const failed = checks.filter((check) => !check.passed);

  return {
    status: failed.length === 0 ? "pass" : failed.length <= 2 ? "needs-attention" : "blocked",
    checks,
    failedChecks: failed,
  };
}

function generateWebhookEvents(workspaceInput) {
  const workspace = normalizeWorkspace(workspaceInput);
  const compliance = evaluateCompliance(workspace);
  const apiCatalog = buildApiCatalog(workspace);

  return [
    {
      type: "trust_center.compliance_evaluated",
      workspaceId: workspace.id,
      payload: {
        status: compliance.status,
        failedCheckIds: compliance.failedChecks.map((check) => check.id),
      },
    },
    ...apiCatalog
      .filter((integration) => integration.webhookUrl)
      .map((integration) => ({
        type: "trust_center.integration_ready",
        workspaceId: workspace.id,
        target: integration.webhookUrl,
        payload: {
          integrationId: integration.id,
          scopes: integration.scopes,
          risk: integration.risk,
        },
      })),
  ];
}

function signWebhookEvent(event, secret) {
  if (!secret) {
    throw new Error("secret is required to sign webhook events");
  }
  const body = JSON.stringify(event);
  const signature = crypto.createHmac("sha256", secret).update(body).digest("hex");
  return {
    ...event,
    body,
    signature: `sha256=${signature}`,
  };
}

function buildAdminDashboard(workspaceInput) {
  const workspace = normalizeWorkspace(workspaceInput);
  const analytics = computeUsageAnalytics(workspace);
  const compliance = evaluateCompliance(workspace);
  const apiCatalog = buildApiCatalog(workspace);
  const exportPipelines = buildExportPipelineCatalog(workspace);
  const procurement = buildProcurementReadinessReport(workspace);

  return {
    workspace: {
      id: workspace.id,
      name: workspace.name,
      plan: workspace.plan,
    },
    headline: {
      status: compliance.status,
      activeUsers: analytics.activeUsers,
      totalProjects: analytics.totalProjects,
      apiIntegrations: analytics.apiIntegrations,
    },
    analytics,
    compliance,
    integrations: apiCatalog,
    exportPipelines,
    procurement,
    nextActions: compliance.failedChecks.map((check) => ({
      checkId: check.id,
      title: check.label,
      remediation: check.remediation,
    })),
  };
}

function buildProcurementReadinessReport(workspaceInput) {
  const workspace = normalizeWorkspace(workspaceInput);
  const analytics = computeUsageAnalytics(workspace);
  const apiCatalog = buildApiCatalog(workspace);
  const exportPipelines = buildExportPipelineCatalog(workspace);
  const evidence = workspace.procurement.evidence || {};
  const requirements = {
    samlConfigured: Boolean(evidence.samlConfigured),
    dpaSigned: Boolean(evidence.dpaSigned),
    securityQuestionnaireComplete: Boolean(evidence.securityQuestionnaireComplete),
    slaHours: Number(evidence.slaHours || 0),
    auditLogCoverage: analytics.auditLogCoverage,
    webhookFailureRate: analytics.webhookFailureRate,
    activeKeyRotationDaysMax: Number(evidence.activeKeyRotationDaysMax || 90),
    exportTargetsReady: exportPipelines.every((pipeline) => pipeline.blockedProjects.length === 0),
  };
  const staleKeys = apiCatalog.filter((integration) => {
    if (!integration.lastRotatedAt) return true;
    const rotatedAt = new Date(integration.lastRotatedAt);
    if (Number.isNaN(rotatedAt.getTime())) return true;
    const asOf = workspace.procurement.asOf ? new Date(workspace.procurement.asOf) : new Date();
    const ageDays = Math.floor((asOf.getTime() - rotatedAt.getTime()) / (1000 * 60 * 60 * 24));
    return ageDays > requirements.activeKeyRotationDaysMax;
  });
  const blockers = [];
  if (!requirements.samlConfigured) blockers.push("saml-not-configured");
  if (!requirements.dpaSigned) blockers.push("dpa-not-signed");
  if (!requirements.securityQuestionnaireComplete) blockers.push("security-questionnaire-incomplete");
  if (requirements.slaHours > 24 || requirements.slaHours <= 0) blockers.push("sla-missing-or-too-slow");
  if (requirements.auditLogCoverage < DEFAULT_POLICY.minAuditLogCoverage) blockers.push("audit-log-coverage-low");
  if (requirements.webhookFailureRate > DEFAULT_POLICY.maxWebhookFailureRate) blockers.push("webhook-failure-rate-high");
  if (staleKeys.length) blockers.push("api-key-rotation-stale");
  if (!requirements.exportTargetsReady) blockers.push("export-pipeline-metadata-incomplete");

  return {
    status: blockers.length ? "blocked" : "ready-for-procurement-review",
    buyer: workspace.procurement.buyer || null,
    renewalDate: workspace.procurement.renewalDate || null,
    requirements,
    staleIntegrations: staleKeys.map((integration) => integration.id),
    blockers,
    approvalRoute: `/enterprise/${workspace.id}/procurement/approve`,
    procurementHash: crypto
      .createHash("sha256")
      .update(JSON.stringify({ workspaceId: workspace.id, requirements, blockers }))
      .digest("hex")
      .slice(0, 18),
  };
}

function packageComplianceExport(workspaceInput) {
  const workspace = normalizeWorkspace(workspaceInput);
  const dashboard = buildAdminDashboard(workspace);
  const events = generateWebhookEvents(workspace);
  const exportPipelines = buildExportPipelineCatalog(workspace);
  const auditSummary = workspace.auditLog.reduce((summary, entry) => {
    const action = entry.action || "unknown";
    summary[action] = (summary[action] || 0) + 1;
    return summary;
  }, {});

  return {
    exportId: `${workspace.id}-trust-center-${new Date().toISOString().slice(0, 10)}`,
    generatedAt: new Date().toISOString(),
    workspace: dashboard.workspace,
    complianceStatus: dashboard.compliance.status,
    dashboard,
    exportPipelines,
    webhookEvents: events,
    auditSummary,
    evidenceManifest: {
      users: workspace.users.length,
      projects: workspace.projects.length,
      integrations: workspace.integrations.length,
      dataRequests: workspace.dataRequests.length,
      incidents: workspace.incidents.length,
      auditEntries: workspace.auditLog.length,
      exportTargets: exportPipelines.length,
      procurementStatus: dashboard.procurement.status,
    },
  };
}

function buildEnterpriseTrustCenter(workspaceInput, options = {}) {
  const workspace = normalizeWorkspace(workspaceInput);
  const dashboard = buildAdminDashboard(workspace);
  const complianceExport = packageComplianceExport(workspace);
  const signedWebhookEvents = generateWebhookEvents(workspace).map((event) =>
    options.webhookSecret ? signWebhookEvent(event, options.webhookSecret) : event,
  );

  return {
    dashboard,
    complianceExport,
    signedWebhookEvents,
  };
}

module.exports = {
  DEFAULT_POLICY,
  buildAdminDashboard,
  buildApiCatalog,
  buildEnterpriseTrustCenter,
  buildExportPipelineCatalog,
  buildProcurementReadinessReport,
  computeUsageAnalytics,
  evaluateCompliance,
  generateWebhookEvents,
  normalizeWorkspace,
  packageComplianceExport,
  signWebhookEvent,
};
