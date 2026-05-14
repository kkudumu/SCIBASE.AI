"use strict";

const assert = require("assert");
const sample = require("../data/sample-document.json");
const {
  applyOperation,
  applyOperationBatch,
  buildCollaborativeEditorPacket,
  buildReviewDashboard,
  buildScientificFormattingSummary,
  createVersionSnapshot,
  exportPublicationOutline,
  isSectionLocked,
} = require("../src/editor-governance");

function testSectionLocks() {
  assert.strictEqual(isSectionLocked(sample.document, "methods", "u-3"), true);
  assert.strictEqual(isSectionLocked(sample.document, "methods", "u-2"), false);
}

function testApplyOperationRejectsLockedEdit() {
  const result = applyOperation(sample.document, sample.operations[2]);

  assert.strictEqual(result.accepted, false);
  assert.strictEqual(result.reason, "section-locked");
}

function testOperationBatch() {
  const batch = applyOperationBatch(sample.document, sample.operations);

  assert.strictEqual(batch.acceptedCount, 3);
  assert.strictEqual(batch.rejectedCount, 1);
  assert.strictEqual(batch.document.comments.length, 1);
  assert.strictEqual(batch.document.suggestions.length, 1);
  assert.ok(batch.document.blocks.find((block) => block.id === "block-results"));
}

function testSnapshotAndDashboard() {
  const batch = applyOperationBatch(sample.document, sample.operations);
  const snapshot = createVersionSnapshot(batch.document, "test snapshot");
  const dashboard = buildReviewDashboard({ ...batch.document, versions: [snapshot] });

  assert.strictEqual(snapshot.openComments, 1);
  assert.strictEqual(snapshot.pendingSuggestions, 1);
  assert.strictEqual(dashboard.readyForSubmission, false);
  assert.ok(dashboard.sections.find((section) => section.sectionId === "methods").locked);
}

function testPublicationOutline() {
  const batch = applyOperationBatch(sample.document, sample.operations);
  const outline = exportPublicationOutline(batch.document);

  assert.strictEqual(outline.sections.length, 3);
  assert.ok(outline.sections.find((section) => section.sectionId === "results"));
  assert.ok(outline.exportHash.length >= 12);
}

function testScientificFormattingSummary() {
  const summary = buildScientificFormattingSummary(sample.document);

  assert.strictEqual(summary.supportsLatex, true);
  assert.strictEqual(summary.supportsCodeHighlighting, true);
  assert.ok(summary.blockTypes.includes("latex"));
  assert.strictEqual(summary.referenceManager.totalReferences, 1);
  assert.deepStrictEqual(summary.referenceManager.citedKeys, ["smith2026"]);
  assert.deepStrictEqual(summary.referenceManager.unresolvedCitations, []);
  assert.strictEqual(summary.publicationTemplates[0].style, "nature");
}

function testFullPacket() {
  const packet = buildCollaborativeEditorPacket(sample.document, sample.operations);

  assert.strictEqual(packet.operationResults.length, 4);
  assert.strictEqual(packet.document.versions.length, 1);
  assert.strictEqual(packet.dashboard.openTasks.length, 1);
  assert.strictEqual(packet.dashboard.formatting.supportsLatex, true);
  assert.ok(packet.outline.exportHash);
}

testSectionLocks();
testApplyOperationRejectsLockedEdit();
testOperationBatch();
testSnapshotAndDashboard();
testPublicationOutline();
testScientificFormattingSummary();
testFullPacket();

console.log("collaborative-editor-governance tests passed");
