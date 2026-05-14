"use strict";

const assert = require("assert");
const workspace = require("../data/sample-workspace.json");
const {
  buildExecutionPlan,
  buildHostingPacket,
  buildMetadataBundle,
  buildPreservationPackage,
  buildSandboxPolicy,
  buildStorageManifest,
  classifyArtifact,
  createPreviewPlan,
  diffDatasetVersions,
  resolveRuntimeEnvironment,
  scoreFairCompliance,
} = require("../src/data-code-hosting-ledger");

function testStorageManifest() {
  const manifest = buildStorageManifest(workspace);
  const csv = classifyArtifact(workspace.artifacts[0]);

  assert.strictEqual(csv.category, "dataset");
  assert.strictEqual(csv.preview, "spreadsheet");
  assert.strictEqual(manifest.categories.dataset, 2);
  assert.ok(manifest.folders.includes("data"));
  assert.ok(manifest.manifestHash);
}

function testMetadataAndFairScore() {
  const metadata = buildMetadataBundle(workspace);
  const fair = scoreFairCompliance(workspace);

  assert.deepStrictEqual(metadata.missingRequiredFields, []);
  assert.strictEqual(metadata.jsonLd["@context"], "https://schema.org");
  assert.strictEqual(metadata.dataCite.doi, workspace.metadata.doi);
  assert.ok(fair.total >= 0.9);
  assert.deepStrictEqual(fair.blockers, []);
}

function testPreviewsAndDiffs() {
  const previews = createPreviewPlan(workspace);
  const diff = diffDatasetVersions(
    [
      { id: "s1", value: 1 },
      { id: "s2", value: 2 },
    ],
    [
      { id: "s1", value: 1.5 },
      { id: "s3", value: 3 },
    ],
  );

  assert.ok(previews.some((preview) => preview.preview === "notebook"));
  assert.strictEqual(diff.added.length, 1);
  assert.strictEqual(diff.removed.length, 1);
  assert.strictEqual(diff.changed.length, 1);
}

function testExecutionPlan() {
  const runtime = resolveRuntimeEnvironment(workspace, "artifact-notebook");
  const plan = buildExecutionPlan(workspace);

  assert.strictEqual(runtime.stack, "python");
  assert.strictEqual(runtime.sandbox, true);
  assert.strictEqual(runtime.sandboxPolicy.networkAccess, false);
  assert.ok(runtime.sandboxPolicy.blockedActions.includes("privileged-container"));
  assert.ok(runtime.command.includes("jupyter"));
  assert.ok(plan.triggers.some((trigger) => trigger.id === "scheduled-refresh"));
  assert.strictEqual(plan.runtimes.length, 2);
}

function testSandboxPolicy() {
  const policy = buildSandboxPolicy(workspace, "artifact-analysis");

  assert.strictEqual(policy.enabled, true);
  assert.strictEqual(policy.isolation, "docker");
  assert.deepStrictEqual(policy.resourceLimits, { cpu: "2", memory: "4Gi", timeoutSeconds: 1800 });
  assert.ok(policy.readOnlyArtifactIds.includes("artifact-samples-v1"));
  assert.ok(policy.writablePaths.includes("outputs/"));
  assert.ok(policy.policyHash);
}

function testPreservationPackage() {
  const preservation = buildPreservationPackage(workspace);

  assert.strictEqual(preservation.identifier, workspace.metadata.doi);
  assert.ok(preservation.requiredGates.every((gate) => gate.passed));
  assert.ok(preservation.packageFiles.some((file) => file.path === "metadata/datacite.json"));
  assert.ok(preservation.packageFiles.some((file) => file.path === "metadata/schema-org.jsonld"));
  assert.ok(preservation.packageFiles.some((file) => file.path.startsWith("artifacts/data/")));
  assert.ok(preservation.depositTargets.every((target) => target.ready));
  assert.ok(preservation.preservationHash.length >= 12);
}

function testPacket() {
  const packet = buildHostingPacket(workspace);

  assert.strictEqual(packet.workspace.id, workspace.id);
  assert.ok(packet.apiRoutes.some((route) => route.includes("fair-score")));
  assert.ok(packet.apiRoutes.some((route) => route.includes("preservation-package")));
  assert.strictEqual(packet.preservation.workspaceId, workspace.id);
  assert.ok(packet.packetHash.length >= 12);
}

testStorageManifest();
testMetadataAndFairScore();
testPreviewsAndDiffs();
testExecutionPlan();
testSandboxPolicy();
testPreservationPackage();
testPacket();

console.log("data-code-hosting-ledger tests passed");
