"use strict";

const assert = require("assert");
const community = require("../data/sample-community.json");
const {
  buildCommunityReputationPacket,
  buildCitationPages,
  buildContributionLedger,
  buildContributorGraph,
  buildGovernanceReport,
  buildLeaderboards,
  buildModerationSignals,
  buildProjectTimelines,
  buildReputationChangeLedger,
  buildResearcherProfiles,
  buildReviewQualityAudits,
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

function testModerationSignals() {
  const moderation = buildModerationSignals(community);
  const risky = buildModerationSignals({
    ...community,
    metrics: {
      researchers: {
        ...community.metrics.researchers,
        "u-ravi": {
          ...community.metrics.researchers["u-ravi"],
          flags: [{ id: "flag-high", severity: "high", reason: "review ring investigation" }],
        },
      },
    },
  });

  assert.strictEqual(moderation.status, "review");
  assert.ok(moderation.signals.some((signal) => signal.type === "self-endorsement"));
  assert.ok(moderation.signals.some((signal) => signal.type === "reciprocal-endorsement"));
  assert.strictEqual(risky.status, "needs-action");
  assert.ok(risky.moderationHash.length >= 12);
}

function testGovernanceReport() {
  const reviewQuality = buildReviewQualityAudits(community);
  const reputationChanges = buildReputationChangeLedger(community);
  const governance = buildGovernanceReport(community);

  assert.strictEqual(reviewQuality.length, community.reviews.length);
  assert.ok(reviewQuality.every((audit) => audit.status === "accepted"));
  assert.ok(reviewQuality.every((audit) => audit.auditHash.length >= 12));

  const adaChange = reputationChanges.find((change) => change.researcherId === "u-ada");
  assert.strictEqual(adaChange.previousTotal, 122);
  assert.strictEqual(adaChange.currentTier, "open-science-champion");
  assert.strictEqual(adaChange.status, "published");
  assert.ok(adaChange.changeHash.length >= 12);

  assert.strictEqual(governance.status, "needs-governance-review");
  assert.strictEqual(governance.appeals[0].dueBy, "2026-05-19T08:00:00.000Z");
  assert.ok(governance.requiredActions.some((action) => action.type === "appeal"));
  assert.ok(governance.governanceHash.length >= 12);
}

function testLeaderboardsAndPacket() {
  const leaderboards = buildLeaderboards(community, "domain");
  const biology = leaderboards.find((leaderboard) => leaderboard.group === "biology");
  const packet = buildCommunityReputationPacket(community);

  assert.strictEqual(biology.entries[0].researcherId, "u-ada");
  assert.strictEqual(packet.reviews.length, community.reviews.length);
  assert.strictEqual(packet.comments.length, community.comments.length);
  assert.strictEqual(packet.moderation.status, "review");
  assert.strictEqual(packet.governance.status, "needs-governance-review");
  assert.ok(packet.incentiveTiers.includes("trusted-reviewer"));
  assert.ok(packet.packetHash.length >= 12);
}

function testProfilesTimelinesAndCitationPages() {
  const profiles = buildResearcherProfiles(community);
  const timelines = buildProjectTimelines(community);
  const citationPages = buildCitationPages(community);
  const ada = profiles.find((profile) => profile.researcherId === "u-ada");
  const floodTimeline = timelines.find((timeline) => timeline.projectId === "project-flood-microbiome");
  const floodCitation = citationPages.find((page) => page.projectId === "project-flood-microbiome");

  assert.ok(ada.reviewHistory.some((review) => review.projectId === "project-civic-survey"));
  assert.ok(ada.commentHistory.some((comment) => comment.projectId === "project-civic-survey"));
  assert.ok(ada.creditSummary.visibleCitationCredits.length >= 2);
  assert.ok(ada.profileHash.length >= 12);

  assert.strictEqual(floodTimeline.eventCount, floodTimeline.events.length);
  assert.ok(floodTimeline.events.some((event) => event.type === "review"));
  assert.ok(floodTimeline.events.some((event) => event.type === "comment"));
  assert.ok(floodTimeline.timelineHash.length >= 12);

  assert.ok(floodCitation.credits.some((credit) => credit.researcherId === "u-ada"));
  assert.ok(floodCitation.citationText.includes("Ada Chen"));
  assert.ok(floodCitation.citationHash.length >= 12);
}

testReviewTemplatesAndPrivacy();
testInlineComments();
testContributionLedgerAndGraph();
testTransparentReputationScoring();
testModerationSignals();
testGovernanceReport();
testLeaderboardsAndPacket();
testProfilesTimelinesAndCitationPages();

console.log("community-reputation-ledger tests passed");
