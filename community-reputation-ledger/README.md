# Community Reputation Ledger

Self-contained community and reputation milestone for [SCIBASE.AI issue #15](https://github.com/SCIBASE-AI/SCIBASE.AI/issues/15).

The issue asks for structured peer reviews, inline comments, contributor credit, CRediT taxonomy support, transparent reputation scoring, leaderboards, badges, and incentive tiers. This module provides a deterministic ledger that reviewers can run locally without databases, accounts, or external services.

## What It Adds

- Discipline-specific peer review templates for biology, physics, social sciences, and general research.
- Public, semi-private, anonymous, and double-blind review modes with reviewer anonymization.
- Inline comments targeting documents, datasets, code, notebooks, anchors, and line ranges.
- Timestamped contributor credit records with validated CRediT roles and stable hashes.
- Git-style contributor graph aggregation by researcher and project.
- Researcher profile views with review history, comment history, visible citation credits, badges, tiers, and profile hashes.
- Project timeline views that combine contributions, reviews, and comments into hashable chronological events.
- Citation page views that surface visible contributor credit by project for author/citation pages.
- Transparent researcher score components for citations, forks, endorsements, peer review, reproducibility, bounties, contribution credit, and moderation penalties.
- Moderation signals for self-endorsements, reciprocal endorsements, thin reviews, and flagged researcher metrics.
- Governance audit for review quality, reputation score changes, open appeals, required actions, and appeal SLA due dates.
- Leaderboards by domain, region, and institution.
- Badge and incentive tier assignment for trusted reviewers, reproducibility, challenge completion, and open-science leadership.
- Sample community fixture, tests, requirement map, CLI demo, and short demo GIF.

## Run

```bash
cd community-reputation-ledger
npm run check
npm test
npm run demo
```

Expected demo shape:

```json
{
  "reviewTemplates": 4,
  "reviews": 2,
  "comments": 2,
  "creditedContributions": 5,
  "researcherProfiles": 3,
  "projectTimelines": [
    {
      "projectId": "project-flood-microbiome",
      "eventCount": 5
    }
  ],
  "citationPages": [
    {
      "projectId": "project-flood-microbiome",
      "creditCount": 3
    }
  ],
  "topBiologyResearcher": {
    "researcherId": "u-ada",
    "tier": "open-science-champion"
  },
  "moderation": {
    "status": "review"
  },
  "governance": {
    "status": "needs-governance-review",
    "requiredActions": 1,
    "openAppeals": 1,
    "firstAppealDueBy": "2026-05-19T08:00:00.000Z"
  },
  "packetHash": "..."
}
```

## Demo Artifact

See [docs/demo.gif](docs/demo.gif) for a short visual walkthrough. The SVG source is included at [docs/demo.svg](docs/demo.svg).

## Files

- `src/community-reputation-ledger.js` - peer reviews, comments, contribution ledger, contributor graph, researcher profiles, project timelines, citation pages, reputation scores, leaderboards, moderation, and governance audit.
- `data/sample-community.json` - reviewable community fixture.
- `test/community-reputation-ledger.test.js` - dependency-free Node tests.
- `scripts/demo.js` - CLI demo.
- `docs/issue-15-requirement-map.md` - maps the implementation to bounty requirements.

## AI-Assisted Disclosure

This contribution was produced with AI assistance and manually verified with the local commands above.
