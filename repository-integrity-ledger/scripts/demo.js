"use strict";

const repository = require("../data/sample-repository.json");
const { buildRepositoryIntegrityPacket } = require("../src/repository-ledger");

const packet = buildRepositoryIntegrityPacket(repository);

console.log(
  JSON.stringify(
    {
      repository: packet.repository.title,
      missingComponents: packet.manifest.missingRequiredKinds,
      lfsComponents: packet.manifest.components.filter((component) => component.lfs).map((component) => component.path),
      reproducibility: packet.reproducibility.status,
      mergeableRequests: packet.mergeRequests.filter((request) => request.mergeable).length,
      editorModes: packet.editorDiff.componentEditors.map((item) => item.editorMode),
      rollbackCommand: packet.editorDiff.rollbackTimeline.at(-1).rollbackCommand,
      releaseReadiness: {
        status: packet.releaseReadiness.status,
        gates: packet.releaseReadiness.gates.map((gate) => ({
          id: gate.id,
          status: gate.status,
        })),
        datasetDiffRisk: {
          highRiskCount: packet.releaseReadiness.datasetDiffs.highRiskCount,
          mediumRiskCount: packet.releaseReadiness.datasetDiffs.mediumRiskCount,
        },
        releaseHash: packet.releaseReadiness.releaseHash,
      },
      citation: packet.citations.apa,
      bundleHash: packet.exportBundle.bundleHash,
    },
    null,
    2,
  ),
);
