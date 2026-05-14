"use strict";

const crypto = require("crypto");

const REQUIRED_CHALLENGE_FIELDS = [
  "problemDescription",
  "scientificContext",
  "deliverables",
  "rubric",
  "timeline",
  "prize",
  "ipPolicy",
];

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function hashRecord(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 20);
}

function normalizeChallenge(challenge) {
  if (!challenge || typeof challenge !== "object") {
    throw new TypeError("challenge must be an object");
  }

  return {
    id: challenge.id || "challenge-unknown",
    title: challenge.title || "Untitled scientific challenge",
    sponsorId: challenge.sponsorId || "sponsor-unknown",
    problemDescription: challenge.problemDescription || "",
    scientificContext: challenge.scientificContext || "",
    deliverables: asArray(challenge.deliverables),
    rubric: asArray(challenge.rubric),
    timeline: challenge.timeline || {},
    prize: challenge.prize || {},
    ipPolicy: challenge.ipPolicy || {},
    participation: challenge.participation || { visibility: "public" },
  };
}

function validateChallenge(challengeInput) {
  const challenge = normalizeChallenge(challengeInput);
  const missingFields = REQUIRED_CHALLENGE_FIELDS.filter((field) => {
    const value = challenge[field];
    return Array.isArray(value) ? value.length === 0 : !value || Object.keys(value).length === 0;
  });
  const rubricWeight = challenge.rubric.reduce((sum, item) => sum + Number(item.weight || 0), 0);
  const deliverableIds = new Set(challenge.deliverables.map((deliverable) => deliverable.id));
  const rubricWithoutDeliverable = challenge.rubric.filter(
    (item) => item.deliverableId && !deliverableIds.has(item.deliverableId),
  );

  const findings = [
    ...missingFields.map((field) => ({
      type: "missing-field",
      severity: "high",
      field,
      message: `${field} is required before publishing the challenge.`,
    })),
    ...(Math.round(rubricWeight) !== 100
      ? [
          {
            type: "rubric-weight",
            severity: "high",
            field: "rubric",
            message: `Rubric weights must total 100; received ${rubricWeight}.`,
          },
        ]
      : []),
    ...rubricWithoutDeliverable.map((item) => ({
      type: "rubric-deliverable",
      severity: "medium",
      field: item.id,
      message: `Rubric item ${item.id} references missing deliverable ${item.deliverableId}.`,
    })),
  ];

  return {
    challengeId: challenge.id,
    status: findings.some((finding) => finding.severity === "high") ? "blocked" : "publishable",
    findings,
  };
}

function buildWorkspaceSecuritySummary(submissionInput) {
  const submission = submissionInput || {};
  const workspace = submission.workspace || {};
  const auditTrail = asArray(submission.auditTrail);
  const findings = [];

  if (!workspace.id) findings.push("workspace-id-missing");
  if (workspace.visibility !== "private") findings.push("workspace-not-private");
  if (!workspace.accessControl || !asArray(workspace.accessControl.allowedTeamIds).includes(submission.teamId)) {
    findings.push("team-access-not-scoped");
  }
  if (!workspace.versionControl || workspace.versionControl.enabled !== true) {
    findings.push("version-control-disabled");
  }
  if (auditTrail.length === 0) findings.push("audit-trail-empty");

  return {
    workspaceId: workspace.id || null,
    status: findings.length ? "needs-review" : "ready",
    findings,
    visibility: workspace.visibility || "unknown",
    versionControlRef: workspace.versionControl ? workspace.versionControl.ref || null : null,
    auditTrailHash: auditTrail.length ? hashRecord(auditTrail) : null,
  };
}

function buildSubmissionManifest(challengeInput, submissionInput) {
  const challenge = normalizeChallenge(challengeInput);
  const submission = submissionInput || {};
  const artifacts = asArray(submission.artifacts);
  const artifactByDeliverable = new Map(
    artifacts.map((artifact) => [artifact.deliverableId, artifact]),
  );

  const deliverableManifest = challenge.deliverables.map((deliverable) => {
    const artifact = artifactByDeliverable.get(deliverable.id);
    return {
      deliverableId: deliverable.id,
      title: deliverable.title,
      required: deliverable.required !== false,
      artifactId: artifact ? artifact.id : null,
      artifactHash: artifact ? hashRecord(artifact) : null,
      status: artifact ? "present" : deliverable.required === false ? "optional-missing" : "missing",
    };
  });

  return {
    submissionId: submission.id || "submission-unknown",
    teamId: submission.teamId || "team-unknown",
    challengeId: challenge.id,
    anonymous: Boolean(submission.anonymous),
    manifestHash: hashRecord({ challengeId: challenge.id, artifacts }),
    deliverables: deliverableManifest,
    missingRequired: deliverableManifest.filter((item) => item.required && item.status === "missing"),
    auditTrail: asArray(submission.auditTrail),
    workspaceSecurity: buildWorkspaceSecuritySummary(submission),
  };
}

function detectReviewerConflicts(reviewersInput, submissionInput, challengeInput) {
  const reviewers = asArray(reviewersInput);
  const submission = submissionInput || {};
  const challenge = normalizeChallenge(challengeInput);
  const teamMembers = new Set(asArray(submission.teamMembers));

  return reviewers.map((reviewer) => {
    const conflicts = [];
    if (teamMembers.has(reviewer.id)) conflicts.push("reviewer-on-submission-team");
    if (asArray(reviewer.affiliations).includes(challenge.sponsorId)) {
      conflicts.push("sponsor-affiliation");
    }
    if (asArray(reviewer.collaborators).some((collaborator) => teamMembers.has(collaborator))) {
      conflicts.push("recent-collaborator");
    }

    return {
      reviewerId: reviewer.id,
      name: reviewer.name || reviewer.id,
      eligible: conflicts.length === 0,
      conflicts,
    };
  });
}

function scoreSubmission(challengeInput, submissionInput, reviewsInput) {
  const challenge = normalizeChallenge(challengeInput);
  const manifest = buildSubmissionManifest(challenge, submissionInput);
  const reviews = asArray(reviewsInput);
  const rubricScores = challenge.rubric.map((rubricItem) => {
    const scores = reviews
      .map((review) => Number((review.scores || {})[rubricItem.id]))
      .filter(Number.isFinite);
    const average = scores.length
      ? scores.reduce((sum, score) => sum + score, 0) / scores.length
      : 0;
    const weighted = average * (Number(rubricItem.weight || 0) / 100);

    return {
      rubricId: rubricItem.id,
      label: rubricItem.label,
      weight: Number(rubricItem.weight || 0),
      average: Number(average.toFixed(2)),
      weighted: Number(weighted.toFixed(2)),
    };
  });

  const rawScore = rubricScores.reduce((sum, item) => sum + item.weighted, 0);
  const missingPenalty = manifest.missingRequired.length * 12;
  const finalScore = Math.max(0, Number((rawScore - missingPenalty).toFixed(2)));

  return {
    submissionId: manifest.submissionId,
    challengeId: challenge.id,
    finalScore,
    rawScore: Number(rawScore.toFixed(2)),
    missingPenalty,
    rubricScores,
    manifest,
  };
}

function buildArbitrationRecord(challengeInput, submissionInput, reviewersInput, reviewsInput) {
  const challenge = normalizeChallenge(challengeInput);
  const challengeValidation = validateChallenge(challenge);
  const conflicts = detectReviewerConflicts(reviewersInput, submissionInput, challenge);
  const eligibleReviewerIds = new Set(conflicts.filter((reviewer) => reviewer.eligible).map((reviewer) => reviewer.reviewerId));
  const eligibleReviews = asArray(reviewsInput).filter((review) => eligibleReviewerIds.has(review.reviewerId));
  const score = scoreSubmission(challenge, submissionInput, eligibleReviews);

  const blockerReasons = [
    ...(challengeValidation.status === "blocked" ? ["challenge-not-publishable"] : []),
    ...(score.manifest.missingRequired.length ? ["missing-required-deliverables"] : []),
    ...(eligibleReviews.length < 2 ? ["insufficient-independent-reviews"] : []),
  ];

  return {
    arbitrationId: `${challenge.id}-${score.submissionId}-arbitration`,
    status: blockerReasons.length ? "blocked" : score.finalScore >= 75 ? "award-recommended" : "revise",
    blockerReasons,
    challengeValidation,
    reviewerConflicts: conflicts,
    score,
    decisionLogHash: hashRecord({
      challengeId: challenge.id,
      submissionId: score.submissionId,
      conflicts,
      score,
    }),
  };
}

function buildPayoutPlan(challengeInput, submissionInput, arbitrationRecord) {
  const challenge = normalizeChallenge(challengeInput);
  const submission = submissionInput || {};
  const prizeAmount = Number(challenge.prize.amount || 0);
  const milestones = asArray(challenge.prize.milestones);
  const teamSplits = asArray(submission.teamSplits);

  if (arbitrationRecord.status !== "award-recommended") {
    return {
      status: "not-ready",
      reason: arbitrationRecord.blockerReasons[0] || "score-below-award-threshold",
      amount: 0,
      routes: [],
      ipTransferStatus: "retained-by-solver",
    };
  }

  const routes = teamSplits.length
    ? teamSplits.map((split) => ({
        payeeId: split.payeeId,
        amount: Number((prizeAmount * Number(split.percent || 0)).toFixed(2)),
      }))
    : [{ payeeId: submission.teamId || "team-unknown", amount: prizeAmount }];

  return {
    status: "ready",
    amount: prizeAmount,
    currency: challenge.prize.currency || "USD",
    payoutSchedule: milestones.length ? milestones : [{ label: "final award", percent: 100 }],
    routes,
    ipTransferStatus: challenge.ipPolicy.transferOnPayout ? "transfer-after-payout" : "solver-retains-ip",
    acceptanceRecordHash: hashRecord({
      challengeId: challenge.id,
      submissionId: submission.id,
      amount: prizeAmount,
      routes,
      ipPolicy: challenge.ipPolicy,
    }),
  };
}

function buildScientificBountyPacket(challengeInput, submissionInput, reviewersInput, reviewsInput) {
  const arbitration = buildArbitrationRecord(
    challengeInput,
    submissionInput,
    reviewersInput,
    reviewsInput,
  );
  const payout = buildPayoutPlan(challengeInput, submissionInput, arbitration);

  return {
    challengeId: normalizeChallenge(challengeInput).id,
    submissionId: submissionInput.id,
    arbitration,
    payout,
    sponsorSummary: {
      decision: arbitration.status,
      finalScore: arbitration.score.finalScore,
      eligibleReviewers: arbitration.reviewerConflicts.filter((reviewer) => reviewer.eligible).length,
      missingDeliverables: arbitration.score.manifest.missingRequired.length,
      payoutStatus: payout.status,
    },
  };
}

module.exports = {
  REQUIRED_CHALLENGE_FIELDS,
  buildArbitrationRecord,
  buildPayoutPlan,
  buildScientificBountyPacket,
  buildSubmissionManifest,
  buildWorkspaceSecuritySummary,
  detectReviewerConflicts,
  hashRecord,
  normalizeChallenge,
  scoreSubmission,
  validateChallenge,
};
