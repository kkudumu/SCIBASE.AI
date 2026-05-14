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
      incentiveTiers: packet.incentiveTiers,
      packetHash: packet.packetHash,
    },
    null,
    2,
  ),
);
