"use strict";

const sample = require("../data/sample-bounty.json");
const { buildScientificBountyPacket } = require("../src/arbitration");

const packet = buildScientificBountyPacket(
  sample.challenge,
  sample.submission,
  sample.reviewers,
  sample.reviews,
);

console.log(
  JSON.stringify(
    {
      challenge: sample.challenge.title,
      decision: packet.sponsorSummary.decision,
      finalScore: packet.sponsorSummary.finalScore,
      eligibleReviewers: packet.sponsorSummary.eligibleReviewers,
      workspaceSecurity: packet.arbitration.score.manifest.workspaceSecurity,
      payoutStatus: packet.payout.status,
      payoutRoutes: packet.payout.routes,
      ipTransferStatus: packet.payout.ipTransferStatus,
      lifecycle: {
        status: packet.lifecycle.status,
        gates: packet.lifecycle.gates.map((gate) => ({
          id: gate.id,
          status: gate.status,
        })),
        milestoneReleases: packet.lifecycle.milestoneReleases,
        escrowReleaseInstruction: packet.lifecycle.escrowReleaseInstruction,
      },
      decisionLogHash: packet.arbitration.decisionLogHash,
    },
    null,
    2,
  ),
);
