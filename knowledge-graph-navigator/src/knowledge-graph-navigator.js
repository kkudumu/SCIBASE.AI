"use strict";

const crypto = require("crypto");

const ENTITY_TYPES = ["project", "author", "affiliation", "concept", "tool", "dataset", "protocol", "reference", "funder"];
const RELATION_TYPES = [
  "authored-by",
  "affiliated-with",
  "mentions-concept",
  "uses-tool",
  "uses-dataset",
  "uses-protocol",
  "cites-reference",
  "funded-by",
  "related-to",
];

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashRecord(value) {
  return crypto.createHash("sha256").update(stableStringify(value)).digest("hex").slice(0, 20);
}

function slug(value) {
  return String(value || "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeCorpus(input) {
  if (!input || typeof input !== "object") throw new TypeError("corpus must be an object");
  return {
    ontology: input.ontology || {},
    projects: asArray(input.projects),
    userProfiles: asArray(input.userProfiles),
  };
}

function addUnique(map, entity) {
  if (!entity.id) throw new Error("entity id is required");
  if (!map.has(entity.id)) map.set(entity.id, entity);
  return map.get(entity.id);
}

function createEdge(source, relation, target, evidence) {
  if (!RELATION_TYPES.includes(relation)) throw new Error(`unsupported relation: ${relation}`);
  return {
    id: `edge-${hashRecord({ source, relation, target, evidence })}`,
    source,
    relation,
    target,
    evidence: asArray(evidence),
    weight: Math.max(1, asArray(evidence).length),
  };
}

function extractDois(text) {
  return Array.from(String(text || "").matchAll(/10\.\d{4,9}\/[-._;()/:A-Z0-9]+/gi)).map((match) =>
    match[0].replace(/[.,;:]+$/g, ""),
  );
}

function extractEntitiesFromProject(project, ontology = {}) {
  const text = asArray(project.artifacts)
    .map((artifact) => `${artifact.title || ""} ${artifact.kind || ""} ${artifact.content || ""}`)
    .join(" ");
  const lowerText = text.toLowerCase();
  const entities = [];
  const edges = [];
  const projectId = `project:${project.id}`;

  entities.push({
    id: projectId,
    type: "project",
    label: project.title,
    domain: project.domain || "general",
    year: project.year || null,
    citationCount: Number(project.citationCount || 0),
    reproducibility: project.reproducibility || "unknown",
    schemaOrg: {
      "@type": "ScholarlyArticle",
      identifier: project.doi || project.id,
      name: project.title,
    },
  });

  for (const author of asArray(project.authors)) {
    const authorId = `author:${slug(author.name)}`;
    const affiliationId = `affiliation:${slug(author.affiliation || "independent")}`;
    entities.push({ id: authorId, type: "author", label: author.name, orcid: author.orcid || null });
    entities.push({ id: affiliationId, type: "affiliation", label: author.affiliation || "Independent" });
    edges.push(createEdge(projectId, "authored-by", authorId, [`author:${author.name}`]));
    edges.push(createEdge(authorId, "affiliated-with", affiliationId, [`affiliation:${author.affiliation || "Independent"}`]));
  }

  for (const funder of asArray(project.funders)) {
    const funderId = `funder:${slug(funder)}`;
    entities.push({ id: funderId, type: "funder", label: funder });
    edges.push(createEdge(projectId, "funded-by", funderId, [`funder:${funder}`]));
  }

  for (const [concept, aliases] of Object.entries(ontology.concepts || {})) {
    const matchedAlias = asArray(aliases).find((alias) => lowerText.includes(String(alias).toLowerCase()));
    if (matchedAlias) {
      const conceptId = `concept:${slug(concept)}`;
      entities.push({ id: conceptId, type: "concept", label: concept, ontology: "local-scientific-terms" });
      edges.push(createEdge(projectId, "mentions-concept", conceptId, [`alias:${matchedAlias}`]));
    }
  }

  for (const [tool, aliases] of Object.entries(ontology.tools || {})) {
    const matchedAlias = asArray(aliases).find((alias) => lowerText.includes(String(alias).toLowerCase()));
    if (matchedAlias) {
      const toolId = `tool:${slug(tool)}`;
      entities.push({ id: toolId, type: "tool", label: tool, ontology: "software-library" });
      edges.push(createEdge(projectId, "uses-tool", toolId, [`alias:${matchedAlias}`]));
    }
  }

  for (const artifact of asArray(project.artifacts)) {
    if (artifact.kind === "dataset") {
      const datasetId = `dataset:${slug(artifact.id || artifact.title)}`;
      entities.push({ id: datasetId, type: "dataset", label: artifact.title || artifact.id, path: artifact.path || null });
      edges.push(createEdge(projectId, "uses-dataset", datasetId, [`artifact:${artifact.id || artifact.path}`]));
    }
    if (artifact.kind === "protocol") {
      const protocolId = `protocol:${slug(artifact.id || artifact.title)}`;
      entities.push({ id: protocolId, type: "protocol", label: artifact.title || artifact.id, path: artifact.path || null });
      edges.push(createEdge(projectId, "uses-protocol", protocolId, [`artifact:${artifact.id || artifact.path}`]));
    }
  }

  const dois = new Set([...asArray(project.references).map((reference) => reference.doi).filter(Boolean), ...extractDois(text)]);
  for (const doi of dois) {
    const referenceId = `reference:${slug(doi)}`;
    entities.push({ id: referenceId, type: "reference", label: doi, doi });
    edges.push(createEdge(projectId, "cites-reference", referenceId, [`doi:${doi}`]));
  }

  return { entities, edges };
}

function buildKnowledgeGraph(corpusInput) {
  const corpus = normalizeCorpus(corpusInput);
  const nodeMap = new Map();
  const edgeMap = new Map();

  for (const project of corpus.projects) {
    const extracted = extractEntitiesFromProject(project, corpus.ontology);
    for (const entity of extracted.entities) addUnique(nodeMap, entity);
    for (const edge of extracted.edges) edgeMap.set(edge.id, edge);
  }

  const conceptEdgesByProject = new Map();
  for (const edge of edgeMap.values()) {
    if (edge.relation === "mentions-concept") {
      if (!conceptEdgesByProject.has(edge.source)) conceptEdgesByProject.set(edge.source, []);
      conceptEdgesByProject.get(edge.source).push(edge.target);
    }
  }
  const projects = Array.from(conceptEdgesByProject.keys());
  for (let index = 0; index < projects.length; index += 1) {
    for (let other = index + 1; other < projects.length; other += 1) {
      const shared = conceptEdgesByProject.get(projects[index]).filter((concept) =>
        conceptEdgesByProject.get(projects[other]).includes(concept),
      );
      if (shared.length > 0) {
        const edge = createEdge(projects[index], "related-to", projects[other], shared);
        edgeMap.set(edge.id, edge);
      }
    }
  }

  return {
    nodes: Array.from(nodeMap.values()).sort((left, right) => left.id.localeCompare(right.id)),
    edges: Array.from(edgeMap.values()).sort((left, right) => left.id.localeCompare(right.id)),
    graphHash: hashRecord({ nodes: Array.from(nodeMap.keys()).sort(), edges: Array.from(edgeMap.keys()).sort() }),
  };
}

function buildEntityPage(graphInput, entityId) {
  const graph = graphInput.nodes ? graphInput : buildKnowledgeGraph(graphInput);
  const entity = graph.nodes.find((node) => node.id === entityId);
  if (!entity) throw new Error(`unknown entity: ${entityId}`);
  const inbound = graph.edges.filter((edge) => edge.target === entityId);
  const outbound = graph.edges.filter((edge) => edge.source === entityId);
  const projectContexts = inbound
    .filter((edge) => edge.source.startsWith("project:"))
    .map((edge) => ({
      projectId: edge.source,
      relation: edge.relation,
      evidence: edge.evidence,
    }));

  return {
    entity,
    inbound,
    outbound,
    projectContexts,
    citationCount: inbound.filter((edge) => edge.relation === "cites-reference").length,
    usageCount: inbound.length + outbound.length,
    pageHash: hashRecord({ entityId, inbound, outbound }),
  };
}

function queryGraph(graphInput, query = {}) {
  const graph = graphInput.nodes ? graphInput : buildKnowledgeGraph(graphInput);
  const nodes = graph.nodes.filter((node) => {
    if (query.type && node.type !== query.type) return false;
    if (query.domain && node.domain && node.domain !== query.domain) return false;
    if (query.minCitationCount && Number(node.citationCount || 0) < query.minCitationCount) return false;
    if (query.reproducibility && node.reproducibility !== query.reproducibility) return false;
    if (query.text && !String(node.label || "").toLowerCase().includes(String(query.text).toLowerCase())) return false;
    return true;
  });
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = graph.edges.filter((edge) => nodeIds.has(edge.source) || nodeIds.has(edge.target));

  return {
    query,
    nodes,
    edges,
    resultHash: hashRecord({ query, nodeIds: Array.from(nodeIds).sort(), edges: edges.map((edge) => edge.id).sort() }),
  };
}

function recommendResearch(corpusInput, userId, limit = 5) {
  const corpus = normalizeCorpus(corpusInput);
  const graph = buildKnowledgeGraph(corpus);
  const profile = corpus.userProfiles.find((candidate) => candidate.id === userId) || { interests: [], recentProjects: [] };
  const interests = new Set(asArray(profile.interests).map((interest) => slug(interest)));
  const recentProjectIds = new Set(asArray(profile.recentProjects).map((projectId) => `project:${projectId}`));
  const recommendations = [];

  for (const project of graph.nodes.filter((node) => node.type === "project" && !recentProjectIds.has(node.id))) {
    const projectEdges = graph.edges.filter((edge) => edge.source === project.id);
    const conceptMatches = projectEdges.filter(
      (edge) => edge.relation === "mentions-concept" && interests.has(edge.target.replace("concept:", "")),
    );
    const reproducibilityBonus = project.reproducibility === "verified" ? 8 : 0;
    const citationBonus = Math.min(15, Number(project.citationCount || 0) / 4);
    const score = Number((conceptMatches.length * 12 + reproducibilityBonus + citationBonus).toFixed(4));
    if (score > 0) {
      const evidenceEdges = projectEdges
        .filter((edge) =>
          ["mentions-concept", "uses-dataset", "uses-protocol", "uses-tool", "cites-reference"].includes(edge.relation),
        )
        .map((edge) => ({
          relation: edge.relation,
          target: edge.target,
          evidence: edge.evidence,
        }));
      recommendations.push({
        projectId: project.id,
        title: project.label,
        score,
        evidenceEdges,
        reasons: [
          ...conceptMatches.map((edge) => `Matches interest ${edge.target.replace("concept:", "")}`),
          ...(reproducibilityBonus ? ["Verified reproducibility"] : []),
          ...(citationBonus ? [`Citation signal ${project.citationCount}`] : []),
        ],
      });
    }
  }

  return recommendations.sort((left, right) => right.score - left.score || left.title.localeCompare(right.title)).slice(0, limit);
}

function buildResearchJourney(graphInput, startEntityId, maxHops = 3) {
  const graph = graphInput.nodes ? graphInput : buildKnowledgeGraph(graphInput);
  const visited = new Set([startEntityId]);
  const steps = [];
  let frontier = [startEntityId];

  for (let hop = 1; hop <= maxHops && frontier.length > 0; hop += 1) {
    const next = [];
    for (const entityId of frontier) {
      const connected = graph.edges.filter((edge) => edge.source === entityId || edge.target === entityId);
      for (const edge of connected) {
        const targetId = edge.source === entityId ? edge.target : edge.source;
        if (visited.has(targetId)) continue;
        const target = graph.nodes.find((node) => node.id === targetId);
        if (!target) continue;
        visited.add(targetId);
        next.push(targetId);
        steps.push({
          hop,
          from: entityId,
          relation: edge.relation,
          to: targetId,
          toType: target.type,
          label: target.label,
          evidence: edge.evidence,
        });
      }
    }
    frontier = next;
  }

  return {
    startEntityId,
    steps,
    journeyHash: hashRecord({ startEntityId, steps }),
  };
}

function buildCollaborationMap(graphInput) {
  const graph = graphInput.nodes ? graphInput : buildKnowledgeGraph(graphInput);
  const authoredByProject = new Map();
  const affiliationByAuthor = new Map();

  for (const edge of graph.edges) {
    if (edge.relation === "authored-by") {
      if (!authoredByProject.has(edge.source)) authoredByProject.set(edge.source, []);
      authoredByProject.get(edge.source).push(edge.target);
    }
    if (edge.relation === "affiliated-with") {
      affiliationByAuthor.set(edge.source, edge.target);
    }
  }

  const authorEdges = new Map();
  const labEdges = new Map();
  for (const [projectId, authorIds] of authoredByProject.entries()) {
    const sortedAuthors = [...new Set(authorIds)].sort();
    for (let index = 0; index < sortedAuthors.length; index += 1) {
      for (let other = index + 1; other < sortedAuthors.length; other += 1) {
        const left = sortedAuthors[index];
        const right = sortedAuthors[other];
        const edgeId = `${left}<->${right}`;
        const existing = authorEdges.get(edgeId) || {
          source: left,
          target: right,
          sharedProjects: [],
          weight: 0,
        };
        existing.sharedProjects.push(projectId);
        existing.weight = existing.sharedProjects.length;
        authorEdges.set(edgeId, existing);

        const leftLab = affiliationByAuthor.get(left);
        const rightLab = affiliationByAuthor.get(right);
        if (leftLab && rightLab && leftLab !== rightLab) {
          const labId = [leftLab, rightLab].sort().join("<->");
          const labEdge = labEdges.get(labId) || {
            source: [leftLab, rightLab].sort()[0],
            target: [leftLab, rightLab].sort()[1],
            sharedProjects: [],
            authorPairs: [],
            weight: 0,
          };
          labEdge.sharedProjects.push(projectId);
          labEdge.authorPairs.push([left, right]);
          labEdge.weight = labEdge.sharedProjects.length;
          labEdges.set(labId, labEdge);
        }
      }
    }
  }

  return {
    authors: graph.nodes.filter((node) => node.type === "author"),
    affiliations: graph.nodes.filter((node) => node.type === "affiliation"),
    authorEdges: Array.from(authorEdges.values()),
    labEdges: Array.from(labEdges.values()),
    collaborationHash: hashRecord({
      authorEdges: Array.from(authorEdges.values()),
      labEdges: Array.from(labEdges.values()),
    }),
  };
}

function buildRecommendationSurfaces(corpusInput, userId) {
  const recommendations = recommendResearch(corpusInput, userId, 5);
  return {
    userId,
    sidebar: recommendations.slice(0, 3).map((recommendation) => ({
      projectId: recommendation.projectId,
      title: recommendation.title,
      score: recommendation.score,
      primaryReason: recommendation.reasons[0] || "Related research activity",
    })),
    weeklyDigest: {
      subject: "Your SCIBASE knowledge graph recommendations",
      items: recommendations.map((recommendation) => ({
        title: recommendation.title,
        score: recommendation.score,
        reasons: recommendation.reasons,
      })),
    },
    discoveryMode: recommendations.map((recommendation) => ({
      seedProjectId: recommendation.projectId,
      nextQuery: {
        type: "project",
        text: recommendation.title.split(/\s+/).slice(0, 3).join(" "),
      },
      evidenceEdges: recommendation.evidenceEdges.slice(0, 4),
    })),
    surfacesHash: hashRecord({ userId, recommendations }),
  };
}

function schemaTypeForEntity(type) {
  return {
    project: "ScholarlyArticle",
    author: "Person",
    affiliation: "Organization",
    concept: "DefinedTerm",
    tool: "SoftwareApplication",
    dataset: "Dataset",
    protocol: "CreativeWork",
    reference: "ScholarlyArticle",
    funder: "FundingAgency",
  }[type] || "Thing";
}

function buildGraphLinkedDataExport(graphInput) {
  const graph = graphInput.nodes ? graphInput : buildKnowledgeGraph(graphInput);
  const nodeRecords = graph.nodes.map((node) => ({
    "@id": node.id,
    "@type": schemaTypeForEntity(node.type),
    name: node.label,
    identifier: node.doi || node.orcid || node.path || node.id,
    additionalType: node.type,
    ...(node.domain ? { about: node.domain } : {}),
    ...(node.year ? { datePublished: String(node.year) } : {}),
    ...(node.citationCount !== undefined ? { citationCount: Number(node.citationCount || 0) } : {}),
    ...(node.reproducibility ? { reproducibility: node.reproducibility } : {}),
    ...(node.ontology ? { inDefinedTermSet: node.ontology } : {}),
  }));

  const relationshipRecords = graph.edges.map((edge) => ({
    "@id": edge.id,
    "@type": "Relationship",
    source: edge.source,
    relation: edge.relation,
    target: edge.target,
    evidence: edge.evidence,
    weight: edge.weight,
  }));

  const provenanceRecords = graph.edges.map((edge) => ({
    edgeId: edge.id,
    source: edge.source,
    relation: edge.relation,
    target: edge.target,
    evidence: edge.evidence,
    evidenceHash: hashRecord(edge.evidence),
  }));

  return {
    "@context": {
      "@vocab": "https://schema.org/",
      relation: "https://schema.org/relationship",
      evidence: "https://scibase.ai/terms/evidence",
      reproducibility: "https://scibase.ai/terms/reproducibility",
      inDefinedTermSet: "https://schema.org/inDefinedTermSet",
    },
    "@graph": [...nodeRecords, ...relationshipRecords],
    provenance: provenanceRecords,
    entityCount: nodeRecords.length,
    relationshipCount: relationshipRecords.length,
    exportHash: hashRecord({ nodeRecords, relationshipRecords, provenanceRecords }),
  };
}

function buildKnowledgeGraphPacket(corpusInput) {
  const graph = buildKnowledgeGraph(corpusInput);
  const corpus = normalizeCorpus(corpusInput);
  const linkedDataExport = buildGraphLinkedDataExport(graph);
  const collaborationMap = buildCollaborationMap(graph);
  const entityPages = graph.nodes
    .filter((node) => ["concept", "dataset", "tool", "author"].includes(node.type))
    .slice(0, 8)
    .map((node) => buildEntityPage(graph, node.id));
  const recommendationDigest = corpus.userProfiles.map((profile) => ({
    userId: profile.id,
    recommendations: recommendResearch(corpusInput, profile.id, 3),
  }));
  const recommendationSurfaces = corpus.userProfiles.map((profile) =>
    buildRecommendationSurfaces(corpusInput, profile.id),
  );

  return {
    supportedEntityTypes: ENTITY_TYPES,
    supportedRelationTypes: RELATION_TYPES,
    graph,
    collaborationMap,
    entityPages,
    navigationExamples: [
      queryGraph(graph, { type: "dataset" }),
      queryGraph(graph, { type: "project", reproducibility: "verified" }),
      queryGraph(graph, { text: "CRISPR" }),
    ],
    researchJourneys: [
      buildResearchJourney(graph, "concept:crispr", 2),
      buildResearchJourney(graph, "dataset:dataset-flood-samples", 2),
    ],
    linkedDataExport,
    recommendationDigest,
    recommendationSurfaces,
    apiRoutes: [
      "GET /knowledge-graph/entities",
      "GET /knowledge-graph/entities/:id",
      "GET /knowledge-graph/search?type=dataset&reproducibility=verified",
      "GET /knowledge-graph/recommendations/:userId",
      "GET /knowledge-graph/recommendations/:userId/surfaces",
      "GET /knowledge-graph/collaborations",
      "GET /knowledge-graph/export/jsonld",
    ],
    packetHash: hashRecord({
      graphHash: graph.graphHash,
      collaborationHash: collaborationMap.collaborationHash,
      recommendationDigest,
      recommendationSurfaces,
      linkedDataExport: linkedDataExport.exportHash,
    }),
  };
}

module.exports = {
  ENTITY_TYPES,
  RELATION_TYPES,
  buildEntityPage,
  buildGraphLinkedDataExport,
  buildKnowledgeGraph,
  buildKnowledgeGraphPacket,
  buildCollaborationMap,
  buildRecommendationSurfaces,
  buildResearchJourney,
  extractDois,
  extractEntitiesFromProject,
  hashRecord,
  queryGraph,
  recommendResearch,
};
