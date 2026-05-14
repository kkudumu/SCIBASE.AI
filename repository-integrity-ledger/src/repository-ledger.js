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

function buildRepositoryIntegrityPacket(repositoryInput) {
  const repository = normalizeRepository(repositoryInput);
  const manifest = buildComponentManifest(repository);
  const reproducibility = evaluateReproducibility(repository);
  const latestTag = repository.tags.at(-1);

  return {
    repository: {
      id: repository.id,
      title: repository.title,
      doi: repository.metadata.doi || null,
    },
    manifest,
    reproducibility,
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
    exportBundle: latestTag ? buildExportBundle(repository, latestTag.id) : null,
  };
}

module.exports = {
  REQUIRED_COMPONENTS,
  buildComponentManifest,
  buildExportBundle,
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
