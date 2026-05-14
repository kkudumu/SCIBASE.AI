"use strict";

const crypto = require("crypto");

const REVIEW_VISIBILITY = new Set(["public", "semi-private", "anonymous", "double-blind"]);
const CREDIT_ROLES = [
  "conceptualization",
  "data-curation",
  "formal-analysis",
  "funding-acquisition",
  "investigation",
  "methodology",
  "project-administration",
  "resources",
  "software",
  "supervision",
  "validation",
  "visualization",
  "writing-original-draft",
  "writing-review-editing",
];

const REVIEW_TEMPLATES = {
  biology: ["clarity", "methodology", "data-quality", "reproducibility", "novelty"],
  physics: ["clarity", "rigor", "assumptions", "reproducibility", "novelty"],
  "social-sciences": ["clarity", "ethics", "sampling", "reproducibility", "impact"],
  general: ["clarity", "rigor", "novelty", "reproducibility"],
};

const CONTRIBUTION_WEIGHTS = {
  authorship: 12,
  protocol: 7,
  dataset: 9,
  curation: 6,
  code: 8,
  analysis: 8,
  review: 5,
  comment: 2,
  issue: 4,
  reproducibility: 10,
  bounty: 12,
};

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

function normalizeScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(5, score));
}

function average(values) {
  const usable = values.filter((value) => Number.isFinite(value));
  return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : 0;
}

function normalizeCommunity(input) {
  if (!input || typeof input !== "object") throw new TypeError("community data must be an object");
  return {
    researchers: asArray(input.researchers),
    projects: asArray(input.projects),
    reviews: asArray(input.reviews),
    comments: asArray(input.comments),
    contributions: asArray(input.contributions),
    endorsements: asArray(input.endorsements),
    appeals: asArray(input.appeals),
    metrics: input.metrics || {},
  };
}

function selectReviewTemplate(discipline = "general") {
  const criteria = REVIEW_TEMPLATES[discipline] || REVIEW_TEMPLATES.general;
  return {
    discipline: REVIEW_TEMPLATES[discipline] ? discipline : "general",
    criteria,
    maxScore: 5,
    requiredNarrativeFields: ["summary", "strengths", "concerns", "recommendation"],
  };
}

function createPeerReview(reviewInput) {
  const template = selectReviewTemplate(reviewInput.discipline);
  const visibility = REVIEW_VISIBILITY.has(reviewInput.visibility) ? reviewInput.visibility : "public";
  const scores = Object.fromEntries(
    template.criteria.map((criterion) => [criterion, normalizeScore((reviewInput.scores || {})[criterion])]),
  );
  const scoreAverage = Number(average(Object.values(scores)).toFixed(4));
  const reviewerVisible = visibility === "public" || visibility === "semi-private";

  return {
    id: reviewInput.id || `review-${hashRecord(reviewInput)}`,
    projectId: reviewInput.projectId,
    reviewerId: reviewerVisible ? reviewInput.reviewerId : null,
    reviewerAlias:
      reviewerVisible ? reviewInput.reviewerId : `anonymous-${hashRecord({ reviewerId: reviewInput.reviewerId }).slice(0, 8)}`,
    discipline: template.discipline,
    visibility,
    scores,
    scoreAverage,
    recommendation: reviewInput.recommendation || "revise",
    narrative: {
      summary: reviewInput.summary || "",
      strengths: asArray(reviewInput.strengths),
      concerns: asArray(reviewInput.concerns),
    },
    createdAt: reviewInput.createdAt || new Date().toISOString(),
    reviewHash: hashRecord({
      projectId: reviewInput.projectId,
      reviewerId: reviewInput.reviewerId,
      scores,
      recommendation: reviewInput.recommendation || "revise",
      createdAt: reviewInput.createdAt || null,
    }),
  };
}

function createInlineComment(commentInput) {
  const target = commentInput.target || {};
  const mode = REVIEW_VISIBILITY.has(commentInput.mode) ? commentInput.mode : "public";
  const authorVisible = mode === "public" || mode === "semi-private";
  return {
    id: commentInput.id || `comment-${hashRecord(commentInput)}`,
    projectId: commentInput.projectId,
    authorId: authorVisible ? commentInput.authorId : null,
    authorAlias:
      authorVisible ? commentInput.authorId : `anonymous-${hashRecord({ authorId: commentInput.authorId }).slice(0, 8)}`,
    target: {
      kind: target.kind || "document",
      path: target.path || "manuscript/main.md",
      anchor: target.anchor || null,
      lineStart: target.lineStart || null,
      lineEnd: target.lineEnd || target.lineStart || null,
    },
    mode,
    status: commentInput.status || "open",
    body: commentInput.body || "",
    createdAt: commentInput.createdAt || new Date().toISOString(),
    commentHash: hashRecord({
      projectId: commentInput.projectId,
      authorId: commentInput.authorId,
      target,
      body: commentInput.body || "",
    }),
  };
}

function buildContributionLedger(communityInput) {
  const community = normalizeCommunity(communityInput);
  return community.contributions.map((contribution) => {
    const roles = asArray(contribution.roles).filter((role) => CREDIT_ROLES.includes(role));
    const baseWeight = CONTRIBUTION_WEIGHTS[contribution.type] || 1;
    const credit = Number((baseWeight * Math.max(1, roles.length || 1) * Number(contribution.impact || 1)).toFixed(4));

    return {
      id: contribution.id || `contribution-${hashRecord(contribution)}`,
      projectId: contribution.projectId,
      contributorId: contribution.contributorId,
      type: contribution.type,
      roles,
      timestamp: contribution.timestamp || new Date().toISOString(),
      credit,
      citationVisible: contribution.citationVisible !== false,
      contributionHash: hashRecord({ contribution, roles, credit }),
    };
  });
}

function buildContributorGraph(communityInput) {
  const ledger = buildContributionLedger(communityInput);
  const byContributor = new Map();
  const projectEdges = new Map();

  for (const entry of ledger) {
    if (!byContributor.has(entry.contributorId)) {
      byContributor.set(entry.contributorId, {
        contributorId: entry.contributorId,
        totalCredit: 0,
        contributionCount: 0,
        roleCounts: {},
        projects: new Set(),
      });
    }
    const contributor = byContributor.get(entry.contributorId);
    contributor.totalCredit = Number((contributor.totalCredit + entry.credit).toFixed(4));
    contributor.contributionCount += 1;
    contributor.projects.add(entry.projectId);
    for (const role of entry.roles) {
      contributor.roleCounts[role] = (contributor.roleCounts[role] || 0) + 1;
    }

    const edgeId = `${entry.contributorId}->${entry.projectId}`;
    projectEdges.set(edgeId, {
      contributorId: entry.contributorId,
      projectId: entry.projectId,
      weight: Number(((projectEdges.get(edgeId) || {}).weight || 0) + entry.credit),
    });
  }

  return {
    contributors: Array.from(byContributor.values()).map((contributor) => ({
      ...contributor,
      projects: Array.from(contributor.projects).sort(),
    })),
    edges: Array.from(projectEdges.values()).map((edge) => ({
      ...edge,
      weight: Number(edge.weight.toFixed(4)),
    })),
  };
}

function scoreResearcher(communityInput, researcherId) {
  const community = normalizeCommunity(communityInput);
  const researcher = community.researchers.find((candidate) => candidate.id === researcherId) || { id: researcherId };
  const ledger = buildContributionLedger(community);
  const researcherReviews = community.reviews
    .map(createPeerReview)
    .filter((review) => review.reviewerId === researcherId || review.reviewerAlias.endsWith(hashRecord({ reviewerId: researcherId }).slice(0, 8)));
  const researcherContributions = ledger.filter((entry) => entry.contributorId === researcherId);
  const validEndorsements = community.endorsements.filter(
    (endorsement) => endorsement.to === researcherId && endorsement.from !== researcherId && endorsement.status !== "revoked",
  );
  const metric = (community.metrics.researchers || {})[researcherId] || {};
  const penalties = asArray(metric.flags).reduce((total, flag) => total + (flag.severity === "high" ? 12 : 4), 0);

  const components = {
    citationImpact: Number(metric.citations || 0) * 0.8,
    forkImpact: Number(metric.forks || 0) * 2.2,
    endorsementImpact: validEndorsements.reduce((sum, endorsement) => sum + normalizeScore(endorsement.weight || 1), 0) * 1.5,
    peerReviewImpact:
      researcherReviews.length * 3 + average(researcherReviews.map((review) => review.scoreAverage)) * 4,
    reproducibilityImpact: Number(metric.reproducibilityBadges || 0) * 9,
    bountyImpact: Number(metric.bountyCompletions || 0) * 12,
    contributionImpact: researcherContributions.reduce((sum, entry) => sum + entry.credit, 0) * 0.7,
    penaltyImpact: -penalties,
  };
  const total = Number(Math.max(0, Object.values(components).reduce((sum, value) => sum + value, 0)).toFixed(4));

  return {
    researcherId,
    displayName: researcher.displayName || researcherId,
    domain: researcher.domain || "general",
    region: researcher.region || "global",
    institution: researcher.institution || "independent",
    components,
    total,
    tier: assignTier(total),
    badges: assignBadges({ total, components, metric, reviews: researcherReviews, contributions: researcherContributions }),
    transparencyHash: hashRecord({ researcherId, components, total }),
  };
}

function assignTier(score) {
  if (score >= 120) return "open-science-champion";
  if (score >= 80) return "trusted-reviewer";
  if (score >= 45) return "active-collaborator";
  return "emerging-contributor";
}

function assignBadges({ total, components, metric, reviews, contributions }) {
  const badges = [];
  if (reviews.length >= 2 || components.peerReviewImpact >= 15) badges.push("Trusted Reviewer");
  if (Number(metric.reproducibilityBadges || 0) > 0) badges.push("Reproducibility Verified");
  if (components.contributionImpact >= 25) badges.push("CRediT Power Contributor");
  if (Number(metric.bountyCompletions || 0) > 0) badges.push("Challenge Finisher");
  if (contributions.some((entry) => entry.roles.includes("data-curation"))) badges.push("Data Steward");
  if (total >= 120) badges.push("Open Science Champion");
  return badges;
}

function buildLeaderboards(communityInput, dimension = "domain") {
  const community = normalizeCommunity(communityInput);
  const scores = community.researchers.map((researcher) => scoreResearcher(community, researcher.id));
  const groups = new Map();
  for (const score of scores) {
    const group = score[dimension] || "global";
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(score);
  }

  return Array.from(groups.entries()).map(([group, entries]) => ({
    dimension,
    group,
    entries: entries
      .sort((left, right) => right.total - left.total || left.displayName.localeCompare(right.displayName))
      .map((entry, index) => ({
        rank: index + 1,
        researcherId: entry.researcherId,
        displayName: entry.displayName,
        total: entry.total,
        tier: entry.tier,
        badges: entry.badges,
      })),
  }));
}

function buildResearcherProfiles(communityInput) {
  const community = normalizeCommunity(communityInput);
  const contributionLedger = buildContributionLedger(community);
  const comments = community.comments.map(createInlineComment);
  const reviews = community.reviews.map(createPeerReview);

  return community.researchers.map((researcher) => {
    const score = scoreResearcher(community, researcher.id);
    const profileContributions = contributionLedger.filter((entry) => entry.contributorId === researcher.id);
    const profileReviews = reviews.filter(
      (review) =>
        review.reviewerId === researcher.id ||
        review.reviewerAlias.endsWith(hashRecord({ reviewerId: researcher.id }).slice(0, 8)),
    );
    const profileComments = comments.filter(
      (comment) =>
        comment.authorId === researcher.id ||
        comment.authorAlias.endsWith(hashRecord({ authorId: researcher.id }).slice(0, 8)),
    );

    return {
      researcherId: researcher.id,
      displayName: researcher.displayName || researcher.id,
      domain: researcher.domain || "general",
      institution: researcher.institution || "independent",
      tier: score.tier,
      badges: score.badges,
      reviewHistory: profileReviews.map((review) => ({
        reviewId: review.id,
        projectId: review.projectId,
        visibility: review.visibility,
        recommendation: review.recommendation,
        scoreAverage: review.scoreAverage,
        createdAt: review.createdAt,
      })),
      commentHistory: profileComments.map((comment) => ({
        commentId: comment.id,
        projectId: comment.projectId,
        target: comment.target,
        mode: comment.mode,
        status: comment.status,
        createdAt: comment.createdAt,
      })),
      creditSummary: {
        totalCredit: Number(profileContributions.reduce((sum, entry) => sum + entry.credit, 0).toFixed(4)),
        visibleCitationCredits: profileContributions
          .filter((entry) => entry.citationVisible)
          .map((entry) => ({
            contributionId: entry.id,
            projectId: entry.projectId,
            roles: entry.roles,
            type: entry.type,
            credit: entry.credit,
            timestamp: entry.timestamp,
          })),
      },
      profileHash: hashRecord({ researcherId: researcher.id, score, profileContributions, profileReviews, profileComments }),
    };
  });
}

function buildProjectTimelines(communityInput) {
  const community = normalizeCommunity(communityInput);
  const contributionLedger = buildContributionLedger(community);
  const reviews = community.reviews.map(createPeerReview);
  const comments = community.comments.map(createInlineComment);

  return community.projects.map((project) => {
    const events = [
      ...contributionLedger
        .filter((entry) => entry.projectId === project.id)
        .map((entry) => ({
          type: "contribution",
          id: entry.id,
          actorId: entry.contributorId,
          timestamp: entry.timestamp,
          summary: `${entry.type} contribution credited`,
          hash: entry.contributionHash,
        })),
      ...reviews
        .filter((review) => review.projectId === project.id)
        .map((review) => ({
          type: "review",
          id: review.id,
          actorId: review.reviewerId || review.reviewerAlias,
          timestamp: review.createdAt,
          summary: `${review.visibility} review ${review.recommendation}`,
          hash: review.reviewHash,
        })),
      ...comments
        .filter((comment) => comment.projectId === project.id)
        .map((comment) => ({
          type: "comment",
          id: comment.id,
          actorId: comment.authorId || comment.authorAlias,
          timestamp: comment.createdAt,
          summary: `${comment.mode} comment on ${comment.target.kind}`,
          hash: comment.commentHash,
        })),
    ].sort((left, right) => String(left.timestamp).localeCompare(String(right.timestamp)));

    return {
      projectId: project.id,
      title: project.title || project.id,
      visibility: project.visibility || "private",
      eventCount: events.length,
      events,
      timelineHash: hashRecord({ projectId: project.id, events }),
    };
  });
}

function buildCitationPages(communityInput) {
  const community = normalizeCommunity(communityInput);
  const profiles = buildResearcherProfiles(community);
  const profileById = new Map(profiles.map((profile) => [profile.researcherId, profile]));

  return community.projects.map((project) => {
    const credits = profiles.flatMap((profile) =>
      profile.creditSummary.visibleCitationCredits
        .filter((credit) => credit.projectId === project.id)
        .map((credit) => ({
          researcherId: profile.researcherId,
          displayName: profile.displayName,
          roles: credit.roles,
          type: credit.type,
          credit: credit.credit,
          tier: profileById.get(profile.researcherId).tier,
        })),
    );

    return {
      projectId: project.id,
      title: project.title || project.id,
      credits: credits.sort((left, right) => right.credit - left.credit || left.displayName.localeCompare(right.displayName)),
      citationText: credits
        .map((credit) => `${credit.displayName} (${credit.roles.join(", ") || credit.type})`)
        .join("; "),
      citationHash: hashRecord({ projectId: project.id, credits }),
    };
  });
}

function buildModerationSignals(communityInput) {
  const community = normalizeCommunity(communityInput);
  const signals = [];
  const activeEndorsements = community.endorsements.filter((endorsement) => endorsement.status !== "revoked");
  const activePairs = new Set(activeEndorsements.map((endorsement) => `${endorsement.from}->${endorsement.to}`));

  for (const endorsement of activeEndorsements) {
    if (endorsement.from === endorsement.to) {
      signals.push({
        type: "self-endorsement",
        severity: "medium",
        researcherId: endorsement.to,
        message: "Self-endorsements are ignored by reputation scoring.",
      });
    } else if (activePairs.has(`${endorsement.to}->${endorsement.from}`)) {
      signals.push({
        type: "reciprocal-endorsement",
        severity: "low",
        researcherId: endorsement.to,
        relatedResearcherId: endorsement.from,
        message: "Reciprocal endorsements should be reviewed for collusion risk.",
      });
    }
  }

  for (const review of community.reviews.map(createPeerReview)) {
    const narrativeLength = [
      review.narrative.summary,
      ...review.narrative.strengths,
      ...review.narrative.concerns,
    ].join(" ").trim().length;
    if (narrativeLength < 40) {
      signals.push({
        type: "thin-review",
        severity: "low",
        reviewId: review.id,
        message: "Structured score exists but the narrative is short.",
      });
    }
  }

  for (const [researcherId, metric] of Object.entries(community.metrics.researchers || {})) {
    for (const flag of asArray(metric.flags)) {
      signals.push({
        type: "metric-flag",
        severity: flag.severity === "high" ? "high" : "medium",
        researcherId,
        flagId: flag.id || null,
        message: flag.reason || "Researcher metric flag requires review.",
      });
    }
  }

  return {
    status: signals.some((signal) => signal.severity === "high") ? "needs-action" : signals.length ? "review" : "clear",
    signals,
    moderationHash: hashRecord(signals),
  };
}

function addDays(timestamp, days) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function countWords(value) {
  return String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function buildReviewQualityAudits(communityInput) {
  const community = normalizeCommunity(communityInput);
  return community.reviews.map((reviewInput) => {
    const review = createPeerReview(reviewInput);
    const missingScores = Object.entries(review.scores)
      .filter(([, score]) => score === 0)
      .map(([criterion]) => criterion);
    const narrativeWordCount = [
      review.narrative.summary,
      ...review.narrative.strengths,
      ...review.narrative.concerns,
    ].reduce((sum, entry) => sum + countWords(entry), 0);
    const missingNarrative = [];
    if (countWords(review.narrative.summary) < 6) missingNarrative.push("summary");
    if (review.narrative.strengths.length === 0) missingNarrative.push("strengths");
    if (review.narrative.concerns.length === 0) missingNarrative.push("concerns");

    const scoreSpread = Number(
      (Math.max(...Object.values(review.scores)) - Math.min(...Object.values(review.scores))).toFixed(4),
    );
    const qualityScore = Math.max(
      0,
      100 - missingScores.length * 18 - missingNarrative.length * 14 - (narrativeWordCount < 30 ? 12 : 0),
    );

    return {
      reviewId: review.id,
      projectId: review.projectId,
      reviewerAlias: review.reviewerAlias,
      visibility: review.visibility,
      missingScores,
      missingNarrative,
      narrativeWordCount,
      scoreSpread,
      qualityScore,
      status: qualityScore >= 80 ? "accepted" : qualityScore >= 60 ? "needs-editor-check" : "needs-revision",
      auditHash: hashRecord({ review, missingScores, missingNarrative, narrativeWordCount, qualityScore }),
    };
  });
}

function buildAppealDocket(communityInput) {
  const community = normalizeCommunity(communityInput);
  return community.appeals.map((appeal) => ({
    id: appeal.id || `appeal-${hashRecord(appeal)}`,
    researcherId: appeal.researcherId,
    targetType: appeal.targetType || "reputation-score",
    targetId: appeal.targetId || appeal.researcherId,
    status: appeal.status || "open",
    openedAt: appeal.openedAt || null,
    dueBy: appeal.dueBy || (appeal.openedAt ? addDays(appeal.openedAt, 14) : null),
    reviewerGroup: appeal.reviewerGroup || "community-governance",
    requestedChange: appeal.requestedChange || "",
    evidenceHash: hashRecord({
      researcherId: appeal.researcherId,
      targetType: appeal.targetType || "reputation-score",
      targetId: appeal.targetId || appeal.researcherId,
      requestedChange: appeal.requestedChange || "",
      openedAt: appeal.openedAt || null,
    }),
  }));
}

function buildReputationChangeLedger(communityInput) {
  const community = normalizeCommunity(communityInput);
  const moderation = buildModerationSignals(community);
  return community.researchers.map((researcher) => {
    const score = scoreResearcher(community, researcher.id);
    const metric = (community.metrics.researchers || {})[researcher.id] || {};
    const previousTotal = Number(metric.previousReputation || 0);
    const delta = Number((score.total - previousTotal).toFixed(4));
    const researcherSignals = moderation.signals.filter((signal) => signal.researcherId === researcher.id);
    const highRisk = researcherSignals.some((signal) => signal.severity === "high");
    const largeDelta = Math.abs(delta) >= 35;

    return {
      researcherId: researcher.id,
      displayName: score.displayName,
      previousTotal,
      currentTotal: score.total,
      delta,
      previousTier: metric.previousTier || null,
      currentTier: score.tier,
      status: highRisk || largeDelta ? "review-required" : "published",
      reason: highRisk
        ? "High-severity moderation signal is attached to this researcher."
        : largeDelta
          ? "Large reputation delta requires governance review before promotion surfaces update."
          : "Transparent score change can be published.",
      moderationSignalCount: researcherSignals.length,
      changeHash: hashRecord({ researcherId: researcher.id, components: score.components, previousTotal, delta }),
    };
  });
}

function buildGovernanceReport(communityInput) {
  const reviewQuality = buildReviewQualityAudits(communityInput);
  const reputationChanges = buildReputationChangeLedger(communityInput);
  const appeals = buildAppealDocket(communityInput);

  const requiredActions = [
    ...reviewQuality
      .filter((audit) => audit.status !== "accepted")
      .map((audit) => ({
        type: "review-quality",
        severity: audit.status === "needs-revision" ? "high" : "medium",
        targetId: audit.reviewId,
        message: "Review needs additional scores or narrative before it should affect reputation.",
      })),
    ...reputationChanges
      .filter((change) => change.status === "review-required")
      .map((change) => ({
        type: "reputation-change",
        severity: "medium",
        targetId: change.researcherId,
        message: change.reason,
      })),
    ...appeals
      .filter((appeal) => appeal.status === "open")
      .map((appeal) => ({
        type: "appeal",
        severity: "medium",
        targetId: appeal.id,
        message: `Resolve appeal by ${appeal.dueBy || "the governance SLA"}.`,
      })),
  ];

  return {
    status: requiredActions.some((action) => action.severity === "high")
      ? "blocked"
      : requiredActions.length
        ? "needs-governance-review"
        : "clear",
    reviewQuality,
    reputationChanges,
    appeals,
    requiredActions,
    governanceHash: hashRecord({ reviewQuality, reputationChanges, appeals, requiredActions }),
  };
}

function buildCommunityReputationPacket(communityInput) {
  const community = normalizeCommunity(communityInput);
  const reviews = community.reviews.map(createPeerReview);
  const comments = community.comments.map(createInlineComment);
  const contributionLedger = buildContributionLedger(community);
  const contributorGraph = buildContributorGraph(community);
  const reputationScores = community.researchers.map((researcher) => scoreResearcher(community, researcher.id));
  const researcherProfiles = buildResearcherProfiles(community);
  const projectTimelines = buildProjectTimelines(community);
  const citationPages = buildCitationPages(community);
  const moderation = buildModerationSignals(community);
  const governance = buildGovernanceReport(community);

  return {
    reviewTemplates: Object.keys(REVIEW_TEMPLATES).map(selectReviewTemplate),
    reviews,
    comments,
    contributionLedger,
    contributorGraph,
    researcherProfiles,
    projectTimelines,
    citationPages,
    reputationScores,
    leaderboards: {
      domain: buildLeaderboards(community, "domain"),
      region: buildLeaderboards(community, "region"),
      institution: buildLeaderboards(community, "institution"),
    },
    moderation,
    governance,
    incentiveTiers: ["emerging-contributor", "active-collaborator", "trusted-reviewer", "open-science-champion"],
    packetHash: hashRecord({
      reviews,
      comments,
      contributionLedger,
      researcherProfiles,
      projectTimelines,
      citationPages,
      reputationScores,
      moderation,
      governance,
    }),
  };
}

module.exports = {
  CREDIT_ROLES,
  REVIEW_TEMPLATES,
  REVIEW_VISIBILITY,
  buildCommunityReputationPacket,
  buildContributionLedger,
  buildContributorGraph,
  buildCitationPages,
  buildGovernanceReport,
  buildLeaderboards,
  buildModerationSignals,
  buildProjectTimelines,
  buildReputationChangeLedger,
  buildResearcherProfiles,
  buildReviewQualityAudits,
  createInlineComment,
  createPeerReview,
  hashRecord,
  scoreResearcher,
  selectReviewTemplate,
};
