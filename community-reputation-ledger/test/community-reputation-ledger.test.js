"use strict";

const assert = require("assert");
const community = require("../data/sample-community.json");
const {
  buildCommunityReputationPacket,
  buildContributionLedger,
  buildContributorGraph,
  buildLeaderboards,
  createInlineComment,
  createPeerReview,
  scoreResearcher,
  selectReviewTemplate,
} = require("../src/community-reputation-ledger");

function testReviewTemplatesAndPrivacy() {
  const biology = selectReviewTemplate("biology");
  const doubleBlind = createPeerReview(community.reviews[1]);

  assert.ok(biology.criteria.includes("data-quality"));
  assert.strictEqual(doubleBlind.reviewerId, null);
  assert.ok(doubleBlind.reviewerAlias.startsWith("anonymous-"));
  assert.strictEqual(doubleBlind.scoreAverage, 4.2);
}

function testInlineComments() {
  const comment = createInlineComment(community.comments[1]);

  assert.strictEqual(comment.target.kind, "notebook");
  assert.strictEqual(comment.target.lineStart, 42);
  assert.strictEqual(comment.mode, "anonymous");
  assert.strictEqual(comment.authorId, null);
  assert.ok(comment.authorAlias.startsWith("anonymous-"));
  assert.ok(comment.commentHash);
}

function testContributionLedgerAndGraph() {
  const ledger = buildContributionLedger(community);
  const graph = buildContributorGraph(community);
  const ada = graph.contributors.find((contributor) => contributor.contributorId === "u-ada");

  assert.strictEqual(ledger.length, 5);
  assert.ok(ledger.every((entry) => entry.roles.length > 0));
  assert.ok(ada.totalCredit > 40);
  assert.ok(ada.roleCounts["data-curation"]);
  assert.ok(graph.edges.some((edge) => edge.contributorId === "u-ada" && edge.projectId === "project-flood-microbiome"));
}

function testTransparentReputationScoring() {
  const ada = scoreResearcher(community, "u-ada");
  const ravi = scoreResearcher(community, "u-ravi");
  const withoutSelfEndorsement = {
    ...community,
    endorsements: community.endorsements.filter((endorsement) => endorsement.from !== endorsement.to),
  };
  const adaNoSelf = scoreResearcher(withoutSelfEndorsement, "u-ada");

  assert.strictEqual(ada.components.endorsementImpact, adaNoSelf.components.endorsementImpact);
  assert.ok(ada.total > ravi.total);
  assert.ok(ada.badges.includes("Reproducibility Verified"));
  assert.ok(ada.transparencyHash);
}

function testLeaderboardsAndPacket() {
  const leaderboards = buildLeaderboards(community, "domain");
  const biology = leaderboards.find((leaderboard) => leaderboard.group === "biology");
  const packet = buildCommunityReputationPacket(community);

  assert.strictEqual(biology.entries[0].researcherId, "u-ada");
  assert.strictEqual(packet.reviews.length, community.reviews.length);
  assert.strictEqual(packet.comments.length, community.comments.length);
  assert.ok(packet.incentiveTiers.includes("trusted-reviewer"));
  assert.ok(packet.packetHash.length >= 12);
}

testReviewTemplatesAndPrivacy();
testInlineComments();
testContributionLedgerAndGraph();
testTransparentReputationScoring();
testLeaderboardsAndPacket();

console.log("community-reputation-ledger tests passed");
