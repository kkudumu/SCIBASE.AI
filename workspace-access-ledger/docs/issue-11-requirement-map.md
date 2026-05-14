# Issue #11 Requirement Map

This module is a deterministic milestone for SCIBASE issue #11, User & Project Management. It focuses on identity, researcher profiles, project-space access policies, invitations, and audit governance.

| Issue requirement | Implementation |
| --- | --- |
| Email/OAuth/ORCID/SAML identity | `buildUnifiedIdentity()` models linked provider identities, ORCID links, SAML links, MFA, and anonymous mode. |
| 2FA and anonymous-mode safeguards | `buildIdentitySecurityReview()` flags privileged project roles without MFA and anonymous users with write-capable membership. |
| Researcher profiles | `buildResearcherProfile()` summarizes institution, field, keywords, ORCID sync, activity, citations-style metrics, and reputation. |
| Project spaces | Sample projects include manuscripts, code/dataset policy objects, visibility, institution binding, members, and object rules. |
| Visibility settings | `evaluateAccess()` supports public, private, institutional-only, and role/object-rule paths. |
| Role-based access | Role ranks cover Owner, Admin, Contributor, Reviewer, and Viewer. |
| Object-level control | Project policies and `objectRules` can allow or deny actions such as dataset read/download independently of role defaults. |
| External collaborator invitations | `createInvitation()` creates time-limited invitation records with role and read-only state. |
| Audit log | `appendAuditEvent()` appends hashed audit events. |
| Reputation metrics | Dashboard profiles include downloads, forks, endorsements, peer reviews, collaborations, and reproducibility score. |
| Reviewer demo | `npm run demo` prints identity summary, access decisions, and dashboard hash for `data/sample-workspace.json`. |

## Verification

```bash
npm run check
npm test
npm run demo
```

The module is dependency-free and isolated under `workspace-access-ledger/`.
