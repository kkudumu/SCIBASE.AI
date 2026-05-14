"use strict";

const corpus = require("../data/sample-corpus.json");
const { buildKnowledgeGraphPacket } = require("../src/knowledge-graph-navigator");

const packet = buildKnowledgeGraphPacket(corpus);

console.log(
  JSON.stringify(
    {
      nodes: packet.graph.nodes.length,
      edges: packet.graph.edges.length,
      entityPages: packet.entityPages.length,
      verifiedProjects: packet.navigationExamples[1].nodes.map((node) => node.label),
      recommendationsForMaya: packet.recommendationDigest.find((digest) => digest.userId === "u-maya").recommendations,
      graphHash: packet.graph.graphHash,
      packetHash: packet.packetHash,
    },
    null,
    2,
  ),
);
