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
    reproducibilityAttempts: asArray(project.reproducibilityAttempts),
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

function buildAssistantPacket(projectInput) {
  const project = normalizeProject(projectInput);
  const peerReview = buildPeerReviewReport(project);
  const reproducibility = buildReproducibilityReport(project);
  const researchGaps = buildResearchGapFeed(project);

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
    nextActions: [
      ...peerReview.findings.slice(0, 3).map((finding) => finding.suggestion),
      ...reproducibility.checks
        .filter((check) => !check.passed)
        .slice(0, 2)
        .map((check) => `Address reproducibility check: ${check.detail}.`),
      ...researchGaps.slice(0, 2).map((gap) => gap.suggestedDirection),
    ],
  };
}

module.exports = {
  DEFAULT_REVIEW_TEMPLATE,
  buildAssistantPacket,
  buildPeerReviewReport,
  buildResearchGapFeed,
  buildReproducibilityReport,
  fingerprint,
  normalizeProject,
  overlapScore,
};
