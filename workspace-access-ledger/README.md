# Workspace Access Ledger

Self-contained user and project management milestone for [SCIBASE.AI issue #11](https://github.com/SCIBASE-AI/SCIBASE.AI/issues/11).

The issue asks for identity, researcher profiles, scientific workspaces, permissions, invitations, and audit history. This module provides a deterministic governance slice that reviewers can run locally without external auth providers.

## What It Adds

- Unified identity summaries for email, ORCID, GitHub/OAuth, SAML, MFA, and anonymous mode.
- Identity security review that flags privileged roles without MFA and anonymous users with write-capable access.
- Researcher profiles with institution, field, keywords, ORCID sync, activity, citation-style metrics, and reputation score.
- Project-space access evaluation with visibility, RBAC, and object-level rules.
- Project lifecycle report with workspace components, citation/funding/institution metadata, archive approval, retention dates, and invitation expiry review.
- External collaborator invitations with role, read-only mode, expiry, and invitation hash.
- Collaborator onboarding plan with required identity providers, MFA gates, invite-acceptance route contracts, blocker reasons, and audit events.
- Hashed audit events for project access history.
- Workspace dashboard with identity coverage, profile metrics, project summary, lifecycle status, pending invitations, and access decision counts.
- Sample workspace fixture, tests, requirement map, CLI demo, and short demo GIF.

## Run

```bash
cd workspace-access-ledger
npm run check
npm test
npm run demo
```

Expected demo shape:

```json
{
  "workspace": "Microbiome Atlas Lab",
  "identitySummary": {
    "users": 3,
    "orcidLinked": 2,
    "samlLinked": 1
  },
  "identitySecurity": {
    "status": "ready"
  },
  "lifecycle": {
    "activeProjects": 1,
    "archivedProjects": 1,
    "incompleteProjects": 0
  },
  "onboarding": {
    "readyCount": 0,
    "blockedCount": 2
  },
  "allowedCount": 2,
  "deniedCount": 1
}
```

## Demo Artifact

See [docs/demo.gif](docs/demo.gif) for a short visual walkthrough. The SVG source is included at [docs/demo.svg](docs/demo.svg).

## Files

- `src/access-ledger.js` - identity, profiles, access policy, invitations, collaborator onboarding, project lifecycle, audit, dashboard.
- `data/sample-workspace.json` - reviewable workspace/project fixture.
- `test/access-ledger.test.js` - dependency-free Node tests.
- `scripts/demo.js` - CLI demo.
- `docs/issue-11-requirement-map.md` - maps implementation to bounty requirements.

## AI-Assisted Disclosure

This contribution was produced with AI assistance and manually verified with the local commands above.
