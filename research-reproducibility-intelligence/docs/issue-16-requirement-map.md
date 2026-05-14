# Issue #16 Requirement Map

This module is a deterministic milestone for SCIBASE issue #16, AI-Powered Research Assistant Suite. It provides local, reviewable implementations of the three requested capabilities without external APIs or model keys.

| Issue requirement | Implementation |
| --- | --- |
| Auto peer review reports | `buildPeerReviewReport()` checks manuscript structure, clarity risks, statistical reporting signals, and claim-to-evidence alignment. |
| Reproducibility checker | `buildReproducibilityReport()` evaluates README/runbook presence, pinned dependencies, runnable artifacts, data dictionary, source data, and produces a reproducibility runbook. |
| Research gap finder | `buildResearchGapFeed()` scans a corpus fixture for relevance, low replication count, limitation language, and novelty signals, then ranks opportunities. |
| Real-time insights and workflow automation | `buildAssistantPacket()` combines review, reproducibility, and gap discovery into one readiness score and action queue. |
| Reviewer-friendly local demo | `npm run demo` prints the assistant packet summary for `data/sample-project.json`. |
| Verification | `npm run check` and `npm test` run with Node built-ins only. |

## Design Notes

- The scoring is transparent and deterministic, which makes it suitable for review and regression testing.
- The module is isolated under `research-reproducibility-intelligence/`.
- It is intentionally credential-free. A future production integration can replace deterministic scoring with model-backed adapters while keeping the same report shape.
