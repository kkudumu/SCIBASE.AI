"use strict";

const sample = require("../data/sample-workspace.json");
const { buildWorkspaceAccessPacket } = require("../src/access-ledger");

const packet = buildWorkspaceAccessPacket(
  sample.workspace,
  sample.activityByUser,
  sample.accessRequests,
);

console.log(
  JSON.stringify(
    {
      workspace: packet.dashboard.workspace.name,
      identitySummary: packet.dashboard.identitySummary,
      identitySecurity: packet.dashboard.identitySecurity,
      lifecycle: {
        activeProjects: packet.dashboard.lifecycle.activeProjects,
        archivedProjects: packet.dashboard.lifecycle.archivedProjects,
        incompleteProjects: packet.dashboard.lifecycle.incompleteProjects,
        invitationStatuses: packet.dashboard.lifecycle.invitationReview.map((invitation) => ({
          invitationId: invitation.invitationId,
          status: invitation.status,
          risk: invitation.risk,
        })),
      },
      onboarding: {
        readyCount: packet.dashboard.onboarding.readyCount,
        blockedCount: packet.dashboard.onboarding.blockedCount,
        plans: packet.dashboard.onboarding.plans.map((plan) => ({
          invitationId: plan.invitationId,
          status: plan.status,
          requiredProviders: plan.requiredProviders,
          mfaRequired: plan.mfaRequired,
          blockers: plan.blockers,
          acceptanceRoute: plan.acceptanceRoute,
        })),
      },
      allowedCount: packet.allowedCount,
      deniedCount: packet.deniedCount,
      decisions: packet.decisions,
      dashboardHash: packet.dashboard.dashboardHash,
    },
    null,
    2,
  ),
);
