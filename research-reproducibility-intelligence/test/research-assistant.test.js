"use strict";

const assert = require("assert");
const sampleProject = require("../data/sample-project.json");
const {
  buildAssistantPacket,
  buildPeerReviewReport,
  buildResearchGapFeed,
  buildReproducibilityReport,
  buildSandboxExecutionPlan,
  buildWorkflowOrchestration,
  evaluateSandboxEvidence,
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
  assert.strictEqual(report.sandboxPlan.network, "disabled");
  assert.strictEqual(report.sandboxPlan.targets[0].target, "analysis.ipynb");
  assert.strictEqual(report.sandboxEvidence.summary.cleanRuns, 1);
  assert.strictEqual(report.sandboxEvidence.summary.consistentOutputs, 1);
  assert.ok(report.checks.find((check) => check.id === "sandbox-evidence-clean").passed);
  assert.ok(report.checks.find((check) => check.id === "reported-output-consistency").passed);
  assert.strictEqual(report.linkedAttempts.length, 2);
  assert.strictEqual(report.linkedAttempts[0].id, "attempt-2026-04-dry-run");
  assert.strictEqual(report.linkedAttempts[0].matchesCurrentArtifacts, true);
  assert.ok(report.checks.find((check) => check.id === "attempt-history-linked").passed);
}

function testSandboxExecutionContract() {
  const plan = buildSandboxExecutionPlan(sampleProject);
  const evidence = evaluateSandboxEvidence(sampleProject, plan);

  assert.strictEqual(plan.image, "python:3.12-slim");
  assert.strictEqual(plan.targets.length, 1);
  assert.ok(plan.targets[0].command.includes("jupyter nbconvert"));
  assert.deepStrictEqual(plan.targets[0].expectedResultIds, ["result-1", "result-2"]);
  assert.strictEqual(evidence.runs[0].status, "passed");
  assert.deepStrictEqual(evidence.runs[0].missingReportedArtifacts, []);
  assert.strictEqual(evidence.summary.missingRuns, 0);
}

function testResearchGapFeed() {
  const gaps = buildResearchGapFeed(sampleProject);

  assert.ok(gaps.length >= 2);
  assert.strictEqual(gaps[0].paperId, "paper-1");
  assert.ok(gaps[0].suggestedDirection.includes("replication-ready"));
}

function testWorkflowOrchestration() {
  const workflow = buildWorkflowOrchestration(sampleProject);

  assert.strictEqual(workflow.projectId, "proj-microbiome-2026");
  assert.strictEqual(workflow.blocked, true);
  assert.ok(workflow.riskScore > 0);
  assert.ok(workflow.orchestrationHash.length > 8);
  assert.ok(workflow.stages.some((stage) => stage.stage === "peer-review"));
  assert.ok(workflow.stages.some((stage) => stage.stage === "reproducibility"));
  assert.ok(workflow.stages.some((stage) => stage.stage === "gap-finder"));

  const topAction = workflow.actions[0];
  assert.strictEqual(topAction.status, "blocking");
  assert.ok(["structure", "claim-evidence"].includes(topAction.source));
  assert.strictEqual(topAction.owner, "Dr. Chen");
  assert.ok(topAction.evidenceHash.length > 8);

  const runbookAction = workflow.actions.find((action) => action.id === "repro-runbook");
  assert.strictEqual(runbookAction.status, "ready");
  assert.strictEqual(runbookAction.owner, "Replication Desk");
  assert.deepStrictEqual(runbookAction.dependsOn, []);

  const gapAction = workflow.actions.find((action) => action.stage === "gap-finder");
  assert.strictEqual(gapAction.owner, "Research Strategy");
  assert.deepStrictEqual(gapAction.dependsOn, ["repro-runbook"]);
}

function testAssistantPacket() {
  const packet = buildAssistantPacket(sampleProject);

  assert.strictEqual(packet.project.domain, "environmental health");
  assert.ok(packet.readinessScore > 0);
  assert.strictEqual(packet.workflow.projectId, "proj-microbiome-2026");
  assert.ok(packet.workflow.orchestrationHash.length > 8);
  assert.ok(packet.nextActions.length >= 4);
  assert.ok(packet.researchGaps[0].priority >= packet.researchGaps.at(-1).priority);
}

testOverlapScore();
testPeerReviewReport();
testReproducibilityReport();
testSandboxExecutionContract();
testResearchGapFeed();
testWorkflowOrchestration();
testAssistantPacket();

console.log("research-reproducibility-intelligence tests passed");
