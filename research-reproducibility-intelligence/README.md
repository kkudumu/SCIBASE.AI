# Research Reproducibility Intelligence

Self-contained AI-powered research assistant suite milestone for [SCIBASE.AI issue #16](https://github.com/SCIBASE-AI/SCIBASE.AI/issues/16).

This module turns a scientific project packet into a deterministic assistant report covering auto peer-review, reproducibility checks, and research-gap discovery. It is designed for easy review: no API keys, no external services, no package install required beyond Node.js.

## What It Adds

- Auto peer-review report with manuscript structure checks, clarity findings, statistical reporting signals, and claim-to-evidence alignment.
- Reproducibility report with artifact fingerprinting, pinned dependency checks, runnable file detection, data dictionary/source data checks, and a runbook.
- Linked prior reproducibility attempts, sorted by current artifact fingerprint match and recency.
- Research-gap feed that ranks corpus items by relevance, replication gap, limitation signals, and novelty.
- Workflow orchestration that converts findings into staged, owner-assigned, evidence-hashed actions.
- Combined assistant packet with readiness score, orchestration status, and next-action queue.
- Sample project fixture, tests, requirement mapping, CLI demo, and short demo GIF.

## Run

```bash
cd research-reproducibility-intelligence
npm run check
npm test
npm run demo
```

Expected demo shape:

```json
{
  "project": "Longitudinal microbiome shifts after coastal flooding",
  "readinessScore": 71,
  "peerReviewScore": 62,
  "reproducibilityStatus": "reproducible",
  "workflowBlocked": true,
  "workflowRiskScore": 88,
  "topWorkflowAction": {
    "id": "review-1",
    "stage": "peer-review",
    "status": "blocking",
    "owner": "Dr. Chen"
  },
  "linkedAttempt": {
    "id": "attempt-2026-04-dry-run",
    "matchesCurrentArtifacts": true
  },
  "topResearchGap": {
    "paperId": "paper-1",
    "priority": 0.8
  }
}
```

## Demo Artifact

See [docs/demo.gif](docs/demo.gif) for a short visual walkthrough. The SVG source is included at [docs/demo.svg](docs/demo.svg).

## Files

- `src/research-assistant.js` - deterministic assistant engine.
- `data/sample-project.json` - reviewable project/corpus fixture.
- `test/research-assistant.test.js` - Node assertion tests.
- `scripts/demo.js` - CLI demo.
- `docs/issue-16-requirement-map.md` - maps implementation to bounty requirements.

## AI-Assisted Disclosure

This contribution was produced with AI assistance and manually verified with the local commands above.
