"use strict";

const crypto = require("crypto");

const DEFAULT_REVIEW_TEMPLATE = {
  requiredSections: ["abstract", "methods", "results", "limitations", "data availability"],
  statisticalTerms: ["p-value", "confidence interval", "effect size", "sample size"],
  reproducibilityFiles: ["README", "requirements", "notebook", "data dictionary"],
};

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function sentenceSplit(text) {
  return normalizeText(text)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function wordSet(text) {
  return new Set(
    normalizeText(text)
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 3),
  );
}

function overlapScore(left, right) {
  const a = wordSet(left);
  const b = wordSet(right);
  if (a.size === 0 || b.size === 0) return 0;
  let overlap = 0;
  for (const word of a) {
    if (b.has(word)) overlap += 1;
  }
  return Number((overlap / Math.min(a.size, b.size)).toFixed(4));
}

function fingerprint(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
}

function normalizeProject(project) {
  if (!project || typeof project !== "object") {
    throw new TypeError("project must be an object");
  }

  return {
    id: project.id || "project-unknown",
    title: project.title || "Untitled research project",
    domain: project.domain || "general science",
    manuscript: project.manuscript || {},
    files: asArray(project.files),
    dependencies: asArray(project.dependencies),
    claims: asArray(project.claims),
    results: asArray(project.results),
    corpus: asArray(project.corpus),
    interests: asArray(project.interests),
    executionEvidence: asArray(project.executionEvidence),
    executionTargets: asArray(project.executionTargets),
    reproducibilityAttempts: asArray(project.reproducibilityAttempts),
    workflowPreferences: project.workflowPreferences || {},
    sandboxPolicy: project.sandboxPolicy || {},
  };
}

function buildPeerReviewReport(projectInput, template = DEFAULT_REVIEW_TEMPLATE) {
  const project = normalizeProject(projectInput);
  const manuscriptText = Object.values(project.manuscript).join(" ");
  const sections = Object.keys(project.manuscript).map((section) => section.toLowerCase());
  const missingSections = template.requiredSections.filter(
    (section) => !sections.includes(section.toLowerCase()),
  );

  const clarityFindings = sentenceSplit(manuscriptText)
    .filter((sentence) => sentence.length > 180 || /\b(obviously|clearly|simply)\b/i.test(sentence))
    .map((sentence) => ({
      type: "clarity",
      severity: sentence.length > 220 ? "high" : "medium",
      evidence: sentence.slice(0, 220),
      suggestion: "Split dense claims into shorter evidence-backed statements.",
    }));

  const claimFindings = project.claims.map((claim) => {
    const bestResult = project.results
      .map((result) => ({
        resultId: result.id,
        score: overlapScore(claim.text, result.summary || result.text || ""),
        summary: result.summary || result.text || "",
      }))
      .sort((a, b) => b.score - a.score)[0];

    return {
      claimId: claim.id,
      claim: claim.text,
      evidenceResultId: bestResult ? bestResult.resultId : null,
      evidenceScore: bestResult ? bestResult.score : 0,
      status: bestResult && bestResult.score >= 0.2 ? "supported" : "needs-evidence",
    };
  });

  const statisticMentions = template.statisticalTerms.filter((term) =>
    manuscriptText.toLowerCase().includes(term.toLowerCase()),
  );

  const findings = [
    ...missingSections.map((section) => ({
      type: "structure",
      severity: "high",
      evidence: section,
      suggestion: `Add a ${section} section before submission.`,
    })),
    ...clarityFindings,
    ...claimFindings
      .filter((claim) => claim.status === "needs-evidence")
      .map((claim) => ({
        type: "claim-evidence",
        severity: "high",
        evidence: claim.claim,
        suggestion: "Link this claim to a result, table, figure, or cited prior work.",
      })),
  ];

  if (statisticMentions.length === 0) {
    findings.push({
      type: "statistics",
      severity: "medium",
      evidence: "No statistical reporting terms found.",
      suggestion: "Report sample size, effect size, confidence intervals, and p-values where relevant.",
    });
  }

  const score = Math.max(0, 100 - findings.reduce((sum, finding) => {
    return sum + (finding.severity === "high" ? 15 : 8);
  }, 0));

  return {
    projectId: project.id,
    template: "general-scientific-pre-review",
    score,
    missingSections,
    statisticMentions,
    claimAlignment: claimFindings,
    findings,
  };
}

function buildReproducibilityReport(projectInput, template = DEFAULT_REVIEW_TEMPLATE) {
  const project = normalizeProject(projectInput);
  const fileNames = project.files.map((file) =>
    String(file.name || "")
      .toLowerCase()
      .replace(/[_-]+/g, " "),
  );
  const dependencyNames = project.dependencies.map((dependency) => dependency.name || dependency);
  const missingFiles = template.reproducibilityFiles.filter((required) =>
    !fileNames.some((fileName) => fileName.includes(required.toLowerCase())),
  );
  const runnableFiles = fileNames.filter((fileName) =>
    /\.(ipynb|py|r|jl|sh|Rmd)$/i.test(fileName),
  );
  const dataFiles = fileNames.filter((fileName) =>
    /\.(csv|tsv|parquet|json|h5|feather)$/i.test(fileName),
  );
  const pinnedDependencies = project.dependencies.filter(
    (dependency) => dependency.version && !["latest", "*"].includes(String(dependency.version)),
  );
  const artifactFingerprint = fingerprint({
    files: project.files,
    dependencies: project.dependencies,
    results: project.results,
  });
  const linkedAttempts = project.reproducibilityAttempts
    .map((attempt) => ({
      id: attempt.id || "attempt-unknown",
      url: attempt.url || null,
      status: attempt.status || "unknown",
      date: attempt.date || null,
      artifactFingerprint: attempt.artifactFingerprint || null,
      matchesCurrentArtifacts: attempt.artifactFingerprint === artifactFingerprint,
      notes: attempt.notes || "",
    }))
    .sort((a, b) => {
      if (a.matchesCurrentArtifacts !== b.matchesCurrentArtifacts) {
        return a.matchesCurrentArtifacts ? -1 : 1;
      }
      return String(b.date || "").localeCompare(String(a.date || ""));
    });
  const sandboxPlan = buildSandboxExecutionPlan(project, runnableFiles, dataFiles, artifactFingerprint);
  const sandboxEvidence = evaluateSandboxEvidence(project, sandboxPlan);

  const checks = [
    {
      id: "readme-present",
      passed: !missingFiles.includes("README"),
      detail: "README or runbook present",
    },
    {
      id: "environment-pinned",
      passed: dependencyNames.length > 0 && pinnedDependencies.length === dependencyNames.length,
      detail: "Dependencies include explicit versions",
    },
    {
      id: "runnable-analysis",
      passed: runnableFiles.length > 0,
      detail: "At least one runnable analysis artifact exists",
    },
    {
      id: "data-dictionary",
      passed: !missingFiles.includes("data dictionary"),
      detail: "Data dictionary is present",
    },
    {
      id: "source-data",
      passed: dataFiles.length > 0,
      detail: "Machine-readable source data is present",
    },
    {
      id: "attempt-history-linked",
      passed: linkedAttempts.length > 0,
      detail: "Previous reproducibility attempts are linked",
    },
    {
      id: "sandbox-plan-ready",
      passed: sandboxPlan.targets.length > 0,
      detail: "Sandbox execution targets are defined for runnable artifacts",
    },
    {
      id: "sandbox-evidence-clean",
      passed: sandboxEvidence.summary.cleanRuns === sandboxPlan.targets.length && sandboxPlan.targets.length > 0,
      detail: "Sandbox execution evidence has zero failed runs",
    },
    {
      id: "reported-output-consistency",
      passed: sandboxEvidence.summary.consistentOutputs === sandboxPlan.targets.length && sandboxPlan.targets.length > 0,
      detail: "Sandbox evidence links generated outputs to reported results",
    },
  ];

  const passed = checks.filter((check) => check.passed).length;
  const confidenceScore = Number((passed / checks.length).toFixed(2));

  return {
    projectId: project.id,
    artifactFingerprint,
    confidenceScore,
    status: confidenceScore >= 0.8 ? "reproducible" : confidenceScore >= 0.5 ? "partial" : "at-risk",
    missingFiles,
    runnableFiles,
    dataFiles,
    sandboxPlan,
    sandboxEvidence,
    linkedAttempts,
    checks,
    runbook: [
      "Install pinned dependencies in a clean environment.",
      "Run notebooks or scripts in the order documented by the README.",
      "Compare generated outputs against the reported results manifest.",
      "Attach logs and hashes to the reproducibility attempt record.",
    ],
  };
}

function buildSandboxExecutionPlan(projectInput, runnableFilesInput, dataFilesInput, artifactFingerprint) {
  const project = normalizeProject(projectInput);
  const runnableFiles = runnableFilesInput || project.files.map((file) => file.name || "").filter(Boolean);
  const dataFiles = dataFilesInput || [];
  const policy = project.sandboxPolicy;
  const defaultImage = policy.image || "python:3.12-slim";
  const network = policy.network || "disabled";
  const resourceLimits = {
    cpu: policy.cpu || "2",
    memory: policy.memory || "4g",
    timeoutSeconds: policy.timeoutSeconds || 1800,
  };
  const explicitTargets = project.executionTargets.map((target) => String(target));
  const targets = (explicitTargets.length > 0 ? explicitTargets : runnableFiles)
    .map((target) => String(target))
    .filter((target) => executableCommandFor(target))
    .map((target) => ({
      id: `run-${fingerprint({ projectId: project.id, target }).slice(0, 8)}`,
      target,
      command: executableCommandFor(target),
      requiredDataFiles: dataFiles,
      expectedResultIds: project.results.map((result) => result.id),
    }));

  return {
    image: defaultImage,
    network,
    resourceLimits,
    artifactFingerprint,
    mounts: [
      { source: "project", target: "/workspace/project", mode: "read-only" },
      { source: "outputs", target: "/workspace/outputs", mode: "read-write" },
    ],
    targets,
  };
}

function executableCommandFor(fileName) {
  if (/\.ipynb$/i.test(fileName)) {
    return `jupyter nbconvert --to notebook --execute ${fileName} --output /workspace/outputs/${fileName}`;
  }
  if (/\.py$/i.test(fileName)) return `python ${fileName}`;
  if (/\.r$/i.test(fileName)) return `Rscript ${fileName}`;
  if (/\.rmd$/i.test(fileName)) return `Rscript -e "rmarkdown::render('${fileName}')"`;
  if (/\.jl$/i.test(fileName)) return `julia ${fileName}`;
  if (/\.sh$/i.test(fileName)) return `bash ${fileName}`;
  return null;
}

function evaluateSandboxEvidence(projectInput, sandboxPlanInput) {
  const project = normalizeProject(projectInput);
  const sandboxPlan = sandboxPlanInput || buildSandboxExecutionPlan(project);
  const targetIds = new Set(sandboxPlan.targets.map((target) => target.id));
  const runs = project.executionEvidence
    .filter((run) => targetIds.has(run.targetId))
    .map((run) => {
      const outputHashes = asArray(run.outputHashes).filter(Boolean);
      const generatedArtifacts = asArray(run.generatedArtifacts).map(String);
      const reportedArtifacts = asArray(run.reportedArtifacts).map(String);
      const missingReportedArtifacts = reportedArtifacts.filter(
        (artifact) => !generatedArtifacts.includes(artifact),
      );
      return {
        targetId: run.targetId,
        status: run.exitCode === 0 && outputHashes.length > 0 ? "passed" : "failed",
        exitCode: Number.isInteger(run.exitCode) ? run.exitCode : null,
        durationSeconds: run.durationSeconds || null,
        outputHashes,
        logUrl: run.logUrl || null,
        generatedArtifacts,
        reportedArtifacts,
        missingReportedArtifacts,
        outputConsistency: missingReportedArtifacts.length === 0 && reportedArtifacts.length > 0,
      };
    });
  const cleanRuns = runs.filter((run) => run.status === "passed").length;
  const consistentOutputs = runs.filter((run) => run.outputConsistency).length;

  return {
    runs,
    summary: {
      plannedRuns: sandboxPlan.targets.length,
      observedRuns: runs.length,
      cleanRuns,
      consistentOutputs,
      missingRuns: Math.max(0, sandboxPlan.targets.length - runs.length),
    },
  };
}

function buildResearchGapFeed(projectInput) {
  const project = normalizeProject(projectInput);
  const currentText = [
    project.title,
    project.domain,
    ...project.interests,
    ...project.claims.map((claim) => claim.text),
  ].join(" ");

  const opportunities = project.corpus.map((paper) => {
    const relevance = overlapScore(currentText, [paper.title, paper.abstract, ...(paper.keywords || [])].join(" "));
    const replicationGap = paper.replications === 0 ? 0.35 : paper.replications < 2 ? 0.2 : 0;
    const limitationSignal = /\b(limitation|future work|unresolved|small sample|pilot)\b/i.test(
      `${paper.abstract || ""} ${paper.notes || ""}`,
    )
      ? 0.25
      : 0;
    const novelty = Math.max(0, 1 - overlapScore(project.title, paper.title || ""));
    const priority = Number((relevance * 0.45 + replicationGap + limitationSignal + novelty * 0.1).toFixed(4));

    return {
      paperId: paper.id,
      title: paper.title,
      relevance,
      replicationGap,
      limitationSignal,
      priority,
      suggestedDirection: buildSuggestedDirection(project, paper),
    };
  });

  return opportunities
    .filter((opportunity) => opportunity.priority >= 0.25)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 5);
}

function buildSuggestedDirection(project, paper) {
  const projectTerms = [...wordSet(`${project.title} ${project.domain} ${project.interests.join(" ")}`)];
  const paperTerms = [...wordSet(`${paper.title || ""} ${paper.abstract || ""}`)];
  const shared = projectTerms.filter((term) => paperTerms.includes(term)).slice(0, 3);
  const anchor = shared.length > 0 ? shared.join(", ") : project.domain;
  return `Investigate ${anchor} with a replication-ready protocol and explicitly report negative or null results.`;
}

function severityWeight(severity) {
  return severity === "high" ? 3 : severity === "medium" ? 2 : 1;
}

function actionHash(projectId, action) {
  return fingerprint({
    projectId,
    id: action.id,
    source: action.source,
    evidence: action.evidence,
    recommendation: action.recommendation,
  });
}

function buildAction(project, action) {
  return {
    ...action,
    evidenceHash: actionHash(project.id, action),
  };
}

function workflowOwner(project, ownerKey, fallback) {
  return project.workflowPreferences[ownerKey] || fallback;
}

function uniqueStrings(values) {
  return [...new Set(values)];
}

function buildWorkflowOrchestration(projectInput) {
  const project = normalizeProject(projectInput);
  const peerReview = buildPeerReviewReport(project);
  const reproducibility = buildReproducibilityReport(project);
  const researchGaps = buildResearchGapFeed(project);

  const reviewActions = peerReview.findings.map((finding, index) =>
    buildAction(project, {
      id: `review-${index + 1}`,
      stage: "peer-review",
      source: finding.type,
      title: `Resolve ${finding.type} finding`,
      owner: workflowOwner(project, "reviewOwner", "editorial lead"),
      severity: finding.severity,
      priority: severityWeight(finding.severity) * 20,
      status: finding.severity === "high" ? "blocking" : "queued",
      evidence: finding.evidence,
      recommendation: finding.suggestion,
      dependsOn: [],
    }),
  );

  const failedReproChecks = reproducibility.checks.filter((check) => !check.passed);
  const reproActions = [
    ...failedReproChecks.map((check, index) =>
      buildAction(project, {
        id: `repro-${index + 1}`,
        stage: "reproducibility",
        source: check.id,
        title: `Fix reproducibility gate: ${check.id}`,
        owner: workflowOwner(project, "reproducibilityOwner", "reproducibility reviewer"),
        severity: "high",
        priority: 55,
        status: "blocking",
        evidence: check.detail,
        recommendation: `Complete and re-run the ${check.id} check.`,
        dependsOn: reviewActions.filter((action) => action.status === "blocking").map((action) => action.id),
      }),
    ),
    buildAction(project, {
      id: "repro-runbook",
      stage: "reproducibility",
      source: "runbook",
      title: "Attach clean-room rerun evidence",
      owner: workflowOwner(project, "reproducibilityOwner", "reproducibility reviewer"),
      severity: reproducibility.status === "reproducible" ? "low" : "medium",
      priority: reproducibility.status === "reproducible" ? 18 : 38,
      status: reproducibility.status === "reproducible" ? "ready" : "queued",
      evidence: reproducibility.linkedAttempts[0]
        ? `${reproducibility.linkedAttempts[0].id}:${reproducibility.linkedAttempts[0].status}`
        : "no linked attempt",
      recommendation: reproducibility.runbook.join(" "),
      dependsOn: failedReproChecks.map((_, index) => `repro-${index + 1}`),
    }),
  ];

  const gapActions = researchGaps.slice(0, 3).map((gap, index) =>
    buildAction(project, {
      id: `gap-${index + 1}`,
      stage: "gap-finder",
      source: gap.paperId,
      title: `Evaluate research opportunity: ${gap.title}`,
      owner: workflowOwner(project, "strategyOwner", "research strategy lead"),
      severity: gap.priority >= 0.75 ? "medium" : "low",
      priority: Math.round(gap.priority * 50),
      status: "queued",
      evidence: `${gap.paperId}:${gap.priority}`,
      recommendation: gap.suggestedDirection,
      dependsOn: ["repro-runbook"],
    }),
  );

  const publicationAction = buildAction(project, {
    id: "publication-readiness",
    stage: "publication-readiness",
    source: "assistant-packet",
    title: "Prepare reviewer handoff packet",
    owner: workflowOwner(project, "publicationOwner", "corresponding author"),
    severity: "medium",
    priority: 34,
    status: peerReview.findings.some((finding) => finding.severity === "high") ? "blocked" : "queued",
    evidence: `peer:${peerReview.score};repro:${reproducibility.status};gaps:${researchGaps.length}`,
    recommendation: "Bundle peer-review fixes, reproducibility evidence, and selected research-gap notes for review.",
    dependsOn: [
      ...reviewActions.filter((action) => action.status === "blocking").map((action) => action.id),
      "repro-runbook",
    ],
  });

  const actions = [...reviewActions, ...reproActions, ...gapActions, publicationAction].sort((a, b) => {
    if (a.status === "blocking" && b.status !== "blocking") return -1;
    if (a.status !== "blocking" && b.status === "blocking") return 1;
    return b.priority - a.priority;
  });

  const blocked = actions.some((action) => ["blocking", "blocked"].includes(action.status));
  const riskScore = Math.min(
    100,
    actions.reduce((sum, action) => {
      const statusPenalty = action.status === "blocking" ? 12 : action.status === "blocked" ? 8 : 0;
      return sum + severityWeight(action.severity) * 4 + statusPenalty;
    }, Math.round((1 - reproducibility.confidenceScore) * 25)),
  );

  return {
    projectId: project.id,
    blocked,
    readyForInternalReview: !blocked && peerReview.score >= 70 && reproducibility.confidenceScore >= 0.8,
    riskScore,
    deadline: project.workflowPreferences.deadline || null,
    stages: [
      summarizeStage("peer-review", actions),
      summarizeStage("reproducibility", actions),
      summarizeStage("gap-finder", actions),
      summarizeStage("publication-readiness", actions),
    ],
    actions,
    orchestrationHash: fingerprint({
      projectId: project.id,
      actions: actions.map((action) => ({
        id: action.id,
        status: action.status,
        evidenceHash: action.evidenceHash,
        dependsOn: action.dependsOn,
      })),
      riskScore,
    }),
  };
}

function summarizeStage(stage, actions) {
  const stageActions = actions.filter((action) => action.stage === stage);
  const blocked = stageActions.some((action) => ["blocking", "blocked"].includes(action.status));
  return {
    stage,
    actionCount: stageActions.length,
    blocked,
    topActionId: stageActions[0] ? stageActions[0].id : null,
  };
}

function buildAssistantPacket(projectInput) {
  const project = normalizeProject(projectInput);
  const peerReview = buildPeerReviewReport(project);
  const reproducibility = buildReproducibilityReport(project);
  const researchGaps = buildResearchGapFeed(project);
  const workflow = buildWorkflowOrchestration(project);

  const readinessScore = Math.round(
    peerReview.score * 0.45 + reproducibility.confidenceScore * 100 * 0.35 + Math.min(researchGaps.length, 5) * 4,
  );

  return {
    project: {
      id: project.id,
      title: project.title,
      domain: project.domain,
    },
    generatedAt: new Date().toISOString(),
    readinessScore,
    peerReview,
    reproducibility,
    researchGaps,
    workflow,
    nextActions: uniqueStrings([
      ...workflow.actions.slice(0, 3).map((action) => action.recommendation),
      ...peerReview.findings.slice(0, 3).map((finding) => finding.suggestion),
      ...reproducibility.checks
        .filter((check) => !check.passed)
        .slice(0, 2)
        .map((check) => `Address reproducibility check: ${check.detail}.`),
      ...researchGaps.slice(0, 2).map((gap) => gap.suggestedDirection),
    ]),
  };
}

module.exports = {
  DEFAULT_REVIEW_TEMPLATE,
  buildAssistantPacket,
  buildSandboxExecutionPlan,
  buildPeerReviewReport,
  buildResearchGapFeed,
  buildReproducibilityReport,
  buildWorkflowOrchestration,
  evaluateSandboxEvidence,
  fingerprint,
  normalizeProject,
  overlapScore,
};
