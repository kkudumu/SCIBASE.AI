# Issue #17 Requirement Map

This module implements a deterministic scientific knowledge graph milestone for SCIBASE issue #17. It focuses on entity extraction, graph navigation, entity pages, semantic queries, and AI-style recommendations over a reviewable local corpus.

| Issue requirement | Implementation |
| --- | --- |
| Entity extraction from uploaded papers, datasets, notebooks, and protocols | `extractEntitiesFromProject()` scans project artifacts and metadata for authors, affiliations, funders, concepts, tools, datasets, protocols, references, and DOIs. |
| Named entities from ontologies | The sample corpus includes a local ontology for concepts and tools; extracted entities carry ontology metadata. |
| Linked data and schema.org-compatible metadata | Project nodes include schema.org-style scholarly metadata; `buildGraphLinkedDataExport()` emits a JSON-LD-style export with schema.org entity records, relationship records, provenance hashes, and an export hash. |
| Entity pages with aggregated data, citations, and usage contexts | `buildEntityPage()` returns inbound/outbound relationships, project contexts, usage count, and page hash. |
| Graph-based navigation and semantic search | `queryGraph()` supports node type, domain, citation count, reproducibility, and text filters. |
| Exploratory research journeys | `buildResearchJourney()` walks graph hops such as concept to project to dataset/tool/author with evidence trails. |
| Dynamic node types | `ENTITY_TYPES` covers projects, authors, affiliations, concepts, tools, datasets, protocols, references, and funders. |
| Relationship graph for authors, datasets, protocols, tools, funders, and references | `buildKnowledgeGraph()` emits normalized nodes and edges for authorship, affiliation, datasets, protocols, tools, citations, funding, and related projects. |
| AI research recommendations | `recommendResearch()` ranks project suggestions from user interests, concept matches, citation signals, reproducibility status, and evidence edges. |
| Sidebar/digest/API readiness | `buildKnowledgeGraphPacket()` emits recommendation digests, navigation examples, JSON-LD export data, and API route contracts. |
| Reviewer demo | `npm run demo` prints node/edge counts, verified projects, recommendation output, and graph hashes. |

## Verification

```bash
npm run check
npm test
npm run demo
```

The module is dependency-free and isolated under `knowledge-graph-navigator/`.
