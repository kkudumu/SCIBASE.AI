"use strict";

const crypto = require("crypto");

const REQUIRED_COMPONENTS = [
  "manuscript",
  "data",
  "code",
  "notebooks",
  "results",
  "protocols",
  "metadata",
];

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function hashRecord(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 20);
}

function normalizeRepository(repository) {
  if (!repository || typeof repository !== "object") {
    throw new TypeError("repository must be an object");
  }
  return {
    id: repository.id || "repo-unknown",
    title: repository.title || "Untitled scientific repository",
    metadata: repository.metadata || {},
    components: asArray(repository.components),
    commits: asArray(repository.commits),
    branches: asArray(repository.branches),
    tags: asArray(repository.tags),
    forks: asArray(repository.forks),
    mergeRequests: asArray(repository.mergeRequests),
    reproducibilityRuns: asArray(repository.reproducibilityRuns),
    releasePolicy: repository.releasePolicy || {},
    branchProtection: repository.branchProtection || {},
  };
}

function buildComponentManifest(repositoryInput) {
  const repository = normalizeRepository(repositoryInput);
  const components = repository.components.map((component) => ({
    id: component.id,
    kind: component.kind,
    path: component.path,
    sizeBytes: Number(component.sizeBytes || 0),
    lfs: Number(component.sizeBytes || 0) > 10_000_000 || Boolean(component.lfs),
    hash: component.hash || hashRecord({
      kind: component.kind,
      path: component.path,
      content: component.content || "",
      sizeBytes: component.sizeBytes || 0,
    }),
    schema: component.schema || null,
  }));
  const presentKinds = new Set(components.map((component) => component.kind));

  return {
    repositoryId: repository.id,
    components,
    missingRequiredKinds: REQUIRED_COMPONENTS.filter((kind) => !presentKinds.has(kind)),
    manifestHash: hashRecord({ repositoryId: repository.id, components }),
  };
}

function createCommit(repositoryInput, commitInput) {
  const repository = normalizeRepository(repositoryInput);
  const parent = repository.commits.at(-1);
  const changedComponents = asArray(commitInput.changedComponents);
  const commit = {
    id: commitInput.id || `commit-${repository.commits.length + 1}`,
    parentId: commitInput.parentId || (parent && parent.id) || null,
    authorId: commitInput.authorId,
    message: commitInput.message || "Update scientific repository",
    changedComponents,
    createdAt: commitInput.createdAt || new Date().toISOString(),
  };
  commit.commitHash = hashRecord({
    parentId: commit.parentId,
    authorId: commit.authorId,
    message: commit.message,
    changedComponents,
    createdAt: commit.createdAt,
  });

  return {
    ...repository,
    commits: [...repository.commits, commit],
  };
}

function createSemanticTag(repositoryInput, tagInput) {
  const repository = normalizeRepository(repositoryInput);
  const commit = repository.commits.find((candidate) => candidate.id === tagInput.commitId);
  if (!commit) throw new Error(`unknown commit: ${tagInput.commitId}`);

  const tag = {
    id: tagInput.id || tagInput.version,
    version: tagInput.version,
    label: tagInput.label || tagInput.version,
    commitId: commit.id,
    doi: tagInput.doi || null,
    citationStyle: tagInput.citationStyle || "apa",
    tagHash: hashRecord({ version: tagInput.version, commitHash: commit.commitHash }),
  };

  return {
    ...repository,
    tags: [...repository.tags, tag],
  };
}

function buildForkRecord(repositoryInput, forkInput) {
  const repository = normalizeRepository(repositoryInput);
  return {
    id: forkInput.id,
    sourceRepositoryId: repository.id,
    forkRepositoryId: forkInput.forkRepositoryId,
    createdBy: forkInput.createdBy,
    attribution: {
      sourceTitle: repository.title,
      sourceDoi: repository.metadata.doi || null,
      sourceAuthors: asArray(repository.metadata.authors),
    },
    baseCommitId: forkInput.baseCommitId || (repository.commits.at(-1) && repository.commits.at(-1).id),
    forkHash: hashRecord({ sourceRepositoryId: repository.id, forkInput }),
  };
}

function evaluateMergeRequest(repositoryInput, mergeRequestInput) {
  const repository = normalizeRepository(repositoryInput);
  const sourceCommit = repository.commits.find((commit) => commit.id === mergeRequestInput.sourceCommitId);
  const targetCommit = repository.commits.find((commit) => commit.id === mergeRequestInput.targetCommitId);
  const discussionCount = asArray(mergeRequestInput.discussions).length;
  const approvals = asArray(mergeRequestInput.reviews).filter((review) => review.state === "approved");
  const blockingChanges = asArray(mergeRequestInput.changedComponents).filter(
    (component) => component.kind === "data" && !component.reproducibilityRunId,
  );

  return {
    id: mergeRequestInput.id,
    repositoryId: repository.id,
    sourceCommitId: mergeRequestInput.sourceCommitId,
    targetCommitId: mergeRequestInput.targetCommitId,
    sourceExists: Boolean(sourceCommit),
    targetExists: Boolean(targetCommit),
    discussionCount,
    approvals: approvals.length,
    blockingChanges,
    mergeable: Boolean(sourceCommit && targetCommit && approvals.length > 0 && blockingChanges.length === 0),
  };
}

function evaluateReproducibility(repositoryInput) {
  const repository = normalizeRepository(repositoryInput);
  const latest = repository.reproducibilityRuns.at(-1);
  if (!latest) {
    return {
      status: "missing",
      checks: [],
      reproducibilityHash: hashRecord({ repositoryId: repository.id, runs: [] }),
    };
  }
  const checks = asArray(latest.checks);
  if (checks.length === 0) {
    return {
      status: "missing",
      runId: latest.id,
      environment: latest.environment || null,
      checks,
      passRate: 0,
      reproducibilityHash: hashRecord({ repositoryId: repository.id, latest }),
    };
  }
  const passed = checks.filter((check) => check.status === "passed").length;
  return {
    status: passed === checks.length ? "passed" : passed >= Math.ceil(checks.length / 2) ? "partial" : "failed",
    runId: latest.id,
    environment: latest.environment || null,
    checks,
    passRate: checks.length ? Number((passed / checks.length).toFixed(4)) : 0,
    reproducibilityHash: hashRecord({ repositoryId: repository.id, latest }),
  };
}

function editorModeFor(component) {
  const path = String(component.path || "").toLowerCase();
  if (component.kind === "manuscript" || /\.(md|tex)$/.test(path)) return "scientific-text";
  if (component.kind === "notebooks" || path.endsWith(".ipynb")) return "jupyter-notebook";
  if (component.kind === "data" || /\.(csv|tsv|json|parquet)$/.test(path)) return "structured-data";
  if (component.kind === "code" || /\.(py|r|jl|js|ts)$/.test(path)) return "code-aware";
  return "binary-or-metadata";
}

function diffModeFor(component) {
  const path = String(component.path || "").toLowerCase();
  if (component.kind === "data" || /\.(csv|tsv|json|parquet)$/.test(path)) return "rich-data-diff";
  if (component.kind === "notebooks" || path.endsWith(".ipynb")) return "notebook-output-diff";
  if (component.kind === "code" || /\.(py|r|jl|js|ts)$/.test(path)) return "code-aware-diff";
  if (component.kind === "manuscript" || /\.(md|tex)$/.test(path)) return "text-diff";
  return "hash-only-diff";
}

function buildEditorDiffSummary(repositoryInput) {
  const repository = normalizeRepository(repositoryInput);
  const componentsById = new Map(repository.components.map((component) => [component.id, component]));
  const componentEditors = repository.components.map((component) => ({
    componentId: component.id,
    path: component.path,
    kind: component.kind,
    editorMode: editorModeFor(component),
    diffMode: diffModeFor(component),
  }));
  const mergeRequestDiffs = repository.mergeRequests.map((mergeRequest) => ({
    mergeRequestId: mergeRequest.id,
    changedComponents: asArray(mergeRequest.changedComponents).map((change) => {
      const component = componentsById.get(change.id) || change;
      return {
        componentId: change.id,
        kind: change.kind || component.kind,
        diffMode: diffModeFor(component),
      };
    }),
  }));
  const rollbackTimeline = repository.commits.map((commit) => ({
    commitId: commit.id,
    parentId: commit.parentId || null,
    message: commit.message,
    createdAt: commit.createdAt,
    rollbackCommand: `scibase restore ${repository.id} --commit ${commit.id}`,
  }));

  return {
    componentEditors,
    mergeRequestDiffs,
    rollbackTimeline,
    summaryHash: hashRecord({ componentEditors, mergeRequestDiffs, rollbackTimeline }),
  };
}

function generateCitation(repositoryInput, tagId, style = "apa") {
  const repository = normalizeRepository(repositoryInput);
  const tag = repository.tags.find((candidate) => candidate.id === tagId || candidate.version === tagId);
  if (!tag) throw new Error(`unknown tag: ${tagId}`);
  const authors = asArray(repository.metadata.authors).join(", ") || "Unknown authors";
  const year = repository.metadata.year || new Date().getUTCFullYear();
  const doi = tag.doi || repository.metadata.doi || "DOI pending";

  if (style === "bibtex") {
    return `@misc{${repository.id}-${tag.version}, title={${repository.title}}, author={${authors}}, year={${year}}, doi={${doi}}}`;
  }

  return `${authors} (${year}). ${repository.title} (${tag.version}). ${doi}.`;
}

function buildExportBundle(repositoryInput, tagId) {
  const repository = normalizeRepository(repositoryInput);
  const manifest = buildComponentManifest(repository);
  const tag = repository.tags.find((candidate) => candidate.id === tagId || candidate.version === tagId);
  const reproducibility = evaluateReproducibility(repository);

  return {
    repositoryId: repository.id,
    title: repository.title,
    tag: tag || null,
    manifest,
    reproducibility,
    apiRoutes: [
      `GET /repositories/${repository.id}`,
      `GET /repositories/${repository.id}/components`,
      `POST /repositories/${repository.id}/merge-requests`,
      `GET /repositories/${repository.id}/exports/${tagId}`,
    ],
    cliCommands: [
      `scibase clone ${repository.id}`,
      `scibase export ${repository.id} --tag ${tagId}`,
    ],
    bundleHash: hashRecord({ repositoryId: repository.id, tag, manifest, reproducibility }),
  };
}

function buildDatasetDiffSummary(repositoryInput) {
  const repository = normalizeRepository(repositoryInput);
  const removalWarnThreshold = Number(repository.releasePolicy.datasetRemovalWarnThreshold || 100);
  const dataDiffs = repository.components
    .filter((component) => component.kind === "data")
    .map((component) => {
      const stats = component.diffStats || {};
      const rowsAdded = Number(stats.rowsAdded || 0);
      const rowsRemoved = Number(stats.rowsRemoved || 0);
      const schemaChanged = Boolean(stats.schemaChanged);
      const risk =
        schemaChanged || rowsRemoved > removalWarnThreshold
          ? "high"
          : rowsAdded > 0 || rowsRemoved > 0 || Boolean(stats.hashChanged)
            ? "medium"
            : "low";

      return {
        componentId: component.id,
        path: component.path,
        rowsAdded,
        rowsRemoved,
        schemaChanged,
        hashChanged: Boolean(stats.hashChanged),
        risk,
        diffHash: hashRecord({ id: component.id, path: component.path, stats }),
      };
    });

  return {
    dataDiffs,
    highRiskCount: dataDiffs.filter((diff) => diff.risk === "high").length,
    mediumRiskCount: dataDiffs.filter((diff) => diff.risk === "medium").length,
    summaryHash: hashRecord(dataDiffs),
  };
}

function buildReleaseReadiness(repositoryInput, tagId) {
  const repository = normalizeRepository(repositoryInput);
  const manifest = buildComponentManifest(repository);
  const reproducibility = evaluateReproducibility(repository);
  const datasetDiffs = buildDatasetDiffSummary(repository);
  const requestedTagId = tagId || repository.releasePolicy.requiredTagId || (repository.tags.at(-1) && repository.tags.at(-1).id);
  const tag = repository.tags.find((candidate) => candidate.id === requestedTagId || candidate.version === requestedTagId);
  const exportBundle = tag ? buildExportBundle(repository, tag.id) : null;
  const gates = [
    {
      id: "required-components",
      status: manifest.missingRequiredKinds.length === 0 ? "pass" : "fail",
      evidence: { missingRequiredKinds: manifest.missingRequiredKinds },
    },
    {
      id: "semantic-tag",
      status: tag ? "pass" : "fail",
      evidence: { tagId: requestedTagId || null },
    },
    {
      id: "doi-metadata",
      status: tag && (tag.doi || repository.metadata.doi) ? "pass" : "fail",
      evidence: { doi: tag ? tag.doi || repository.metadata.doi || null : null },
    },
    {
      id: "reproducibility",
      status: reproducibility.status === "passed" ? "pass" : "fail",
      evidence: {
        status: reproducibility.status,
        runId: reproducibility.runId || null,
        passRate: reproducibility.passRate || 0,
      },
    },
    {
      id: "dataset-diff-risk",
      status: datasetDiffs.highRiskCount === 0 ? "pass" : "review",
      evidence: {
        highRiskCount: datasetDiffs.highRiskCount,
        mediumRiskCount: datasetDiffs.mediumRiskCount,
      },
    },
    {
      id: "export-contract",
      status: exportBundle && exportBundle.apiRoutes.length > 0 && exportBundle.cliCommands.length > 0 ? "pass" : "fail",
      evidence: {
        apiRoutes: exportBundle ? exportBundle.apiRoutes : [],
        cliCommands: exportBundle ? exportBundle.cliCommands : [],
      },
    },
  ];
  const failed = gates.filter((gate) => gate.status === "fail");
  const review = gates.filter((gate) => gate.status === "review");

  return {
    repositoryId: repository.id,
    tagId: tag ? tag.id : null,
    status: failed.length > 0 ? "blocked" : review.length > 0 ? "review" : "ready",
    gates,
    datasetDiffs,
    exportBundle,
    releaseHash: hashRecord({
      repositoryId: repository.id,
      tagId: tag && tag.id,
      gates,
      datasetDiffs: datasetDiffs.summaryHash,
      exportBundle: exportBundle && exportBundle.bundleHash,
    }),
  };
}

function buildBranchProtectionReport(repositoryInput) {
  const repository = normalizeRepository(repositoryInput);
  const commitsById = new Set(repository.commits.map((commit) => commit.id));
  const asOf = repository.branchProtection.asOf || new Date().toISOString();
  const staleAfterDays = Number(repository.branchProtection.staleAfterDays || 30);
  const protectedBranches = new Set(asArray(repository.branchProtection.protectedBranches));
  const requiredStatusChecks = asArray(repository.branchProtection.requiredStatusChecks);
  const requiredReviews = Number(repository.branchProtection.requiredReviews || 0);
  const allowForcePushes = Boolean(repository.branchProtection.allowForcePushes);
  const asOfTime = new Date(asOf).getTime();

  const branches = repository.branches.map((branch) => {
    const latestCommit = repository.commits.find((commit) => commit.id === branch.headCommitId);
    const latestTime = latestCommit ? new Date(latestCommit.createdAt).getTime() : NaN;
    const staleDays =
      Number.isFinite(asOfTime) && Number.isFinite(latestTime)
        ? Math.max(0, Math.floor((asOfTime - latestTime) / (1000 * 60 * 60 * 24)))
        : null;
    const matchingMergeRequests = repository.mergeRequests.filter(
      (mergeRequest) => mergeRequest.sourceBranchId === branch.id || mergeRequest.targetBranchId === branch.id,
    );
    const approvedReviews = matchingMergeRequests.reduce(
      (sum, mergeRequest) => sum + asArray(mergeRequest.reviews).filter((review) => review.state === "approved").length,
      0,
    );
    const checkStatuses = requiredStatusChecks.map((checkId) => {
      const check = asArray(branch.statusChecks).find((candidate) => candidate.id === checkId);
      return {
        id: checkId,
        status: check ? check.status : "missing",
      };
    });
    const blockers = [];
    if (!commitsById.has(branch.headCommitId)) blockers.push("unknown-head-commit");
    if (protectedBranches.has(branch.id) && allowForcePushes) blockers.push("force-pushes-enabled");
    if (protectedBranches.has(branch.id) && approvedReviews < requiredReviews) blockers.push("insufficient-review-approvals");
    if (checkStatuses.some((check) => check.status !== "passed")) blockers.push("required-status-check-failed");
    if (staleDays !== null && staleDays > staleAfterDays) blockers.push("stale-branch");

    return {
      branchId: branch.id,
      headCommitId: branch.headCommitId,
      protected: protectedBranches.has(branch.id),
      staleDays,
      requiredReviews,
      approvedReviews,
      statusChecks: checkStatuses,
      blockers,
      status: blockers.length ? "blocked" : "ready",
      protectionHash: hashRecord({ branch, checkStatuses, blockers, asOf }),
    };
  });

  return {
    asOf,
    branches,
    protectedBranchCount: branches.filter((branch) => branch.protected).length,
    blockedBranchCount: branches.filter((branch) => branch.status === "blocked").length,
    readyBranchCount: branches.filter((branch) => branch.status === "ready").length,
    protectionHash: hashRecord({ branches, asOf, requiredStatusChecks, requiredReviews }),
  };
}

function buildRepositoryIntegrityPacket(repositoryInput) {
  const repository = normalizeRepository(repositoryInput);
  const manifest = buildComponentManifest(repository);
  const reproducibility = evaluateReproducibility(repository);
  const latestTag = repository.tags.at(-1);
  const releaseReadiness = latestTag ? buildReleaseReadiness(repository, latestTag.id) : buildReleaseReadiness(repository);

  return {
    repository: {
      id: repository.id,
      title: repository.title,
      doi: repository.metadata.doi || null,
    },
    manifest,
    reproducibility,
    editorDiff: buildEditorDiffSummary(repository),
    branchProtection: buildBranchProtectionReport(repository),
    forks: repository.forks,
    mergeRequests: repository.mergeRequests.map((mergeRequest) =>
      evaluateMergeRequest(repository, mergeRequest),
    ),
    citations: latestTag
      ? {
          apa: generateCitation(repository, latestTag.id, "apa"),
          bibtex: generateCitation(repository, latestTag.id, "bibtex"),
        }
      : null,
    releaseReadiness,
    exportBundle: latestTag ? buildExportBundle(repository, latestTag.id) : null,
  };
}

module.exports = {
  REQUIRED_COMPONENTS,
  buildComponentManifest,
  buildBranchProtectionReport,
  buildDatasetDiffSummary,
  buildEditorDiffSummary,
  buildExportBundle,
  buildReleaseReadiness,
  buildForkRecord,
  buildRepositoryIntegrityPacket,
  createCommit,
  createSemanticTag,
  evaluateMergeRequest,
  evaluateReproducibility,
  generateCitation,
  hashRecord,
  normalizeRepository,
};
