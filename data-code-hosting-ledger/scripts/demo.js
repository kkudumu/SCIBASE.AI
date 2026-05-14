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
      datasetDiff: { added: diff.added.length, changed: diff.changed.length, removed: diff.removed.length },
      packetHash: packet.packetHash,
    },
    null,
    2,
  ),
);
