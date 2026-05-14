# Issue #12 Requirement Map

This module is a deterministic milestone for SCIBASE issue #12, Real-time collaborative research editor & interface. It focuses on review governance and operation replay for scientific documents.

| Issue requirement | Implementation |
| --- | --- |
| Scientific document blocks | Blocks include `markdown`, `latex`, `code`, section IDs, headings, language metadata, and publication outline export. |
| Markdown and LaTeX formatting | `buildScientificFormattingSummary()` reports Markdown blocks and LaTeX/equation support from typed blocks and inline equation syntax. |
| Reference manager integration | Document references preserve provider metadata such as Zotero/BibTeX source, cited keys, and unresolved citations. |
| Publication templates | Publication template metadata captures style names and required sections for common journal formats. |
| Code snippet highlighting | Code blocks carry language metadata and are reported in the scientific formatting summary. |
| Real-time operation application | `applyOperation()` and `applyOperationBatch()` deterministically apply insert, update, delete, comment, suggestion, and task operations. |
| Comments and suggestions | Comment and suggestion operations are stored with block links, actor IDs, and open/pending status. |
| Section locks | `isSectionLocked()` rejects edits from non-owners while allowing the lock owner to edit. |
| Version history and autosave | `createVersionSnapshot()` records block count, open review items, content hash, and timestamp. |
| Task workflow | Task operations and dashboard open-task reporting support editorial handoff. |
| Collaborator presence | `buildPresenceSummary()` turns presence data into reviewer-ready cursor and staleness state. |
| Publication outline export | `exportPublicationOutline()` summarizes sections, block types, word counts, and export hash. |
| Reviewer demo | `npm run demo` prints accepted/rejected operation counts, snapshot, dashboard sections, and outline hash. |

## Verification

```bash
npm run check
npm test
npm run demo
```

The module is dependency-free and isolated under `collaborative-editor-governance/`.
