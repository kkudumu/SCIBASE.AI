# Community Reputation Ledger

Self-contained community and reputation milestone for [SCIBASE.AI issue #15](https://github.com/SCIBASE-AI/SCIBASE.AI/issues/15).

The issue asks for structured peer reviews, inline comments, contributor credit, CRediT taxonomy support, transparent reputation scoring, leaderboards, badges, and incentive tiers. This module provides a deterministic ledger that reviewers can run locally without databases, accounts, or external services.

## What It Adds

- Discipline-specific peer review templates for biology, physics, social sciences, and general research.
- Public, semi-private, anonymous, and double-blind review modes with reviewer anonymization.
- Inline comments targeting documents, datasets, code, notebooks, anchors, and line ranges.
- Timestamped contributor credit records with validated CRediT roles and stable hashes.
- Git-style contributor graph aggregation by researcher and project.
- Transparent researcher score components for citations, forks, endorsements, peer review, reproducibility, bounties, contribution credit, and moderation penalties.
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
  "topBiologyResearcher": {
    "researcherId": "u-ada",
    "tier": "open-science-champion"
  },
  "packetHash": "..."
}
```

## Demo Artifact

See [docs/demo.gif](docs/demo.gif) for a short visual walkthrough. The SVG source is included at [docs/demo.svg](docs/demo.svg).

## Files

- `src/community-reputation-ledger.js` - peer reviews, comments, contribution ledger, contributor graph, reputation scores, leaderboards.
- `data/sample-community.json` - reviewable community fixture.
- `test/community-reputation-ledger.test.js` - dependency-free Node tests.
- `scripts/demo.js` - CLI demo.
- `docs/issue-15-requirement-map.md` - maps the implementation to bounty requirements.

## AI-Assisted Disclosure

This contribution was produced with AI assistance and manually verified with the local commands above.
