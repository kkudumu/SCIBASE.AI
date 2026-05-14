# Collaborative Editor Governance

Self-contained collaborative research editor governance milestone for [SCIBASE.AI issue #12](https://github.com/SCIBASE-AI/SCIBASE.AI/issues/12).

The issue asks for a real-time collaborative research editor. This module focuses on a reviewable core for deterministic operation replay and editorial governance: typed scientific blocks, locks, comments, suggestions, tasks, snapshots, collaborator presence, and publication outline export.

## What It Adds

- Scientific document blocks with Markdown/code metadata and section headings.
- Deterministic operation handling for block inserts, updates, deletes, comments, suggestions, and tasks.
- Section-lock enforcement that rejects edits from non-owners.
- Inline comment and suggestion state for peer review.
- Autosave/version snapshot with content hash and open review counts.
- Open-task dashboard and collaborator presence summary.
- Publication outline export with section block types, word counts, and export hash.
- Sample document fixture, tests, requirement map, CLI demo, and short demo GIF.

## Run

```bash
cd collaborative-editor-governance
npm run check
npm test
npm run demo
```

Expected demo shape:

```json
{
  "title": "Longitudinal microbiome shifts after coastal flooding",
  "acceptedOperations": 3,
  "rejectedOperations": 1,
  "readyForSubmission": false,
  "outlineHash": "..."
}
```

## Demo Artifact

See [docs/demo.gif](docs/demo.gif) for a short visual walkthrough. The SVG source is included at [docs/demo.svg](docs/demo.svg).

## Files

- `src/editor-governance.js` - operation replay, locks, snapshots, dashboard, and outline export.
- `data/sample-document.json` - reviewable scientific document fixture.
- `test/editor-governance.test.js` - dependency-free Node tests.
- `scripts/demo.js` - CLI demo.
- `docs/issue-12-requirement-map.md` - maps the implementation to bounty requirements.

## AI-Assisted Disclosure

This contribution was produced with AI assistance and manually verified with the local commands above.
