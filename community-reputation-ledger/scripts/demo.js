"use strict";

const community = require("../data/sample-community.json");
const { buildCommunityReputationPacket } = require("../src/community-reputation-ledger");

const packet = buildCommunityReputationPacket(community);
const topDomain = packet.leaderboards.domain.find((leaderboard) => leaderboard.group === "biology");

console.log(
  JSON.stringify(
    {
      reviewTemplates: packet.reviewTemplates.length,
      reviews: packet.reviews.length,
      comments: packet.comments.length,
      creditedContributions: packet.contributionLedger.length,
      topBiologyResearcher: topDomain.entries[0],
      moderation: packet.moderation,
      governance: {
        status: packet.governance.status,
        requiredActions: packet.governance.requiredActions.length,
        openAppeals: packet.governance.appeals.filter((appeal) => appeal.status === "open").length,
        firstAppealDueBy: packet.governance.appeals[0] ? packet.governance.appeals[0].dueBy : null,
      },
      incentiveTiers: packet.incentiveTiers,
      packetHash: packet.packetHash,
    },
    null,
    2,
  ),
);
