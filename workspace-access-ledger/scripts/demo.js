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
      allowedCount: packet.allowedCount,
      deniedCount: packet.deniedCount,
      decisions: packet.decisions,
      dashboardHash: packet.dashboard.dashboardHash,
    },
    null,
    2,
  ),
);
