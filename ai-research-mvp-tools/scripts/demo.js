"use strict";

const sample = require("../data/sample-research.json");
const { buildResearchToolsPacket } = require("../src/ai-research-mvp-tools");

const packet = buildResearchToolsPacket(sample);

console.log(
  JSON.stringify(
    {
      document: packet.document.title,
      summaryModes: Object.keys(packet.summaries),
      qualityScore: packet.reviewReport.qualityScore,
      reviewFindings: packet.reviewReport.findings.map((finding) => `${finding.category}:${finding.message}`),
      topCitation: packet.citationRecommendations[0],
      similarPapers: packet.similarPapersWidget,
      claimSupport: {
        claims: packet.claimSupportReport.claims.length,
        unsupportedCount: packet.claimSupportReport.unsupportedCount,
        recommendedCitationCount: packet.claimSupportReport.recommendedCitationCount,
        firstAction: packet.claimSupportReport.claims[0] ? packet.claimSupportReport.claims[0].action : null,
      },
      insertActions: packet.insertActions.length,
      packetHash: packet.packetHash,
    },
    null,
    2,
  ),
);
