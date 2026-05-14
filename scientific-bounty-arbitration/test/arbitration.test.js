"use strict";

const assert = require("assert");
const sample = require("../data/sample-bounty.json");
const {
  buildArbitrationRecord,
  buildChallengeLifecycleReport,
  buildMilestoneReleasePlan,
  buildPayoutPlan,
  buildScientificBountyPacket,
  buildSubmissionManifest,
  buildWorkspaceSecuritySummary,
  detectReviewerConflicts,
  scoreSubmission,
  validateChallenge,
} = require("../src/arbitration");

function testChallengeValidation() {
  const validation = validateChallenge(sample.challenge);

  assert.strictEqual(validation.status, "publishable");
  assert.deepStrictEqual(validation.findings, []);
}

function testSubmissionManifest() {
  const manifest = buildSubmissionManifest(sample.challenge, sample.submission);

  assert.strictEqual(manifest.deliverables.length, 4);
  assert.strictEqual(manifest.missingRequired.length, 0);
  assert.ok(manifest.deliverables.find((item) => item.deliverableId === "demo").status === "optional-missing");
  assert.ok(manifest.manifestHash.length >= 16);
  assert.strictEqual(manifest.workspaceSecurity.status, "ready");
  assert.ok(manifest.workspaceSecurity.auditTrailHash.length >= 16);
}

function testWorkspaceSecuritySummary() {
  const summary = buildWorkspaceSecuritySummary(sample.submission);
  const insecure = buildWorkspaceSecuritySummary({ ...sample.submission, workspace: { visibility: "public" }, auditTrail: [] });

  assert.strictEqual(summary.workspaceId, "workspace-submission-riverwatch");
  assert.strictEqual(summary.versionControlRef, "riverwatch/final-submission@7f4c9b2");
  assert.deepStrictEqual(summary.findings, []);
  assert.ok(insecure.findings.includes("workspace-not-private"));
  assert.ok(insecure.findings.includes("audit-trail-empty"));
}

function testReviewerConflicts() {
  const conflicts = detectReviewerConflicts(sample.reviewers, sample.submission, sample.challenge);

  assert.strictEqual(conflicts.filter((reviewer) => reviewer.eligible).length, 2);
  assert.ok(conflicts.find((reviewer) => reviewer.reviewerId === "reviewer-c").conflicts.includes("sponsor-affiliation"));
}

function testScoringIgnoresMissingDeliverablesPenaltyWhenComplete() {
  const eligibleReviews = sample.reviews.filter((review) => review.reviewerId !== "reviewer-c");
  const score = scoreSubmission(sample.challenge, sample.submission, eligibleReviews);

  assert.strictEqual(score.missingPenalty, 0);
  assert.ok(score.finalScore > 80);
  assert.strictEqual(score.rubricScores.length, 4);
}

function testArbitrationRecord() {
  const arbitration = buildArbitrationRecord(
    sample.challenge,
    sample.submission,
    sample.reviewers,
    sample.reviews,
  );

  assert.strictEqual(arbitration.status, "award-recommended");
  assert.deepStrictEqual(arbitration.blockerReasons, []);
  assert.strictEqual(arbitration.reviewerConflicts.filter((reviewer) => !reviewer.eligible).length, 1);
}

function testPayoutPlan() {
  const arbitration = buildArbitrationRecord(
    sample.challenge,
    sample.submission,
    sample.reviewers,
    sample.reviews,
  );
  const payout = buildPayoutPlan(sample.challenge, sample.submission, arbitration);

  assert.strictEqual(payout.status, "ready");
  assert.strictEqual(payout.amount, 1000);
  assert.strictEqual(payout.routes[0].amount, 600);
  assert.strictEqual(payout.routes[1].amount, 400);
  assert.strictEqual(payout.ipTransferStatus, "transfer-after-payout");
}

function testMilestoneReleasePlan() {
  const arbitration = buildArbitrationRecord(
    sample.challenge,
    sample.submission,
    sample.reviewers,
    sample.reviews,
  );
  const payout = buildPayoutPlan(sample.challenge, sample.submission, arbitration);
  const releases = buildMilestoneReleasePlan(sample.challenge, sample.submission, payout);

  assert.strictEqual(releases.length, 2);
  assert.strictEqual(releases[0].amount, 300);
  assert.strictEqual(releases[1].amount, 700);
  assert.strictEqual(releases.every((release) => release.status === "ready-to-release"), true);
  assert.ok(releases[0].evidenceHash.length >= 16);
}

function testChallengeLifecycleReport() {
  const report = buildChallengeLifecycleReport(
    sample.challenge,
    sample.submission,
    sample.reviewers,
    sample.reviews,
  );
  const unfunded = buildChallengeLifecycleReport(
    {
      ...sample.challenge,
      prize: {
        ...sample.challenge.prize,
        escrow: { status: "pending", amount: 0 },
      },
    },
    sample.submission,
    sample.reviewers,
    sample.reviews,
  );

  assert.strictEqual(report.status, "ready-for-release");
  assert.strictEqual(report.gates.every((gate) => gate.status === "pass"), true);
  assert.ok(report.escrowReleaseInstruction.includes("release USD 1000"));
  assert.ok(report.lifecycleHash.length >= 16);
  assert.strictEqual(unfunded.status, "needs-review");
  assert.ok(unfunded.gates.find((gate) => gate.id === "escrow-funded" && gate.status === "review"));
}

function testFullPacket() {
  const packet = buildScientificBountyPacket(
    sample.challenge,
    sample.submission,
    sample.reviewers,
    sample.reviews,
  );

  assert.strictEqual(packet.sponsorSummary.decision, "award-recommended");
  assert.strictEqual(packet.sponsorSummary.missingDeliverables, 0);
  assert.strictEqual(packet.sponsorSummary.lifecycleStatus, "ready-for-release");
  assert.strictEqual(packet.lifecycle.gates.length, 9);
  assert.ok(packet.payout.acceptanceRecordHash.length >= 16);
}

testChallengeValidation();
testSubmissionManifest();
testWorkspaceSecuritySummary();
testReviewerConflicts();
testScoringIgnoresMissingDeliverablesPenaltyWhenComplete();
testArbitrationRecord();
testPayoutPlan();
testMilestoneReleasePlan();
testChallengeLifecycleReport();
testFullPacket();

console.log("scientific-bounty-arbitration tests passed");
