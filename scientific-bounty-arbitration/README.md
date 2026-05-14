# Scientific Bounty Arbitration

Self-contained scientific bounty trust-layer milestone for [SCIBASE.AI issue #18](https://github.com/SCIBASE-AI/SCIBASE.AI/issues/18).

The issue asks for a full scientific bounty system. This module focuses on a distinct and reviewable slice: validating a challenge, packaging submissions, detecting reviewer conflicts, scoring eligible reviews, recording arbitration decisions, and producing payout/IP readiness records.

## What It Adds

- Challenge validation for required posting fields and rubric integrity.
- Submission manifest builder that maps artifacts to deliverables and records hashes.
- Reviewer conflict detection for sponsor affiliation, submission team membership, and collaborator overlap.
- Weighted rubric scoring using only eligible independent reviews.
- Arbitration record with blocker reasons, final score, decision status, and decision log hash.
- Payout plan with milestone schedule, team splits, payout readiness, and IP transfer status.
- Sample bounty fixture, tests, requirement map, CLI demo, and short demo GIF.

## Run

```bash
cd scientific-bounty-arbitration
npm run check
npm test
npm run demo
```

Expected demo shape:

```json
{
  "challenge": "Regional flood-risk forecasting model",
  "decision": "award-recommended",
  "finalScore": 86.95,
  "eligibleReviewers": 2,
  "payoutStatus": "ready",
  "payoutRoutes": [
    { "payeeId": "researcher-1", "amount": 600 },
    { "payeeId": "researcher-2", "amount": 400 }
  ]
}
```

## Demo Artifact

See [docs/demo.gif](docs/demo.gif) for a short visual walkthrough. The SVG source is included at [docs/demo.svg](docs/demo.svg).

## Files

- `src/arbitration.js` - challenge validation, manifests, scoring, arbitration, and payout planning.
- `data/sample-bounty.json` - reviewable scientific challenge/submission fixture.
- `test/arbitration.test.js` - dependency-free Node tests.
- `scripts/demo.js` - CLI demo.
- `docs/issue-18-requirement-map.md` - maps the implementation to bounty requirements.

## AI-Assisted Disclosure

This contribution was produced with AI assistance and manually verified with the local commands above.
