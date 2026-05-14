# Repository Integrity Ledger

Self-contained project repository and version-control milestone for [SCIBASE.AI issue #10](https://github.com/SCIBASE-AI/SCIBASE.AI/issues/10).

The issue asks for scientific project repositories with manifests, versioning, forks, merge requests, reproducibility checks, citations, and exports. This module provides a deterministic integrity ledger that reviewers can run locally without external Git, DOI, or storage services.

## What It Adds

- Repository component manifest for manuscript, data, code, notebooks, results, protocols, and metadata.
- Content hashes and Git LFS-style large-file candidate detection.
- Parent-linked commit records with changed components and commit hashes.
- Semantic tags with DOI metadata and citation generation.
- Fork attribution records preserving source DOI, authors, base commit, and fork hash.
- Merge-request evaluation for source/target existence, approvals, discussions, and reproducibility blockers.
- Branch protection report with protected-branch counts, required reviews, required status checks, force-push policy, stale branch detection, and head-commit validation.
- Editor/diff summary for scientific text, Jupyter notebooks, structured data, code-aware diffs, and rollback commands.
- Reproducibility run status with environment, check pass rate, and hash.
- Release readiness packet with required component, semantic tag, DOI, reproducibility, dataset-diff risk, export API, and CLI gates.
- Export bundle with manifest, reproducibility summary, API route list, CLI commands, and bundle hash.
- Sample repository fixture, tests, requirement map, CLI demo, and short demo GIF.

## Run

```bash
cd repository-integrity-ledger
npm run check
npm test
npm run demo
```

Expected demo shape:

```json
{
  "repository": "Coastal flooding microbiome atlas",
  "missingComponents": [],
  "lfsComponents": ["data/samples.csv"],
  "reproducibility": "passed",
  "mergeableRequests": 1,
  "branchProtection": {
    "protectedBranchCount": 1,
    "blockedBranchCount": 1
  },
  "editorModes": ["scientific-text", "structured-data", "code-aware"],
  "rollbackCommand": "scibase restore repo-flood-microbiome --commit commit-2",
  "releaseReadiness": {
    "status": "ready",
    "datasetDiffRisk": {
      "mediumRiskCount": 1
    }
  },
  "bundleHash": "..."
}
```

## Demo Artifact

See [docs/demo.gif](docs/demo.gif) for a short visual walkthrough. The SVG source is included at [docs/demo.svg](docs/demo.svg).

## Files

- `src/repository-ledger.js` - manifests, commits, tags, forks, merge requests, branch protection, reproducibility, release readiness, citation, exports.
- `data/sample-repository.json` - reviewable scientific repository fixture.
- `test/repository-ledger.test.js` - dependency-free Node tests.
- `scripts/demo.js` - CLI demo.
- `docs/issue-10-requirement-map.md` - maps the implementation to bounty requirements.

## AI-Assisted Disclosure

This contribution was produced with AI assistance and manually verified with the local commands above.
