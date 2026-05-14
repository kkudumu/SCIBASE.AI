# Issue #18 Requirement Map

This module is a distinct milestone for SCIBASE issue #18, Scientific Bounty System. It focuses on the trust layer needed after teams submit work: deliverable validation, arbitration, scoring, payout readiness, and IP-safe acceptance.

| Issue requirement | Implementation |
| --- | --- |
| Challenge posting portal requirements | `validateChallenge()` checks required problem, context, deliverables, rubric, timeline, prize, and IP fields before publication. |
| Evaluation criteria and scoring rubric | `scoreSubmission()` averages eligible reviewer scores across weighted rubric items and applies deliverable penalties. |
| Submission package builder | `buildSubmissionManifest()` maps artifacts to required deliverables and produces hashes for auditability. |
| Version control and audit logs | Submission manifests preserve artifact hashes and audit trail references. |
| Arbitration workflow | `buildArbitrationRecord()` combines challenge validation, reviewer conflict checks, eligible reviews, score, blockers, and a decision log hash. |
| Third-party reviewers or peer validators | `detectReviewerConflicts()` marks reviewer eligibility and excludes sponsor/team/collaborator conflicts. |
| Smart payout engine | `buildPayoutPlan()` routes prize splits, milestone schedule, payout readiness, and acceptance record hash. |
| IP management options | Payout planning distinguishes solver-retained IP from transfer-after-payout records. |
| Reviewer-friendly demo | `npm run demo` prints a deterministic sponsor summary for `data/sample-bounty.json`. |

## Verification

```bash
npm run check
npm test
npm run demo
```

The module is dependency-free and isolated under `scientific-bounty-arbitration/`.
