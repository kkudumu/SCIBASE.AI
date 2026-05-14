# Issue #13 Requirement Map

This module implements deterministic AI-assisted research MVP tools for SCIBASE issue #13. It focuses on paper summaries, pre-review diagnostics, citation recommendations, formatting, and one-click insertion metadata without requiring live model or retrieval services.

| Issue requirement | Implementation |
| --- | --- |
| AI paper summarizer | `summarizePaper()` ranks document sentences by domain keywords and emits abstract, executive, and layperson modes. |
| Key findings, implications, and next steps | `summarizePaper()` includes extracted finding, implication, and next-step sentence lists. |
| Scientific-domain-aware output | `reviewManuscript()` selects biology, physics, social-sciences, or general templates with domain-specific checks. |
| AI peer review aid | `reviewManuscript()` emits diagnostics for missing sections, statistical reporting gaps, clarity signals, compliance issues, and similarity matches. |
| Plagiarism/similarity signal | `detectSimilarity()` compares manuscript terms against an open-access corpus fixture and reports overlapping evidence. |
| Statistical error detection | `reviewManuscript()` flags p-values without confidence intervals and missing template-specific statistical reporting. |
| Compliance checks | Domain templates require sections such as ethics and data availability. |
| AI citation tool | `recommendCitations()` ranks citation candidates by keyword overlap, recency, and citation signal while excluding already cited DOIs. |
| Similar papers widget | `buildSimilarPapersWidget()` combines open-access similarity evidence and citation-corpus matches into ranked recommendations with user actions. |
| Context-aware citation support | `buildClaimSupportReport()` extracts claim sentences, scores supporting citation candidates, classifies support status, and returns insert-or-revise actions with evidence-span hashes. |
| Auto-formatted references | `formatReference()` supports APA, MLA, and Nature-style output. |
| One-click insert metadata | `buildResearchToolsPacket()` returns `insertActions` for citation insertion. |
| Reviewer demo | `npm run demo` prints summary modes, review findings, top citation, insert-action count, and packet hash. |

## Verification

```bash
npm run check
npm test
npm run demo
```

The module is dependency-free and isolated under `ai-research-mvp-tools/`.
