"use strict";

const assert = require("assert");
const sample = require("../data/sample-research.json");
const {
  buildClaimSupportReport,
  buildSimilarPapersWidget,
  buildResearchToolsPacket,
  detectSimilarity,
  extractClaimSentences,
  formatReference,
  recommendCitations,
  reviewManuscript,
  summarizePaper,
  topKeywords,
} = require("../src/ai-research-mvp-tools");

function testSummaries() {
  const abstract = summarizePaper(sample.document, "abstract");
  const layperson = summarizePaper(sample.document, "layperson");
  const keywords = topKeywords(sample.document.body, 5);

  assert.strictEqual(abstract.mode, "abstract");
  assert.ok(abstract.summary.includes("microbiome"));
  assert.ok(layperson.summary.includes("unlikely-to-be-random"));
  assert.ok(keywords.includes("flooding"));
  assert.ok(abstract.keyFindings.length > 0);
}

function testReviewDiagnostics() {
  const report = reviewManuscript(sample.document, {
    domain: "biology",
    openAccessCorpus: sample.openAccessCorpus,
  });

  assert.ok(report.findings.some((finding) => finding.message.includes("ethics")));
  assert.ok(report.findings.some((finding) => finding.message.includes("confidence interval")));
  assert.ok(!report.findings.some((finding) => finding.message.includes("No explicit p-value")));
  assert.ok(!report.findings.some((finding) => finding.message.includes("No explicit sample size")));
  assert.ok(report.findings.some((finding) => finding.category === "similarity"));
  assert.ok(report.qualityScore < 100);
}

function testSimilarityAndCitations() {
  const similarity = detectSimilarity(sample.document, sample.openAccessCorpus);
  const citations = recommendCitations(sample.document, sample.citationCorpus, { style: "nature", limit: 2 });

  assert.strictEqual(similarity[0].sourceId, "oa-1");
  assert.strictEqual(citations.length, 2);
  assert.notStrictEqual(citations[0].doi, sample.document.references[0].doi);
  assert.ok(citations[0].formatted.includes("https://doi.org/"));
}

function testSimilarPapersWidget() {
  const widget = buildSimilarPapersWidget(
    sample.document,
    sample.openAccessCorpus,
    sample.citationCorpus,
    3,
  );

  assert.strictEqual(widget.length, 3);
  assert.strictEqual(widget[0].rank, 1);
  assert.ok(widget.some((item) => item.source === "open-access-corpus"));
  assert.ok(widget.some((item) => item.source === "citation-corpus"));
  assert.ok(widget.every((item) => item.action.type));
}

function testClaimSupportReport() {
  const claims = extractClaimSentences(sample.document);
  const report = buildClaimSupportReport(sample.document, sample.citationCorpus);

  assert.ok(claims.length >= 3);
  assert.strictEqual(report.documentId, sample.document.id);
  assert.ok(report.claims.every((claim) => claim.evidenceSpanHash.length >= 12));
  assert.ok(report.claims.some((claim) => claim.supportStatus === "citation-recommended"));
  assert.ok(report.claims.some((claim) => claim.action.type === "insert-supporting-citation"));
  assert.ok(report.reportHash.length >= 12);
}

function testReferenceFormatting() {
  const reference = sample.citationCorpus[0];

  assert.ok(formatReference(reference, "apa").startsWith("M. Rivera, S. Nair (2025)."));
  assert.ok(formatReference(reference, "mla").includes("\"Urban floodwater microbiome dynamics.\""));
  assert.ok(formatReference(reference, "nature").includes("Water Research"));
}

function testPacket() {
  const packet = buildResearchToolsPacket(sample);

  assert.deepStrictEqual(Object.keys(packet.summaries), ["abstract", "executive", "layperson"]);
  assert.strictEqual(packet.citationRecommendations.length, packet.insertActions.length);
  assert.ok(packet.similarPapersWidget.length > 0);
  assert.ok(packet.claimSupportReport.claims.length > 0);
  assert.ok(packet.claimSupportReport.reportHash.length >= 12);
  assert.ok(packet.reviewReport.reportHash);
  assert.ok(packet.packetHash.length >= 12);
}

testSummaries();
testReviewDiagnostics();
testSimilarityAndCitations();
testSimilarPapersWidget();
testClaimSupportReport();
testReferenceFormatting();
testPacket();

console.log("ai-research-mvp-tools tests passed");
