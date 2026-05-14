# AI Research MVP Tools

Self-contained AI-assisted research tools milestone for [SCIBASE.AI issue #13](https://github.com/SCIBASE-AI/SCIBASE.AI/issues/13).

The issue asks for paper summaries, pre-review diagnostics, and citation assistance. This module provides deterministic local versions of those workflows so reviewers can run the MVP without model keys, retrieval credentials, or external services.

## What It Adds

- Paper summaries in abstract, executive, and layperson modes.
- Key findings, implications, next steps, and keyword extraction.
- Domain-specific review templates for biology, physics, social sciences, and general manuscripts.
- Pre-review diagnostics for missing required sections, ethics/data availability gaps, statistical reporting gaps, clarity signals, and similarity evidence.
- Similarity signal against a local open-access corpus fixture.
- Citation recommendations ranked by manuscript keyword overlap, recency, and citation signal.
- Highlighted-text citation recommendations with evidence hashes for selected manuscript spans.
- Similar-papers widget combining open-access similarity signals and citation-corpus matches with reasons and actions.
- Claim-support report that extracts manuscript claim sentences, matches citation evidence, and returns insert-or-revise actions with evidence-span hashes.
- APA, MLA, and Nature-style reference formatting.
- One-click citation insert-action metadata plus drag payloads and target anchors for manuscript insertion.
- Sample manuscript/corpus fixture, tests, requirement map, CLI demo, and short demo GIF.

## Run

```bash
cd ai-research-mvp-tools
npm run check
npm test
npm run demo
```

Expected demo shape:

```json
{
  "summaryModes": ["abstract", "executive", "layperson"],
  "qualityScore": 55,
  "reviewFindings": ["compliance:...", "statistics:..."],
  "topCitation": {
    "doi": "10.1016/j.watres.2025.120001"
  },
  "highlightedCitation": {
    "doi": "10.1016/j.watres.2025.120001"
  },
  "citationInsertionPlan": {
    "targetAnchor": "manuscript:results:p3",
    "insertions": 2
  },
  "similarPapers": [
    {
      "source": "open-access-corpus",
      "action": {
        "type": "open-similar-paper"
      }
    }
  ],
  "claimSupport": {
    "claims": 4,
    "unsupportedCount": 0,
    "recommendedCitationCount": 3
  },
  "insertActions": 2,
  "packetHash": "..."
}
```

## Demo Artifact

See [docs/demo.gif](docs/demo.gif) for a short visual walkthrough. The SVG source is included at [docs/demo.svg](docs/demo.svg).

## Files

- `src/ai-research-mvp-tools.js` - summarization, review diagnostics, similarity, citation ranking, highlighted-text citation support, insertion planning, claim support, formatting.
- `data/sample-research.json` - reviewable manuscript, open-access corpus, and citation corpus fixture.
- `test/ai-research-mvp-tools.test.js` - dependency-free Node tests.
- `scripts/demo.js` - CLI demo.
- `docs/issue-13-requirement-map.md` - maps the implementation to bounty requirements.

## AI-Assisted Disclosure

This contribution was produced with AI assistance and manually verified with the local commands above.
