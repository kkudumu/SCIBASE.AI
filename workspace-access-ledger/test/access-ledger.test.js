"use strict";

const assert = require("assert");
const sample = require("../data/sample-workspace.json");
const {
  appendAuditEvent,
  buildAccessDashboard,
  buildResearcherProfile,
  buildUnifiedIdentity,
  buildWorkspaceAccessPacket,
  createInvitation,
  evaluateAccess,
} = require("../src/access-ledger");

function testUnifiedIdentity() {
  const identity = buildUnifiedIdentity(sample.workspace.users[0]);

  assert.strictEqual(identity.hasOrcid, true);
  assert.strictEqual(identity.hasInstitutionalSaml, true);
  assert.strictEqual(identity.mfaEnabled, true);
}

function testResearcherProfile() {
  const profile = buildResearcherProfile(
    sample.workspace.users[0],
    sample.activityByUser["u-owner"],
  );

  assert.strictEqual(profile.publicProfile, true);
  assert.ok(profile.metrics.reputation > 0);
  assert.strictEqual(profile.syncedFromOrcid, true);
}

function testAccessDecisions() {
  const allowed = evaluateAccess(sample.workspace, sample.accessRequests[0]);
  const denied = evaluateAccess(sample.workspace, sample.accessRequests[1]);
  const publicRead = evaluateAccess(sample.workspace, sample.accessRequests[2]);
  const unknownPolicy = evaluateAccess(sample.workspace, {
    userId: "u-owner",
    projectId: "project-private",
    objectType: "unregistered-object",
    action: "write",
  });
  const institutionalWrite = evaluateAccess(
    {
      ...sample.workspace,
      projects: [
        {
          id: "institutional-project",
          visibility: "institutional-only",
          institutionId: "northstar",
          members: [],
          policy: {},
          objectRules: [],
        },
      ],
    },
    {
      userId: "u-owner",
      projectId: "institutional-project",
      objectType: "manuscript",
      action: "write",
    },
  );

  assert.strictEqual(allowed.allowed, true);
  assert.strictEqual(allowed.reason, "object-rule-allow");
  assert.strictEqual(denied.allowed, false);
  assert.strictEqual(publicRead.allowed, true);
  assert.strictEqual(publicRead.reason, "visibility-policy");
  assert.strictEqual(unknownPolicy.allowed, false);
  assert.strictEqual(institutionalWrite.allowed, false);
}

function testInvitationAndAudit() {
  const invited = createInvitation(sample.workspace, {
    email: "new@example.edu",
    projectId: "project-private",
    role: "viewer",
    invitedBy: "u-owner",
    readOnly: true,
  });
  const audited = appendAuditEvent(invited, {
    actorId: "u-owner",
    projectId: "project-private",
    action: "invitation.created",
    target: "new@example.edu",
  });

  assert.strictEqual(invited.invitations.length, 2);
  assert.strictEqual(audited.auditLog.length, 3);
  assert.ok(audited.auditLog[2].eventHash);
}

function testDashboard() {
  const dashboard = buildAccessDashboard(sample.workspace, sample.activityByUser);

  assert.strictEqual(dashboard.identitySummary.users, 3);
  assert.strictEqual(dashboard.identitySummary.orcidLinked, 2);
  assert.strictEqual(dashboard.pendingInvitations.length, 1);
  assert.ok(dashboard.dashboardHash.length >= 12);
}

function testFullPacket() {
  const packet = buildWorkspaceAccessPacket(
    sample.workspace,
    sample.activityByUser,
    sample.accessRequests,
  );

  assert.strictEqual(packet.allowedCount, 2);
  assert.strictEqual(packet.deniedCount, 1);
  assert.strictEqual(packet.decisions.length, 3);
}

testUnifiedIdentity();
testResearcherProfile();
testAccessDecisions();
testInvitationAndAudit();
testDashboard();
testFullPacket();

console.log("workspace-access-ledger tests passed");
