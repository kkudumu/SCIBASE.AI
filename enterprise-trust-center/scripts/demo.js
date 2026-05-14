"use strict";

const path = require("path");
const sampleWorkspace = require(path.join("..", "data", "sample-workspace.json"));
const { buildEnterpriseTrustCenter } = require("../src/trust-center");

const trustCenter = buildEnterpriseTrustCenter(sampleWorkspace, {
  webhookSecret: "demo-secret",
});

const summary = {
  workspace: trustCenter.dashboard.workspace.name,
  status: trustCenter.dashboard.headline.status,
  activeUsers: trustCenter.dashboard.headline.activeUsers,
  integrations: trustCenter.dashboard.headline.apiIntegrations,
  exportPipelines: trustCenter.dashboard.exportPipelines.map((pipeline) => ({
    id: pipeline.id,
    formats: pipeline.formats,
    readyProjects: pipeline.readyProjectIds.length,
    blockedProjects: pipeline.blockedProjects.length,
  })),
  procurement: {
    status: trustCenter.dashboard.procurement.status,
    buyer: trustCenter.dashboard.procurement.buyer,
    blockers: trustCenter.dashboard.procurement.blockers,
    approvalRoute: trustCenter.dashboard.procurement.approvalRoute,
  },
  nextActions: trustCenter.dashboard.nextActions,
  firstSignedWebhook: {
    type: trustCenter.signedWebhookEvents[0].type,
    signature: trustCenter.signedWebhookEvents[0].signature.slice(0, 24) + "...",
  },
  exportId: trustCenter.complianceExport.exportId,
};

console.log(JSON.stringify(summary, null, 2));
