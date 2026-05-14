# Issue #18 Requirement Map

This module is a distinct milestone for SCIBASE issue #18, Scientific Bounty System. It focuses on the trust layer needed after teams submit work: deliverable validation, arbitration, scoring, lifecycle gates, payout readiness, and IP-safe acceptance.

| Issue requirement | Implementation |
| --- | --- |
| Challenge posting portal requirements | `validateChallenge()` checks required problem, context, deliverables, rubric, timeline, prize, and IP fields before publication. |
| Evaluation criteria and scoring rubric | `scoreSubmission()` averages eligible reviewer scores across weighted rubric items and applies deliverable penalties. |
| Submission package builder | `buildSubmissionManifest()` maps artifacts to required deliverables and produces hashes for auditability. |
| Secure private submission workspace | `buildWorkspaceSecuritySummary()` checks private visibility, scoped team access, enabled version control, and audit-trail presence. |
| Version control and audit logs | Submission manifests preserve artifact hashes, version-control refs, audit trail references, and an audit-trail hash. |
| Arbitration workflow | `buildArbitrationRecord()` combines challenge validation, reviewer conflict checks, eligible reviews, score, blockers, and a decision log hash. |
| Third-party reviewers or peer validators | `detectReviewerConflicts()` marks reviewer eligibility and excludes sponsor/team/collaborator conflicts. |
| Feedback loop between submitters and sponsors | `buildSponsorFeedbackLoop()` exposes eligible reviewer comments/requested changes, submitter responses, due dates, open item counts, and feedback hashes. |
| Smart payout engine | `buildPayoutPlan()` routes prize splits, milestone schedule, payout readiness, and acceptance record hash. |
| Escrowed prize funds, milestone release, and honorable mentions | `buildChallengeLifecycleReport()`, `buildMilestoneReleasePlan()`, and `buildRewardDistributionLedger()` verify escrow funding, accepted milestone evidence, release amounts, honorable-mention recognitions, balanced committed totals, payout routes, and release instruction text. |
| IP management options | Payout planning distinguishes solver-retained IP from transfer-after-payout records. |
| Reviewer-friendly demo | `npm run demo` prints a deterministic sponsor summary, lifecycle gates, milestone releases, and payout routing for `data/sample-bounty.json`. |

## Verification

```bash
npm run check
npm test
npm run demo
```

The module is dependency-free and isolated under `scientific-bounty-arbitration/`.
