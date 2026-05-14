# Issue #10 Requirement Map

This module is a deterministic milestone for SCIBASE issue #10, Project Repository & Version Control. It focuses on repository manifests, content integrity, commit/tag metadata, forks, merge requests, reproducibility checks, release readiness, citations, and export bundles.

| Issue requirement | Implementation |
| --- | --- |
| Repository structure and components | `buildComponentManifest()` validates manuscript, data, code, notebooks, results, protocols, and metadata components. |
| Git LFS and content integrity | Components receive hashes and large data files are marked as LFS candidates. |
| Version control and commit history | `createCommit()` creates parent-linked commits with changed component lists and commit hashes. |
| Semantic versioning and tags | `createSemanticTag()` attaches semantic tags, DOI metadata, and tag hashes to commits. |
| Forking and attribution | `buildForkRecord()` records source repository, source DOI, authors, base commit, and fork hash. |
| Merge requests and review | `evaluateMergeRequest()` checks source/target commits, discussions, approvals, and data-change reproducibility blockers. |
| Branch protection and review gates | `buildBranchProtectionReport()` reports protected branches, required reviews, required status checks, force-push policy, stale branch blockers, and unknown-head blockers. |
| In-browser editors and diffs | `buildEditorDiffSummary()` maps components to scientific text, Jupyter notebook, structured-data, code-aware, or hash-only editor/diff modes. |
| Visual revision timeline and rollback | `buildEditorDiffSummary()` emits a commit rollback timeline with deterministic restore commands. |
| Reproducibility pipelines | `evaluateReproducibility()` reports execution environment, check pass rate, status, and reproducibility hash. |
| Dataset diffs and release gates | `buildDatasetDiffSummary()` and `buildReleaseReadiness()` report data change risk plus required component, semantic tag, DOI, reproducibility, export API, and CLI gates before release. |
| Repository identifiers and citation | `generateCitation()` produces APA and BibTeX-style citations from repository/tag metadata. |
| Programmatic access and export | `buildExportBundle()` emits API routes, CLI commands, manifest, reproducibility status, and export bundle hash. |
| Reviewer demo | `npm run demo` prints manifest, LFS components, reproducibility status, mergeability, release gates, citation, and bundle hash. |

## Verification

```bash
npm run check
npm test
npm run demo
```

The module is dependency-free and isolated under `repository-integrity-ledger/`.
