"use strict";

const corpus = require("../data/sample-corpus.json");
const { buildKnowledgeGraphPacket } = require("../src/knowledge-graph-navigator");

const packet = buildKnowledgeGraphPacket(corpus);

console.log(
  JSON.stringify(
    {
      nodes: packet.graph.nodes.length,
      edges: packet.graph.edges.length,
      collaborationMap: {
        authorEdges: packet.collaborationMap.authorEdges.length,
        labEdges: packet.collaborationMap.labEdges.length,
        collaborationHash: packet.collaborationMap.collaborationHash,
      },
      entityPages: packet.entityPages.length,
      verifiedProjects: packet.navigationExamples[1].nodes.map((node) => node.label),
      researchJourneys: packet.researchJourneys,
      linkedDataExport: {
        records: packet.linkedDataExport["@graph"].length,
        provenanceRecords: packet.linkedDataExport.provenance.length,
        exportHash: packet.linkedDataExport.exportHash,
      },
      recommendationsForMaya: packet.recommendationDigest.find((digest) => digest.userId === "u-maya").recommendations,
      recommendationSurfacesForMaya: packet.recommendationSurfaces.find((surface) => surface.userId === "u-maya"),
      graphHash: packet.graph.graphHash,
      packetHash: packet.packetHash,
    },
    null,
    2,
  ),
);
