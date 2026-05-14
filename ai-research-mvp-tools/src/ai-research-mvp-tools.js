"use strict";

const crypto = require("crypto");

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "in",
  "into",
  "is",
  "it",
  "of",
  "on",
  "or",
  "our",
  "that",
  "the",
  "this",
  "to",
  "with",
]);

const REVIEW_TEMPLATES = {
  biology: {
    requiredSections: ["methods", "ethics", "data availability", "results"],
    statisticalChecks: ["p-value", "confidence interval", "sample size"],
  },
  physics: {
    requiredSections: ["methods", "uncertainty", "results"],
    statisticalChecks: ["error bars", "confidence interval"],
  },
  "social-sciences": {
    requiredSections: ["methods", "ethics", "limitations", "data availability"],
    statisticalChecks: ["sample size", "confidence interval", "p-value"],
  },
  general: {
    requiredSections: ["methods", "results", "data availability"],
    statisticalChecks: ["sample size", "confidence interval"],
  },
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

function splitSentences(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .match(/[a-z][a-z0-9-]{2,}/g)
    ?.filter((word) => !STOPWORDS.has(word)) || [];
}

function keywordCounts(text) {
  const counts = new Map();
  for (const token of tokenize(text)) counts.set(token, (counts.get(token) || 0) + 1);
  return counts;
}

function topKeywords(text, limit = 8) {
  return Array.from(keywordCounts(text).entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([keyword]) => keyword);
}

function sentenceScore(sentence, keywords) {
  const tokens = tokenize(sentence);
  const keywordSet = new Set(keywords);
  const keywordHits = tokens.filter((token) => keywordSet.has(token)).length;
  const numberBonus = /\d/.test(sentence) ? 1 : 0;
  return keywordHits + numberBonus + Math.min(tokens.length / 40, 1);
}

function summarizePaper(documentInput, mode = "abstract") {
  const document = normalizeDocument(documentInput);
  const sentences = splitSentences(document.body);
  const keywords = topKeywords(document.body, 10);
  const ranked = sentences
    .map((sentence, index) => ({ sentence, index, score: sentenceScore(sentence, keywords) }))
    .sort((left, right) => right.score - left.score || left.index - right.index);
  const selectedCount = mode === "layperson" ? 2 : mode === "executive" ? 4 : 3;
  const selected = ranked.slice(0, selectedCount).sort((left, right) => left.index - right.index).map((item) => item.sentence);

  return {
    id: `summary-${hashRecord({ documentId: document.id, mode, selected })}`,
    documentId: document.id,
    mode,
    title: document.title,
    summary:
      mode === "layperson"
        ? simplifyLanguage(selected.join(" "))
        : selected.join(" "),
    keyFindings: extractFindings(sentences),
    implications: extractImplications(sentences),
    nextSteps: extractNextSteps(sentences),
    keywords,
    summaryHash: hashRecord({ documentId: document.id, mode, selected, keywords }),
  };
}

function simplifyLanguage(text) {
  return String(text || "")
    .replace(/reproducibility/gi, "ability to repeat the work")
    .replace(/a statistically significant/gi, "an unlikely-to-be-random")
    .replace(/statistically significant/gi, "unlikely to be due to chance")
    .replace(/methodology/gi, "methods");
}

function extractFindings(sentences) {
  return sentences.filter((sentence) => /find|found|result|show|demonstrat|increase|decrease/i.test(sentence)).slice(0, 3);
}

function extractImplications(sentences) {
  return sentences.filter((sentence) => /suggest|implicat|therefore|could|may|supports/i.test(sentence)).slice(0, 3);
}

function extractNextSteps(sentences) {
  return sentences.filter((sentence) => /future|next|should|need|remain|validate/i.test(sentence)).slice(0, 3);
}

function normalizeDocument(documentInput) {
  if (!documentInput || typeof documentInput !== "object") throw new TypeError("document must be an object");
  return {
    id: documentInput.id || "document-unknown",
    title: documentInput.title || "Untitled research document",
    domain: documentInput.domain || "general",
    body: documentInput.body || "",
    references: asArray(documentInput.references),
  };
}

function detectSimilarity(documentInput, corpus = []) {
  const document = normalizeDocument(documentInput);
  const sourceTokens = new Set(tokenize(document.body));
  return asArray(corpus)
    .map((candidate) => {
      const candidateTokens = new Set(tokenize(candidate.body || candidate.abstract || ""));
      const overlap = Array.from(sourceTokens).filter((token) => candidateTokens.has(token));
      const denominator = new Set([...sourceTokens, ...candidateTokens]).size || 1;
      return {
        sourceId: candidate.id,
        title: candidate.title,
        similarity: Number((overlap.length / denominator).toFixed(4)),
        overlappingTerms: overlap.slice(0, 10),
      };
    })
    .filter((result) => result.similarity >= 0.12)
    .sort((left, right) => right.similarity - left.similarity || left.title.localeCompare(right.title));
}

function reviewManuscript(documentInput, options = {}) {
  const document = normalizeDocument(documentInput);
  const template = REVIEW_TEMPLATES[options.domain || document.domain] || REVIEW_TEMPLATES.general;
  const bodyLower = document.body.toLowerCase();
  const missingSections = template.requiredSections.filter((section) => !bodyLower.includes(section));
  const missingStats = template.statisticalChecks.filter((check) => !hasStatisticalSignal(document.body, check));
  const reportsPValue = /p\s*[<=>]\s*0?\.\d+/i.test(document.body);
  const reportsNumericCi =
    /confidence interval[^.]{0,80}\d/i.test(document.body) || /\bci\b[^.]{0,80}\d/i.test(document.body);
  const hasPValueNoCi = reportsPValue && !reportsNumericCi;
  const passiveToneCount = (document.body.match(/\b(was|were|is|are|been) [a-z]+ed\b/gi) || []).length;
  const similarityMatches = detectSimilarity(document, options.openAccessCorpus || []);
  const findings = [
    ...missingSections.map((section) => ({
      severity: section === "ethics" || section === "data availability" ? "warning" : "info",
      category: "compliance",
      message: `Missing or unclear ${section} section`,
    })),
    ...missingStats.map((check) => ({
      severity: "info",
      category: "statistics",
      message: `No explicit ${check} reporting detected`,
    })),
    ...(hasPValueNoCi
      ? [{ severity: "warning", category: "statistics", message: "p-value reported without confidence interval" }]
      : []),
    ...(passiveToneCount > 4
      ? [{ severity: "info", category: "clarity", message: "High passive-voice signal; consider clearer active phrasing" }]
      : []),
    ...similarityMatches.slice(0, 2).map((match) => ({
      severity: match.similarity >= 0.25 ? "warning" : "info",
      category: "similarity",
      message: `Similarity signal with ${match.title}`,
      evidence: match,
    })),
  ];

  return {
    documentId: document.id,
    domain: options.domain || document.domain,
    template,
    findings,
    qualityScore: Number(Math.max(0, 100 - findings.filter((finding) => finding.severity === "warning").length * 18 - findings.length * 3).toFixed(2)),
    reportHash: hashRecord({ documentId: document.id, findings }),
  };
}

function hasStatisticalSignal(text, check) {
  const body = String(text || "").toLowerCase();
  if (check === "p-value") return /p\s*[<=>]\s*0?\.\d+/i.test(text) || body.includes("p-value");
  if (check === "sample size") {
    return (
      /\b(n|samples?|participants?)\s*[=:]?\s*\d+/i.test(text) ||
      /\d+(?:\s+[a-z-]+){0,3}\s+(samples?|participants?)/i.test(text)
    );
  }
  if (check === "confidence interval") return /confidence interval|ci\b/i.test(text);
  if (check === "error bars") return /error bars?|uncertainty interval/i.test(text);
  return body.includes(check);
}

function recommendCitations(documentInput, citationCorpus = [], options = {}) {
  const document = normalizeDocument(documentInput);
  const documentKeywords = new Set(topKeywords(document.body, 16));
  const existingDois = new Set(document.references.map((reference) => reference.doi).filter(Boolean));

  return asArray(citationCorpus)
    .filter((candidate) => !existingDois.has(candidate.doi))
    .map((candidate) => {
      const candidateKeywords = new Set(tokenize(`${candidate.title || ""} ${candidate.abstract || ""}`));
      const overlap = Array.from(documentKeywords).filter((keyword) => candidateKeywords.has(keyword));
      const recencyBonus = candidate.year && candidate.year >= 2023 ? 2 : 0;
      const citationBonus = Math.min(8, Number(candidate.citations || 0) / 25);
      const score = Number((overlap.length * 4 + recencyBonus + citationBonus).toFixed(4));
      return {
        id: candidate.id,
        title: candidate.title,
        doi: candidate.doi,
        year: candidate.year,
        score,
        matchedTerms: overlap,
        formatted: formatReference(candidate, options.style || "apa"),
      };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title))
    .slice(0, options.limit || 5);
}

function formatReference(reference, style = "apa") {
  const authors = asArray(reference.authors).join(", ") || "Unknown authors";
  const year = reference.year || "n.d.";
  const title = reference.title || "Untitled work";
  const doi = reference.doi ? `https://doi.org/${reference.doi}` : "DOI pending";

  if (style === "nature") return `${authors}. ${title}. ${reference.venue || "Preprint"} (${year}). ${doi}`;
  if (style === "mla") return `${authors}. "${title}." ${reference.venue || "Preprint"}, ${year}, ${doi}.`;
  return `${authors} (${year}). ${title}. ${reference.venue || "Preprint"}. ${doi}.`;
}

function buildResearchToolsPacket(input) {
  const document = normalizeDocument(input.document);
  const openAccessCorpus = asArray(input.openAccessCorpus);
  const citationCorpus = asArray(input.citationCorpus);
  const summaries = {
    abstract: summarizePaper(document, "abstract"),
    executive: summarizePaper(document, "executive"),
    layperson: summarizePaper(document, "layperson"),
  };
  const reviewReport = reviewManuscript(document, { domain: document.domain, openAccessCorpus });
  const citationRecommendations = recommendCitations(document, citationCorpus, { style: "apa", limit: 5 });

  return {
    document: {
      id: document.id,
      title: document.title,
      domain: document.domain,
    },
    summaries,
    reviewReport,
    citationRecommendations,
    insertActions: citationRecommendations.map((citation) => ({
      action: "insert-citation",
      doi: citation.doi,
      label: citation.formatted,
    })),
    packetHash: hashRecord({ documentId: document.id, summaries, reviewReport, citationRecommendations }),
  };
}

module.exports = {
  REVIEW_TEMPLATES,
  buildResearchToolsPacket,
  detectSimilarity,
  formatReference,
  hashRecord,
  recommendCitations,
  reviewManuscript,
  summarizePaper,
  topKeywords,
};
