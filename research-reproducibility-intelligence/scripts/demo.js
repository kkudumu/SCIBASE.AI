"use strict";

const sampleProject = require("../data/sample-project.json");
const { buildAssistantPacket } = require("../src/research-assistant");

const packet = buildAssistantPacket(sampleProject);

console.log(
  JSON.stringify(
    {
      project: packet.project.title,
      readinessScore: packet.readinessScore,
      peerReviewScore: packet.peerReview.score,
      reproducibilityStatus: packet.reproducibility.status,
      sandboxTarget: packet.reproducibility.sandboxPlan.targets[0],
      sandboxSummary: packet.reproducibility.sandboxEvidence.summary,
      workflowBlocked: packet.workflow.blocked,
      workflowRiskScore: packet.workflow.riskScore,
      topWorkflowAction: packet.workflow.actions[0],
      linkedAttempt: packet.reproducibility.linkedAttempts[0],
      topResearchGap: packet.researchGaps[0],
      nextActions: packet.nextActions.slice(0, 5),
    },
    null,
    2,
  ),
);
