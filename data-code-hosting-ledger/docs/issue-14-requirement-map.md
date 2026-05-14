# Issue #14 Requirement Map

This module implements a deterministic scientific data and code hosting milestone for SCIBASE issue #14. It focuses on storage manifests, artifact previews, metadata standards, FAIR scoring, executable environments, and reproducibility triggers.

| Issue requirement | Implementation |
| --- | --- |
| Support major scientific file types | `FILE_TYPES` and `classifyArtifact()` cover CSV, TSV, XLSX, JSON, Parquet, Python, R, Julia, notebooks, images, video, and model files. |
| Folder-based organization and upload manifest | `buildStorageManifest()` groups artifacts by folder, category, size, version, content hash, and tags. |
| Metadata-aware previews | `createPreviewPlan()` emits preview routes for spreadsheets, JSON, notebooks, code, images, video, and model cards. |
| Upload versioning and dataset diffing | Artifact versions are tracked in the manifest, and `diffDatasetVersions()` reports added, removed, and changed rows. |
| JSON-LD, DataCite, and schema.org metadata | `buildMetadataBundle()` emits JSON-LD, DataCite-style, and schema.org metadata from workspace metadata. |
| FAIR principles compliance | `scoreFairCompliance()` scores findable, accessible, interoperable, and reusable dimensions with blockers. |
| Scientific tagging and identifiers | Metadata bundle uses DOI/UUID identifiers plus keyword tags; artifacts preserve tags. |
| Persistent deposit and reuse package | `buildPreservationPackage()` prepares DataCite DOI registration, repository export, schema.org indexing, required metadata gates, package-file hashes, and persistent access URLs. |
| Container-based executable environments | `resolveRuntimeEnvironment()` and `buildExecutionPlan()` map code/notebooks to Docker image/runtime definitions. |
| Sandboxed execution controls | `buildSandboxPolicy()` attaches Docker isolation, resource limits, network controls, read-only inputs, writable output paths, and blocked privileged actions to each runtime. |
| Run analysis, reproduce results, and scheduled reruns | `buildExecutionPlan()` emits manual and cron-style triggers. |
| Programmatic access | `buildHostingPacket()` includes API route contracts for uploads, previews, DataCite metadata, preservation package, runs, and FAIR score. |
| Reviewer demo | `npm run demo` prints artifact categories, FAIR score, preview kinds, runtimes, dataset diff counts, and packet hash. |

## Verification

```bash
npm run check
npm test
npm run demo
```

The module is dependency-free and isolated under `data-code-hosting-ledger/`.
