"use strict";

const assert = require("assert");
const repository = require("../data/sample-repository.json");
const {
  buildComponentManifest,
  buildEditorDiffSummary,
  buildExportBundle,
  buildForkRecord,
  buildRepositoryIntegrityPacket,
  createCommit,
  createSemanticTag,
  evaluateMergeRequest,
  evaluateReproducibility,
  generateCitation,
} = require("../src/repository-ledger");

function testComponentManifest() {
  const manifest = buildComponentManifest(repository);

  assert.deepStrictEqual(manifest.missingRequiredKinds, []);
  assert.strictEqual(manifest.components.find((component) => component.kind === "data").lfs, true);
  assert.ok(manifest.manifestHash.length >= 12);
}

function testCommitAndTag() {
  const withCommit = createCommit(repository, {
    authorId: "u-owner",
    message: "Add DataCite metadata",
    changedComponents: ["c-metadata"],
    createdAt: "2026-05-08T00:00:00Z",
  });
  const withTag = createSemanticTag(withCommit, {
    version: "v1.1.0",
    commitId: withCommit.commits.at(-1).id,
    doi: "10.5555/scibase.flood.microbiome.v1.1",
  });

  assert.strictEqual(withCommit.commits.length, repository.commits.length + 1);
  assert.strictEqual(withTag.tags.at(-1).version, "v1.1.0");
  assert.ok(withTag.tags.at(-1).tagHash);
}

function testForkRecord() {
  const fork = buildForkRecord(repository, {
    id: "fork-2",
    forkRepositoryId: "repo-reanalysis",
    createdBy: "u-reviewer",
  });

  assert.strictEqual(fork.sourceRepositoryId, repository.id);
  assert.strictEqual(fork.attribution.sourceDoi, repository.metadata.doi);
  assert.ok(fork.forkHash);
}

function testMergeRequestAndReproducibility() {
  const merge = evaluateMergeRequest(repository, repository.mergeRequests[0]);
  const reproducibility = evaluateReproducibility(repository);
  const emptyChecks = evaluateReproducibility({
    ...repository,
    reproducibilityRuns: [{ id: "run-empty", environment: "docker://node:22", checks: [] }],
  });

  assert.strictEqual(merge.mergeable, true);
  assert.strictEqual(merge.approvals, 1);
  assert.strictEqual(reproducibility.status, "passed");
  assert.strictEqual(reproducibility.passRate, 1);
  assert.strictEqual(emptyChecks.status, "missing");
  assert.strictEqual(emptyChecks.passRate, 0);
}

function testCitationAndExport() {
  const citation = generateCitation(repository, "preprint-v1", "apa");
  const bibtex = generateCitation(repository, "preprint-v1", "bibtex");
  const bundle = buildExportBundle(repository, "preprint-v1");

  assert.ok(citation.includes("Coastal flooding microbiome atlas"));
  assert.ok(bibtex.startsWith("@misc"));
  assert.ok(bundle.apiRoutes.length >= 4);
  assert.ok(bundle.bundleHash.length >= 12);
}

function testEditorDiffSummary() {
  const summary = buildEditorDiffSummary(repository);
  const dataEditor = summary.componentEditors.find((item) => item.componentId === "c-data");
  const codeEditor = summary.componentEditors.find((item) => item.componentId === "c-code");

  assert.strictEqual(dataEditor.editorMode, "structured-data");
  assert.strictEqual(dataEditor.diffMode, "rich-data-diff");
  assert.strictEqual(codeEditor.diffMode, "code-aware-diff");
  assert.strictEqual(summary.mergeRequestDiffs[0].changedComponents[0].diffMode, "code-aware-diff");
  assert.ok(summary.rollbackTimeline[0].rollbackCommand.includes("scibase restore"));
  assert.ok(summary.summaryHash.length >= 12);
}

function testFullPacket() {
  const packet = buildRepositoryIntegrityPacket(repository);

  assert.strictEqual(packet.repository.id, repository.id);
  assert.strictEqual(packet.mergeRequests[0].mergeable, true);
  assert.ok(packet.editorDiff.componentEditors.length >= 7);
  assert.ok(packet.citations.apa);
  assert.ok(packet.exportBundle.bundleHash);
}

testComponentManifest();
testCommitAndTag();
testForkRecord();
testMergeRequestAndReproducibility();
testCitationAndExport();
testEditorDiffSummary();
testFullPacket();

console.log("repository-integrity-ledger tests passed");
