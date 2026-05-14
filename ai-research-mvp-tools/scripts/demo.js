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
      highlightedCitation: packet.selectionRecommendations[0],
      citationInsertionPlan: {
        targetAnchor: packet.citationInsertionPlan.targetAnchor,
        insertions: packet.citationInsertionPlan.insertions.length,
        firstDragPayload: packet.citationInsertionPlan.insertions[0]
          ? packet.citationInsertionPlan.insertions[0].dragPayload
          : null,
      },
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
