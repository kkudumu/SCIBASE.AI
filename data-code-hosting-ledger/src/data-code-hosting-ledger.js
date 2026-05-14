"use strict";

const crypto = require("crypto");

const FILE_TYPES = {
  ".csv": { category: "dataset", preview: "spreadsheet", machineReadable: true },
  ".tsv": { category: "dataset", preview: "spreadsheet", machineReadable: true },
  ".xlsx": { category: "dataset", preview: "spreadsheet", machineReadable: false },
  ".json": { category: "dataset", preview: "json", machineReadable: true },
  ".parquet": { category: "dataset", preview: "columnar-schema", machineReadable: true },
  ".py": { category: "code", preview: "code", machineReadable: true },
  ".r": { category: "code", preview: "code", machineReadable: true },
  ".jl": { category: "code", preview: "code", machineReadable: true },
  ".ipynb": { category: "notebook", preview: "notebook", machineReadable: true },
  ".png": { category: "supplement", preview: "image-thumbnail", machineReadable: false },
  ".jpg": { category: "supplement", preview: "image-thumbnail", machineReadable: false },
  ".mp4": { category: "supplement", preview: "video-thumbnail", machineReadable: false },
  ".pt": { category: "model", preview: "model-card", machineReadable: false },
  ".h5": { category: "model", preview: "model-card", machineReadable: true },
};

const REQUIRED_METADATA = ["title", "creators", "license", "keywords", "description"];

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashRecord(value) {
  return crypto.createHash("sha256").update(stableStringify(value)).digest("hex").slice(0, 20);
}

function extension(path) {
  const match = String(path || "").toLowerCase().match(/\.[a-z0-9]+$/);
  return match ? match[0] : "";
}

function normalizeWorkspace(input) {
  if (!input || typeof input !== "object") throw new TypeError("workspace must be an object");
  return {
    id: input.id || "workspace-unknown",
    title: input.title || "Untitled scientific workspace",
    metadata: input.metadata || {},
    artifacts: asArray(input.artifacts),
    environments: asArray(input.environments),
    runs: asArray(input.runs),
  };
}

function classifyArtifact(artifact) {
  const ext = extension(artifact.path || artifact.name);
  const type = FILE_TYPES[ext] || { category: "unknown", preview: "download", machineReadable: false };
  return {
    id: artifact.id || `artifact-${hashRecord(artifact)}`,
    path: artifact.path || artifact.name,
    extension: ext || "none",
    category: artifact.category || type.category,
    preview: artifact.preview || type.preview,
    machineReadable: Boolean(type.machineReadable),
    sizeBytes: Number(artifact.sizeBytes || 0),
    contentHash: artifact.contentHash || hashRecord({ path: artifact.path || artifact.name, content: artifact.content || "", sizeBytes: artifact.sizeBytes || 0 }),
    version: artifact.version || "v1",
    tags: asArray(artifact.tags),
  };
}

function buildStorageManifest(workspaceInput) {
  const workspace = normalizeWorkspace(workspaceInput);
  const artifacts = workspace.artifacts.map(classifyArtifact);
  const folders = Array.from(
    new Set(
      artifacts.map((artifact) => {
        const parts = String(artifact.path || "").split("/");
        return parts.length > 1 ? parts[0] : "root";
      }),
    ),
  ).sort();

  return {
    workspaceId: workspace.id,
    artifacts,
    folders,
    totalBytes: artifacts.reduce((sum, artifact) => sum + artifact.sizeBytes, 0),
    categories: artifacts.reduce((counts, artifact) => {
      counts[artifact.category] = (counts[artifact.category] || 0) + 1;
      return counts;
    }, {}),
    manifestHash: hashRecord({ workspaceId: workspace.id, artifacts }),
  };
}

function buildUploadWorkflowPlan(workspaceInput) {
  const workspace = normalizeWorkspace(workspaceInput);
  const manifest = buildStorageManifest(workspace);
  const folderRules = manifest.folders.map((folder) => ({
    folder,
    acceptedCategories: Array.from(
      new Set(
        manifest.artifacts
          .filter((artifact) => String(artifact.path).startsWith(`${folder}/`) || folder === "root")
          .map((artifact) => artifact.category),
      ),
    ).sort(),
  }));
  const uploadTargets = manifest.artifacts.map((artifact) => ({
    artifactId: artifact.id,
    path: artifact.path,
    folder: String(artifact.path).includes("/") ? String(artifact.path).split("/")[0] : "root",
    acceptedExtension: artifact.extension,
    expectedContentHash: artifact.contentHash,
    maxChunkBytes: 8 * 1024 * 1024,
    resumable: true,
    validation: {
      requireContentHash: true,
      requireVersion: true,
      requireTags: artifact.category === "dataset" || artifact.category === "model",
    },
    route: `POST /workspaces/${workspace.id}/uploads/${artifact.id}/chunks`,
  }));

  return {
    workspaceId: workspace.id,
    dropZones: [
      { id: "datasets", folder: "data", accepts: [".csv", ".tsv", ".xlsx", ".json", ".parquet"] },
      { id: "code", folder: "code", accepts: [".py", ".r", ".jl", ".ipynb"] },
      { id: "supplements", folder: "figures", accepts: [".png", ".jpg", ".mp4", ".pt", ".h5"] },
    ],
    folderRules,
    uploadTargets,
    workflowHash: hashRecord({ workspaceId: workspace.id, folderRules, uploadTargets }),
  };
}

function buildMetadataBundle(workspaceInput) {
  const workspace = normalizeWorkspace(workspaceInput);
  const metadata = workspace.metadata;
  const missing = REQUIRED_METADATA.filter((field) => !metadata[field] || (Array.isArray(metadata[field]) && metadata[field].length === 0));
  const identifier = metadata.doi || metadata.uuid || `urn:scibase:${workspace.id}`;

  return {
    identifier,
    missingRequiredFields: missing,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Dataset",
      identifier,
      name: metadata.title || workspace.title,
      creator: asArray(metadata.creators).map((creator) => ({ "@type": "Person", name: creator })),
      license: metadata.license || null,
      keywords: asArray(metadata.keywords),
      description: metadata.description || "",
    },
    dataCite: {
      doi: metadata.doi || null,
      creators: asArray(metadata.creators).map((creator) => ({ name: creator })),
      titles: [{ title: metadata.title || workspace.title }],
      publisher: metadata.publisher || "SCIBASE.AI",
      publicationYear: metadata.publicationYear || new Date().getUTCFullYear(),
      resourceType: "Dataset",
    },
    schemaOrg: {
      "@type": "Dataset",
      name: metadata.title || workspace.title,
      url: metadata.persistentUrl || `https://scibase.ai/workspaces/${workspace.id}`,
    },
    metadataHash: hashRecord({ identifier, metadata }),
  };
}

function scoreFairCompliance(workspaceInput) {
  const workspace = normalizeWorkspace(workspaceInput);
  const manifest = buildStorageManifest(workspace);
  const metadata = buildMetadataBundle(workspace);
  const hasPersistentIdentifier = Boolean(workspace.metadata.doi || workspace.metadata.uuid);
  const hasPersistentUrl = Boolean(workspace.metadata.persistentUrl);
  const hasAccessPolicy = Boolean(workspace.metadata.accessPolicy);
  const machineReadableRatio = manifest.artifacts.length
    ? manifest.artifacts.filter((artifact) => artifact.machineReadable).length / manifest.artifacts.length
    : 0;
  const hasLicense = Boolean(workspace.metadata.license);
  const hasVersioning = manifest.artifacts.every((artifact) => artifact.version);

  const dimensions = {
    findable: Number(((hasPersistentIdentifier ? 0.45 : 0) + (metadata.jsonLd.keywords.length ? 0.3 : 0) + (metadata.missingRequiredFields.length === 0 ? 0.25 : 0)).toFixed(4)),
    accessible: Number(((hasPersistentUrl ? 0.5 : 0) + (hasAccessPolicy ? 0.35 : 0) + (manifest.artifacts.length > 0 ? 0.15 : 0)).toFixed(4)),
    interoperable: Number(((machineReadableRatio * 0.7) + (metadata.jsonLd["@context"] ? 0.3 : 0)).toFixed(4)),
    reusable: Number(((hasLicense ? 0.4 : 0) + (workspace.metadata.description ? 0.25 : 0) + (hasVersioning ? 0.25 : 0) + (workspace.metadata.provenance ? 0.1 : 0)).toFixed(4)),
  };

  return {
    dimensions,
    total: Number((Object.values(dimensions).reduce((sum, value) => sum + value, 0) / 4).toFixed(4)),
    blockers: [
      ...metadata.missingRequiredFields.map((field) => `missing metadata: ${field}`),
      ...(hasPersistentIdentifier ? [] : ["missing persistent identifier"]),
      ...(hasLicense ? [] : ["missing license"]),
    ],
    fairHash: hashRecord({ workspaceId: workspace.id, dimensions }),
  };
}

function createPreviewPlan(workspaceInput) {
  const manifest = buildStorageManifest(workspaceInput);
  return manifest.artifacts.map((artifact) => ({
    artifactId: artifact.id,
    path: artifact.path,
    preview: artifact.preview,
    route: `/workspaces/${manifest.workspaceId}/artifacts/${artifact.id}/preview`,
    cacheKey: hashRecord({ artifactId: artifact.id, contentHash: artifact.contentHash, preview: artifact.preview }),
  }));
}

function diffDatasetVersions(previousRows, nextRows, keyField = "id") {
  const previous = new Map(asArray(previousRows).map((row) => [row[keyField], row]));
  const next = new Map(asArray(nextRows).map((row) => [row[keyField], row]));
  const added = [];
  const removed = [];
  const changed = [];

  for (const [key, row] of next.entries()) {
    if (!previous.has(key)) added.push(row);
    else if (hashRecord(previous.get(key)) !== hashRecord(row)) changed.push({ key, before: previous.get(key), after: row });
  }
  for (const [key, row] of previous.entries()) {
    if (!next.has(key)) removed.push(row);
  }

  return {
    keyField,
    added,
    removed,
    changed,
    diffHash: hashRecord({ keyField, added, removed, changed }),
  };
}

function resolveRuntimeEnvironment(workspaceInput, artifactId) {
  const workspace = normalizeWorkspace(workspaceInput);
  const artifact = workspace.artifacts.find((candidate) => candidate.id === artifactId);
  if (!artifact) throw new Error(`unknown artifact: ${artifactId}`);
  const classified = classifyArtifact(artifact);
  const explicit = workspace.environments.find((environment) => asArray(environment.artifactIds).includes(artifactId));
  const inferredStack = classified.extension === ".ipynb" || classified.extension === ".py" ? "python" : classified.extension === ".r" ? "r" : classified.extension === ".jl" ? "julia" : "generic";
  const environment =
    explicit || workspace.environments.find((candidate) => candidate.stack === inferredStack) || {
      id: `env-${inferredStack}`,
      stack: inferredStack,
      image: inferredStack === "generic" ? "ubuntu:24.04" : `${inferredStack}:latest`,
      sandbox: true,
    };

  return {
    artifactId,
    stack: environment.stack,
    image: environment.image,
    definition: environment.dockerfile || environment.environmentYml || null,
    sandbox: environment.sandbox !== false,
    sandboxPolicy: buildSandboxPolicy(workspace, artifactId),
    command: artifact.runCommand || defaultRunCommand(classified.extension, artifact.path),
    runtimeHash: hashRecord({ artifactId, environment, artifactPath: artifact.path }),
  };
}

function defaultRunCommand(ext, path) {
  if (ext === ".ipynb") return `jupyter nbconvert --execute ${path}`;
  if (ext === ".py") return `python ${path}`;
  if (ext === ".r") return `Rscript ${path}`;
  if (ext === ".jl") return `julia ${path}`;
  return `cat ${path}`;
}

function buildSandboxPolicy(workspaceInput, artifactId) {
  const workspace = normalizeWorkspace(workspaceInput);
  const artifact = workspace.artifacts.find((candidate) => candidate.id === artifactId);
  if (!artifact) throw new Error(`unknown artifact: ${artifactId}`);
  const environment = workspace.environments.find((candidate) => asArray(candidate.artifactIds).includes(artifactId)) || {};
  const resourceLimits = environment.resourceLimits || {
    cpu: "2",
    memory: "4Gi",
    timeoutSeconds: 3600,
  };
  const networkAccess = environment.networkAccess === true;
  const secretNames = asArray(environment.secretNames);

  return {
    artifactId,
    enabled: environment.sandbox !== false,
    isolation: environment.orchestrator || "docker",
    ephemeralWorkspace: true,
    networkAccess,
    secretNames,
    resourceLimits,
    readOnlyArtifactIds: workspace.artifacts.map((candidate) => candidate.id),
    writablePaths: asArray(environment.writablePaths).length ? asArray(environment.writablePaths) : ["/tmp/scibase-run", "outputs/"],
    blockedActions: [
      "host-filesystem-write",
      "privileged-container",
      ...(networkAccess ? [] : ["unscoped-network"]),
      ...(secretNames.length ? [] : ["secret-mounts"]),
    ],
    policyHash: hashRecord({ workspaceId: workspace.id, artifactId, resourceLimits, networkAccess, secretNames }),
  };
}

function buildExecutionPlan(workspaceInput) {
  const workspace = normalizeWorkspace(workspaceInput);
  const executable = workspace.artifacts.map(classifyArtifact).filter((artifact) => ["code", "notebook"].includes(artifact.category));
  return {
    workspaceId: workspace.id,
    runtimes: executable.map((artifact) => resolveRuntimeEnvironment(workspace, artifact.id)),
    triggers: [
      { id: "run-analysis", label: "Run analysis", mode: "manual" },
      { id: "reproduce-results", label: "Reproduce results", mode: "manual" },
      { id: "scheduled-refresh", label: "Scheduled rerun", mode: "cron", schedule: "0 6 * * 1" },
    ],
    planHash: hashRecord({ workspaceId: workspace.id, executable: executable.map((artifact) => artifact.id) }),
  };
}

function buildPreservationPackage(workspaceInput) {
  const workspace = normalizeWorkspace(workspaceInput);
  const manifest = buildStorageManifest(workspace);
  const metadata = buildMetadataBundle(workspace);
  const fair = scoreFairCompliance(workspace);
  const requiredGates = [
    {
      id: "metadata-complete",
      passed: metadata.missingRequiredFields.length === 0,
      evidence: metadata.missingRequiredFields.length
        ? `Missing: ${metadata.missingRequiredFields.join(", ")}`
        : "All required metadata fields are present.",
    },
    {
      id: "persistent-identifier",
      passed: Boolean(workspace.metadata.doi || workspace.metadata.uuid),
      evidence: metadata.identifier,
    },
    {
      id: "licensed-for-reuse",
      passed: Boolean(workspace.metadata.license),
      evidence: workspace.metadata.license || "missing license",
    },
    {
      id: "artifact-hashes",
      passed: manifest.artifacts.every((artifact) => Boolean(artifact.contentHash)),
      evidence: `${manifest.artifacts.length} artifacts carry content hashes.`,
    },
    {
      id: "fair-threshold",
      passed: fair.total >= 0.8,
      evidence: `FAIR score ${fair.total}`,
    },
  ];
  const packageFiles = [
    {
      path: "manifest/storage-manifest.json",
      type: "storage-manifest",
      hash: manifest.manifestHash,
    },
    {
      path: "metadata/datacite.json",
      type: "datacite-metadata",
      hash: hashRecord(metadata.dataCite),
    },
    {
      path: "metadata/schema-org.jsonld",
      type: "schema-org-jsonld",
      hash: hashRecord(metadata.jsonLd),
    },
    {
      path: "fair/fair-score.json",
      type: "fair-score",
      hash: fair.fairHash,
    },
    ...manifest.artifacts.map((artifact) => ({
      path: `artifacts/${artifact.path}`,
      type: artifact.category,
      version: artifact.version,
      hash: artifact.contentHash,
    })),
  ];

  return {
    workspaceId: workspace.id,
    identifier: metadata.identifier,
    persistentUrl: workspace.metadata.persistentUrl || `https://scibase.ai/workspaces/${workspace.id}`,
    depositTargets: [
      {
        id: "datacite",
        type: "doi-registration",
        ready: Boolean(metadata.dataCite.doi) && requiredGates.every((gate) => gate.passed),
        payloadHash: hashRecord(metadata.dataCite),
      },
      {
        id: "repository-export",
        type: "artifact-bundle",
        ready: requiredGates.every((gate) => gate.passed),
        payloadHash: hashRecord(packageFiles),
      },
      {
        id: "schema-org-index",
        type: "discovery-index",
        ready: metadata.missingRequiredFields.length === 0,
        payloadHash: hashRecord(metadata.schemaOrg),
      },
    ],
    requiredGates,
    packageFiles,
    preservationHash: hashRecord({ workspaceId: workspace.id, requiredGates, packageFiles }),
  };
}

function buildHostingPacket(workspaceInput) {
  const workspace = normalizeWorkspace(workspaceInput);
  const manifest = buildStorageManifest(workspace);
  const metadata = buildMetadataBundle(workspace);
  const fair = scoreFairCompliance(workspace);
  const previews = createPreviewPlan(workspace);
  const uploadWorkflow = buildUploadWorkflowPlan(workspace);
  const execution = buildExecutionPlan(workspace);
  const preservation = buildPreservationPackage(workspace);

  return {
    workspace: {
      id: workspace.id,
      title: workspace.title,
    },
    manifest,
    metadata,
    fair,
    uploadWorkflow,
    previews,
    execution,
    preservation,
    apiRoutes: [
      `POST /workspaces/${workspace.id}/artifacts`,
      `POST /workspaces/${workspace.id}/uploads/:artifactId/chunks`,
      `POST /workspaces/${workspace.id}/uploads/:artifactId/complete`,
      `GET /workspaces/${workspace.id}/artifacts/:artifactId/preview`,
      `GET /workspaces/${workspace.id}/metadata/datacite`,
      `GET /workspaces/${workspace.id}/preservation-package`,
      `POST /workspaces/${workspace.id}/runs`,
      `GET /workspaces/${workspace.id}/fair-score`,
    ],
    packetHash: hashRecord({ manifest, metadata, fair, uploadWorkflow, previews, execution, preservation }),
  };
}

module.exports = {
  FILE_TYPES,
  REQUIRED_METADATA,
  buildExecutionPlan,
  buildHostingPacket,
  buildMetadataBundle,
  buildPreservationPackage,
  buildSandboxPolicy,
  buildStorageManifest,
  buildUploadWorkflowPlan,
  classifyArtifact,
  createPreviewPlan,
  diffDatasetVersions,
  hashRecord,
  resolveRuntimeEnvironment,
  scoreFairCompliance,
};
