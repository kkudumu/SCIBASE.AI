"use strict";

const workspace = require("../data/sample-workspace.json");
const { buildHostingPacket, diffDatasetVersions } = require("../src/data-code-hosting-ledger");

const packet = buildHostingPacket(workspace);
const diff = diffDatasetVersions(
  [
    { id: "s1", diversity: 0.7 },
    { id: "s2", diversity: 0.5 },
  ],
  [
    { id: "s1", diversity: 0.72 },
    { id: "s2", diversity: 0.5 },
    { id: "s3", diversity: 0.9 },
  ],
);

console.log(
  JSON.stringify(
    {
      workspace: packet.workspace.title,
      artifacts: packet.manifest.artifacts.length,
      categories: packet.manifest.categories,
      fairScore: packet.fair.total,
      previewKinds: Array.from(new Set(packet.previews.map((preview) => preview.preview))).sort(),
      runtimes: packet.execution.runtimes.map((runtime) => `${runtime.stack}:${runtime.image}`),
      sandboxPolicies: packet.execution.runtimes.map((runtime) => ({
        artifactId: runtime.artifactId,
        isolation: runtime.sandboxPolicy.isolation,
        networkAccess: runtime.sandboxPolicy.networkAccess,
        resourceLimits: runtime.sandboxPolicy.resourceLimits,
      })),
      preservation: {
        identifier: packet.preservation.identifier,
        readyTargets: packet.preservation.depositTargets
          .filter((target) => target.ready)
          .map((target) => target.id),
        packageFiles: packet.preservation.packageFiles.length,
        gateStatus: packet.preservation.requiredGates.map((gate) => `${gate.id}:${gate.passed}`),
      },
      datasetDiff: { added: diff.added.length, changed: diff.changed.length, removed: diff.removed.length },
      packetHash: packet.packetHash,
    },
    null,
    2,
  ),
);
