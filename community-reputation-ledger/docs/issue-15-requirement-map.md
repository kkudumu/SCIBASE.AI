# Issue #15 Requirement Map

This module implements a deterministic community and reputation milestone for SCIBASE issue #15. It focuses on structured peer review, inline comments, contributor credit, transparent scoring, leaderboards, badges, and incentive tiers.

| Issue requirement | Implementation |
| --- | --- |
| Structured peer reviews | `selectReviewTemplate()` and `createPeerReview()` support discipline-specific criteria, scores, narrative fields, recommendations, and review history hashes. |
| Public, semi-private, anonymous, and double-blind modes | `createPeerReview()` normalizes review visibility and anonymizes reviewer identity for anonymous and double-blind reviews. |
| Inline comments on documents, datasets, code blocks, and notebooks | `createInlineComment()` stores target kind, path, anchors, line ranges, visibility mode, status, and comment hashes. |
| Timestamped contributor credits | `buildContributionLedger()` creates timestamped contribution records with stable hashes and citation visibility. |
| CRediT taxonomy support | Contribution roles are validated against the CRediT role list exported as `CREDIT_ROLES`. |
| Git-style contributor graphs | `buildContributorGraph()` aggregates contributor/project edges, role counts, contribution counts, and credit totals. |
| Transparent reputation metrics | `scoreResearcher()` exposes score components for citations, forks, endorsements, peer review, reproducibility badges, bounty completions, contribution credit, and penalties. |
| Abuse-resistant moderation hooks | `buildModerationSignals()` flags self-endorsements, reciprocal endorsements, thin review narratives, and flagged researcher metrics before scores are trusted. |
| Leaderboards by domain, region, and institution | `buildLeaderboards()` groups researchers by a requested dimension and ranks them deterministically. |
| Badge and incentive tiers | `assignBadges()` and `assignTier()` surface Trusted Reviewer, Reproducibility Verified, Challenge Finisher, and Open Science Champion outcomes through `scoreResearcher()`. |
| Reviewer demo | `npm run demo` prints review counts, contribution counts, top-ranked researcher, incentive tiers, and packet hash. |

## Verification

```bash
npm run check
npm test
npm run demo
```

The module is dependency-free and isolated under `community-reputation-ledger/`.
