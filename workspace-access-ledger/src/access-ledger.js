"use strict";

const crypto = require("crypto");

const ROLE_RANK = {
  viewer: 1,
  reviewer: 2,
  contributor: 3,
  admin: 4,
  owner: 5,
};

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function hashRecord(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 18);
}

function normalizeWorkspace(workspace) {
  if (!workspace || typeof workspace !== "object") throw new TypeError("workspace must be an object");
  return {
    id: workspace.id || "workspace-unknown",
    name: workspace.name || "Unnamed workspace",
    users: asArray(workspace.users),
    projects: asArray(workspace.projects),
    invitations: asArray(workspace.invitations),
    auditLog: asArray(workspace.auditLog),
  };
}

function buildUnifiedIdentity(user) {
  const identities = asArray(user.identities);
  const providers = identities.map((identity) => identity.provider);
  return {
    userId: user.id,
    email: user.email,
    displayName: user.name || user.email,
    mfaEnabled: Boolean(user.mfaEnabled),
    anonymousMode: Boolean(user.anonymousMode),
    providers,
    hasOrcid: providers.includes("orcid"),
    hasInstitutionalSaml: providers.includes("saml"),
    identityHash: hashRecord({ userId: user.id, identities }),
  };
}

function buildResearcherProfile(user, activity) {
  const publications = asArray(activity.publications);
  const reviews = asArray(activity.reviews);
  const projects = asArray(activity.projects);
  const reproducibilityScore = Number(activity.reproducibilityScore || 0);
  const reputation =
    publications.length * 4 +
    reviews.length * 3 +
    projects.length * 2 +
    Math.round(reproducibilityScore * 20);

  return {
    userId: user.id,
    name: user.name,
    institution: user.institution || null,
    field: user.field || null,
    keywords: asArray(user.keywords),
    publicProfile: user.profileVisibility !== "private",
    syncedFromOrcid: asArray(user.identities).some((identity) => identity.provider === "orcid"),
    metrics: {
      publications: publications.length,
      peerReviews: reviews.length,
      collaborations: projects.length,
      downloads: Number(activity.downloads || 0),
      forks: Number(activity.forks || 0),
      endorsements: Number(activity.endorsements || 0),
      reproducibilityScore,
      reputation,
    },
  };
}

function buildIdentitySecurityReview(workspaceInput) {
  const workspace = normalizeWorkspace(workspaceInput);
  const findings = [];

  for (const user of workspace.users) {
    const identity = buildUnifiedIdentity(user);
    if (!identity.providers.includes("email")) {
      findings.push({
        userId: user.id,
        severity: "medium",
        type: "missing-email-identity",
        message: "User should have a verified email identity for account recovery.",
      });
    }
    if (identity.anonymousMode && identity.providers.some((provider) => provider !== "email")) {
      findings.push({
        userId: user.id,
        severity: "medium",
        type: "anonymous-linked-identity",
        message: "Anonymous mode should not expose linked external identities.",
      });
    }
  }

  for (const project of workspace.projects) {
    for (const member of asArray(project.members)) {
      const user = workspace.users.find((candidate) => candidate.id === member.userId);
      if (!user) continue;
      const roleRank = ROLE_RANK[member.role] || 0;
      if (roleRank >= ROLE_RANK.admin && !user.mfaEnabled) {
        findings.push({
          userId: user.id,
          projectId: project.id,
          severity: "high",
          type: "privileged-user-without-mfa",
          message: "Owner/admin project roles require MFA.",
        });
      }
      if (user.anonymousMode && roleRank >= ROLE_RANK.contributor) {
        findings.push({
          userId: user.id,
          projectId: project.id,
          severity: "high",
          type: "anonymous-write-access",
          message: "Anonymous users should not have write-capable project roles.",
        });
      }
    }
  }

  return {
    status: findings.some((finding) => finding.severity === "high") ? "needs-action" : "ready",
    findings,
    reviewHash: hashRecord(findings),
  };
}

function membershipFor(project, userId) {
  return asArray(project.members).find((member) => member.userId === userId) || null;
}

function visibilityAllows(project, user, action) {
  if (project.visibility === "public" && action === "read") return true;
  if (project.visibility === "institutional-only") {
    return (
      action === "read" &&
      Boolean(user.institution && project.institutionId && user.institutionId === project.institutionId)
    );
  }
  return false;
}

function evaluateAccess(workspaceInput, request) {
  const workspace = normalizeWorkspace(workspaceInput);
  const user = workspace.users.find((candidate) => candidate.id === request.userId);
  const project = workspace.projects.find((candidate) => candidate.id === request.projectId);
  if (!user || !project) {
    return { allowed: false, reason: "unknown-user-or-project" };
  }

  const member = membershipFor(project, user.id);
  const roleRank = member ? ROLE_RANK[member.role] || 0 : 0;
  const objectPolicy = project.policy && project.policy[request.objectType];
  const requiredRole = objectPolicy && objectPolicy[request.action];
  const requiredRank = ROLE_RANK[requiredRole || "viewer"] || 1;
  const explicitObjectRule = asArray(project.objectRules).find(
    (rule) =>
      rule.objectType === request.objectType &&
      rule.action === request.action &&
      asArray(rule.userIds).includes(user.id),
  );

  if (explicitObjectRule) {
    return {
      allowed: explicitObjectRule.effect === "allow",
      reason: `object-rule-${explicitObjectRule.effect}`,
      role: member ? member.role : null,
    };
  }

  if (requiredRole && roleRank >= requiredRank) {
    return { allowed: true, reason: "role-policy", role: member.role };
  }

  if (visibilityAllows(project, user, request.action)) {
    return { allowed: true, reason: "visibility-policy", role: member ? member.role : null };
  }

  return {
    allowed: false,
    reason: "insufficient-role",
    role: member ? member.role : null,
    requiredRole: requiredRole || "viewer",
  };
}

function createInvitation(workspaceInput, invitation) {
  const workspace = normalizeWorkspace(workspaceInput);
  const expiresAt = invitation.expiresAt || new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();
  const record = {
    id: invitation.id || `invite-${workspace.invitations.length + 1}`,
    email: invitation.email,
    projectId: invitation.projectId,
    role: invitation.role || "viewer",
    invitedBy: invitation.invitedBy,
    expiresAt,
    readOnly: Boolean(invitation.readOnly),
    status: "pending",
    invitationHash: hashRecord(invitation),
  };
  return {
    ...workspace,
    invitations: [...workspace.invitations, record],
  };
}

function appendAuditEvent(workspaceInput, event) {
  const workspace = normalizeWorkspace(workspaceInput);
  const record = {
    id: event.id || `audit-${workspace.auditLog.length + 1}`,
    actorId: event.actorId,
    projectId: event.projectId || null,
    action: event.action,
    target: event.target || null,
    createdAt: event.createdAt || new Date().toISOString(),
    eventHash: hashRecord(event),
  };
  return {
    ...workspace,
    auditLog: [...workspace.auditLog, record],
  };
}

function buildAccessDashboard(workspaceInput, activityByUser) {
  const workspace = normalizeWorkspace(workspaceInput);
  const identities = workspace.users.map(buildUnifiedIdentity);
  const profiles = workspace.users.map((user) => buildResearcherProfile(user, (activityByUser || {})[user.id] || {}));
  const mfaCoverage = identities.length
    ? Number((identities.filter((identity) => identity.mfaEnabled).length / identities.length).toFixed(4))
    : 0;
  const projectSummary = workspace.projects.map((project) => ({
    projectId: project.id,
    title: project.title,
    visibility: project.visibility,
    members: asArray(project.members).length,
    objectRules: asArray(project.objectRules).length,
  }));

  return {
    workspace: { id: workspace.id, name: workspace.name },
    identitySummary: {
      users: identities.length,
      mfaCoverage,
      orcidLinked: identities.filter((identity) => identity.hasOrcid).length,
      samlLinked: identities.filter((identity) => identity.hasInstitutionalSaml).length,
      anonymousEnabled: identities.filter((identity) => identity.anonymousMode).length,
    },
    profiles,
    projectSummary,
    identitySecurity: buildIdentitySecurityReview(workspace),
    pendingInvitations: workspace.invitations.filter((invitation) => invitation.status === "pending"),
    auditEvents: workspace.auditLog.length,
    dashboardHash: hashRecord({ identities, profiles, projectSummary, auditLog: workspace.auditLog }),
  };
}

function buildWorkspaceAccessPacket(workspaceInput, activityByUser, accessRequests) {
  const workspace = normalizeWorkspace(workspaceInput);
  const dashboard = buildAccessDashboard(workspace, activityByUser);
  const decisions = asArray(accessRequests).map((request) => ({
    request,
    decision: evaluateAccess(workspace, request),
  }));
  return {
    dashboard,
    decisions,
    allowedCount: decisions.filter((item) => item.decision.allowed).length,
    deniedCount: decisions.filter((item) => !item.decision.allowed).length,
  };
}

module.exports = {
  ROLE_RANK,
  appendAuditEvent,
  buildAccessDashboard,
  buildIdentitySecurityReview,
  buildResearcherProfile,
  buildUnifiedIdentity,
  buildWorkspaceAccessPacket,
  createInvitation,
  evaluateAccess,
  hashRecord,
  normalizeWorkspace,
};
