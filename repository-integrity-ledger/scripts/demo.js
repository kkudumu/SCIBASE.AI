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
      citation: packet.citations.apa,
      bundleHash: packet.exportBundle.bundleHash,
    },
    null,
    2,
  ),
);
