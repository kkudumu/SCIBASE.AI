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
    nextActions: compliance.failedChecks.map((check) => ({
      checkId: check.id,
      title: check.label,
      remediation: check.remediation,
    })),
  };
}

function packageComplianceExport(workspaceInput) {
  const workspace = normalizeWorkspace(workspaceInput);
  const dashboard = buildAdminDashboard(workspace);
  const events = generateWebhookEvents(workspace);
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
    webhookEvents: events,
    auditSummary,
    evidenceManifest: {
      users: workspace.users.length,
      projects: workspace.projects.length,
      integrations: workspace.integrations.length,
      dataRequests: workspace.dataRequests.length,
      incidents: workspace.incidents.length,
      auditEntries: workspace.auditLog.length,
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
  computeUsageAnalytics,
  evaluateCompliance,
  generateWebhookEvents,
  normalizeWorkspace,
  packageComplianceExport,
  signWebhookEvent,
};
