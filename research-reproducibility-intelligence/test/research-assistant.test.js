"use strict";

const assert = require("assert");
const sampleProject = require("../data/sample-project.json");
const {
  buildAssistantPacket,
  buildPeerReviewReport,
  buildResearchGapFeed,
  buildReproducibilityReport,
  overlapScore,
} = require("../src/research-assistant");

function testOverlapScore() {
  assert.ok(overlapScore("microbiome flooding exposure", "flooding microbiome study") > 0.4);
  assert.strictEqual(overlapScore("", "anything"), 0);
}

function testPeerReviewReport() {
  const report = buildPeerReviewReport(sampleProject);

  assert.strictEqual(report.projectId, "proj-microbiome-2026");
  assert.ok(report.score < 100);
  assert.ok(report.missingSections.includes("data availability"));
  assert.ok(report.findings.some((finding) => finding.type === "claim-evidence"));
  assert.ok(report.claimAlignment.some((claim) => claim.status === "supported"));
}

function testReproducibilityReport() {
  const report = buildReproducibilityReport(sampleProject);

  assert.strictEqual(report.status, "reproducible");
  assert.strictEqual(report.confidenceScore, 1);
  assert.ok(report.artifactFingerprint.length > 8);
  assert.ok(report.runnableFiles.includes("analysis.ipynb"));
  assert.strictEqual(report.linkedAttempts.length, 2);
  assert.strictEqual(report.linkedAttempts[0].id, "attempt-2026-04-dry-run");
  assert.strictEqual(report.linkedAttempts[0].matchesCurrentArtifacts, true);
  assert.ok(report.checks.find((check) => check.id === "attempt-history-linked").passed);
}

function testResearchGapFeed() {
  const gaps = buildResearchGapFeed(sampleProject);

  assert.ok(gaps.length >= 2);
  assert.strictEqual(gaps[0].paperId, "paper-1");
  assert.ok(gaps[0].suggestedDirection.includes("replication-ready"));
}

function testAssistantPacket() {
  const packet = buildAssistantPacket(sampleProject);

  assert.strictEqual(packet.project.domain, "environmental health");
  assert.ok(packet.readinessScore > 0);
  assert.ok(packet.nextActions.length >= 4);
  assert.ok(packet.researchGaps[0].priority >= packet.researchGaps.at(-1).priority);
}

testOverlapScore();
testPeerReviewReport();
testReproducibilityReport();
testResearchGapFeed();
testAssistantPacket();

console.log("research-reproducibility-intelligence tests passed");
