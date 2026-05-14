"use strict";

const assert = require("assert");
const corpus = require("../data/sample-corpus.json");
const {
  buildEntityPage,
  buildGraphLinkedDataExport,
  buildKnowledgeGraph,
  buildKnowledgeGraphPacket,
  buildResearchJourney,
  extractDois,
  extractEntitiesFromProject,
  queryGraph,
  recommendResearch,
} = require("../src/knowledge-graph-navigator");

function testExtraction() {
  const extracted = extractEntitiesFromProject(corpus.projects[0], corpus.ontology);
  const doiMatches = extractDois("See 10.1038/s41586-020-2649-2 and 10.5555/example.");

  assert.ok(extracted.entities.some((entity) => entity.id === "concept:microbiome"));
  assert.ok(extracted.entities.some((entity) => entity.id === "tool:scanpy"));
  assert.ok(extracted.edges.some((edge) => edge.relation === "uses-dataset"));
  assert.deepStrictEqual(doiMatches, ["10.1038/s41586-020-2649-2", "10.5555/example"]);
}

function testGraphConstruction() {
  const graph = buildKnowledgeGraph(corpus);

  assert.ok(graph.nodes.some((node) => node.type === "author" && node.label === "Ada Chen"));
  assert.ok(graph.nodes.some((node) => node.type === "funder"));
  assert.ok(graph.edges.some((edge) => edge.relation === "cites-reference"));
  assert.ok(graph.graphHash.length >= 12);
}

function testEntityPagesAndNavigation() {
  const graph = buildKnowledgeGraph(corpus);
  const page = buildEntityPage(graph, "concept:microbiome");
  const verified = queryGraph(graph, { type: "project", reproducibility: "verified" });
  const datasets = queryGraph(graph, { type: "dataset" });

  assert.ok(page.projectContexts.some((context) => context.projectId === "project:flood-microbiome"));
  assert.strictEqual(verified.nodes.length, 2);
  assert.ok(datasets.nodes.every((node) => node.type === "dataset"));
}

function testRecommendations() {
  const recommendations = recommendResearch(corpus, "u-maya", 2);

  assert.ok(recommendations.length > 0);
  assert.strictEqual(recommendations[0].projectId, "project:crispr-neuro-screen");
  assert.ok(recommendations[0].reasons.some((reason) => reason.includes("crispr")));
  assert.ok(recommendations[0].evidenceEdges.some((edge) => edge.relation === "mentions-concept"));
}

function testResearchJourneys() {
  const graph = buildKnowledgeGraph(corpus);
  const journey = buildResearchJourney(graph, "concept:crispr", 2);

  assert.strictEqual(journey.startEntityId, "concept:crispr");
  assert.ok(journey.steps.some((step) => step.to === "project:crispr-neuro-screen"));
  assert.ok(journey.steps.some((step) => step.toType === "dataset"));
  assert.ok(journey.journeyHash.length >= 12);
}

function testLinkedDataExport() {
  const graph = buildKnowledgeGraph(corpus);
  const linkedData = buildGraphLinkedDataExport(graph);

  assert.strictEqual(linkedData.entityCount, graph.nodes.length);
  assert.strictEqual(linkedData.relationshipCount, graph.edges.length);
  assert.ok(linkedData["@context"]["@vocab"].includes("schema.org"));
  assert.ok(linkedData["@graph"].some((record) => record["@type"] === "Dataset"));
  assert.ok(linkedData["@graph"].some((record) => record["@type"] === "Relationship"));
  assert.ok(linkedData.provenance.every((record) => record.evidenceHash.length >= 12));
  assert.ok(linkedData.exportHash.length >= 12);
}

function testPacket() {
  const packet = buildKnowledgeGraphPacket(corpus);

  assert.ok(packet.supportedEntityTypes.includes("protocol"));
  assert.ok(packet.supportedRelationTypes.includes("mentions-concept"));
  assert.strictEqual(packet.navigationExamples.length, 3);
  assert.strictEqual(packet.researchJourneys.length, 2);
  assert.strictEqual(packet.linkedDataExport.entityCount, packet.graph.nodes.length);
  assert.ok(packet.apiRoutes.includes("GET /knowledge-graph/export/jsonld"));
  assert.strictEqual(packet.recommendationDigest.length, corpus.userProfiles.length);
  assert.ok(packet.packetHash.length >= 12);
}

testExtraction();
testGraphConstruction();
testEntityPagesAndNavigation();
testRecommendations();
testResearchJourneys();
testLinkedDataExport();
testPacket();

console.log("knowledge-graph-navigator tests passed");
