# Data and Code Hosting Ledger

Self-contained scientific data and code hosting milestone for [SCIBASE.AI issue #14](https://github.com/SCIBASE-AI/SCIBASE.AI/issues/14).

The issue asks for first-class hosting of datasets, code, notebooks, models, metadata, previews, and executable environments. This module provides a deterministic hosting ledger that reviewers can run locally without object storage, Kubernetes, or external DOI services.

## What It Adds

- Artifact classification for datasets, code, notebooks, images, videos, model files, and unknown files.
- Folder-aware storage manifest with content hashes, versions, tags, category counts, and total bytes.
- Metadata bundle with JSON-LD, DataCite-style metadata, and schema.org fields.
- FAIR compliance scoring across findable, accessible, interoperable, and reusable dimensions.
- Preview route planning for spreadsheets, JSON, notebooks, code, thumbnails, and model cards.
- Dataset row diffing for added, removed, and changed records.
- Runtime environment resolution for Python, R, Julia, notebooks, and generic artifacts.
- Execution plan with run-analysis, reproduce-results, and scheduled rerun triggers.
- API route contracts for uploads, previews, metadata, runs, and FAIR score.
- Sample workspace fixture, tests, requirement map, CLI demo, and short demo GIF.

## Run

```bash
cd data-code-hosting-ledger
npm run check
npm test
npm run demo
```

Expected demo shape:

```json
{
  "artifacts": 6,
  "fairScore": 0.9417,
  "previewKinds": ["code", "image-thumbnail", "model-card", "notebook", "spreadsheet"],
  "runtimes": ["python:python:3.12-slim"],
  "datasetDiff": {
    "added": 1,
    "changed": 1,
    "removed": 0
  },
  "packetHash": "..."
}
```

## Demo Artifact

See [docs/demo.gif](docs/demo.gif) for a short visual walkthrough. The SVG source is included at [docs/demo.svg](docs/demo.svg).

## Files

- `src/data-code-hosting-ledger.js` - artifact classification, manifests, metadata, FAIR score, previews, diffs, runtimes.
- `data/sample-workspace.json` - reviewable scientific workspace fixture.
- `test/data-code-hosting-ledger.test.js` - dependency-free Node tests.
- `scripts/demo.js` - CLI demo.
- `docs/issue-14-requirement-map.md` - maps the implementation to bounty requirements.

## AI-Assisted Disclosure

This contribution was produced with AI assistance and manually verified with the local commands above.
