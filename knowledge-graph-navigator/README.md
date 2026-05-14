# Knowledge Graph Navigator

Self-contained scientific knowledge graph milestone for [SCIBASE.AI issue #17](https://github.com/SCIBASE-AI/SCIBASE.AI/issues/17).

The issue asks for entity extraction, linked graph data, graph navigation, entity pages, semantic filters, and AI research recommendations. This module provides a deterministic implementation that reviewers can run locally without model services, vector databases, or external APIs.

## What It Adds

- Entity extraction for projects, authors, affiliations, concepts, tools, datasets, protocols, references, DOIs, and funders.
- Local ontology matching for scientific concepts and software tools.
- Schema.org-style metadata on project nodes.
- Knowledge graph nodes and edges for authorship, affiliation, datasets, protocols, tools, citations, funding, and related projects.
- JSON-LD linked-data export with schema.org-compatible entity records, relationship records, evidence provenance, and an export hash.
- Entity pages with inbound/outbound links, usage contexts, citation counts, and stable hashes.
- Graph navigation filters by node type, domain, citation count, reproducibility status, and text.
- Traceable research journeys that walk concept/dataset nodes through projects, datasets, tools, authors, and collaborators.
- Recommendation digest ranked from user interests, concept matches, citation signals, verified reproducibility, and supporting evidence edges.
- API route contracts for graph entities, entity details, semantic search, and recommendations.
- Sample corpus fixture, tests, requirement map, CLI demo, and short demo GIF.

## Run

```bash
cd knowledge-graph-navigator
npm run check
npm test
npm run demo
```

Expected demo shape:

```json
{
  "nodes": 30,
  "edges": 30,
  "entityPages": 8,
  "verifiedProjects": [
    "Coastal flooding microbiome atlas",
    "Reusable Jupyter protocol patterns for open science"
  ],
  "researchJourneys": [
    {
      "startEntityId": "concept:crispr"
    }
  ],
  "linkedDataExport": {
    "records": 60,
    "provenanceRecords": 30,
    "exportHash": "..."
  },
  "recommendationsForMaya": [
    {
      "projectId": "project:crispr-neuro-screen",
      "score": 40.5
    }
  ],
  "packetHash": "..."
}
```

## Demo Artifact

See [docs/demo.gif](docs/demo.gif) for a short visual walkthrough. The SVG source is included at [docs/demo.svg](docs/demo.svg).

## Files

- `src/knowledge-graph-navigator.js` - extraction, graph construction, entity pages, graph queries, JSON-LD export, recommendations.
- `data/sample-corpus.json` - reviewable scientific corpus fixture.
- `test/knowledge-graph-navigator.test.js` - dependency-free Node tests.
- `scripts/demo.js` - CLI demo.
- `docs/issue-17-requirement-map.md` - maps the implementation to bounty requirements.

## AI-Assisted Disclosure

This contribution was produced with AI assistance and manually verified with the local commands above.
