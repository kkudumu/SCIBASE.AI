"use strict";

const crypto = require("crypto");

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function hashRecord(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 18);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeDocument(documentInput) {
  if (!documentInput || typeof documentInput !== "object") {
    throw new TypeError("document must be an object");
  }

  return {
    id: documentInput.id || "document-unknown",
    title: documentInput.title || "Untitled research document",
    collaborators: asArray(documentInput.collaborators),
    blocks: asArray(documentInput.blocks),
    comments: asArray(documentInput.comments),
    suggestions: asArray(documentInput.suggestions),
    locks: asArray(documentInput.locks),
    tasks: asArray(documentInput.tasks),
    presence: asArray(documentInput.presence),
    versions: asArray(documentInput.versions),
    references: asArray(documentInput.references),
    publicationTemplates: asArray(documentInput.publicationTemplates),
    offlineQueues: asArray(documentInput.offlineQueues),
  };
}

function findBlockIndex(document, blockId) {
  return document.blocks.findIndex((block) => block.id === blockId);
}

function isSectionLocked(document, sectionId, actorId) {
  return document.locks.some(
    (lock) =>
      lock.sectionId === sectionId &&
      lock.status === "active" &&
      lock.ownerId !== actorId,
  );
}

function applyOperation(documentInput, operation) {
  const document = normalizeDocument(clone(documentInput));
  const op = operation || {};
  const actorId = op.actorId || "unknown";
  const blockIndex = op.blockId ? findBlockIndex(document, op.blockId) : -1;
  const currentBlock = blockIndex >= 0 ? document.blocks[blockIndex] : null;
  const sectionId = op.sectionId || (currentBlock && currentBlock.sectionId);

  if (sectionId && isSectionLocked(document, sectionId, actorId)) {
    return {
      document,
      accepted: false,
      reason: "section-locked",
      operationHash: hashRecord(op),
    };
  }

  if (op.type === "insert-block") {
    const block = {
      id: op.block.id,
      sectionId: op.block.sectionId || sectionId || "general",
      type: op.block.type || "markdown",
      content: op.block.content || "",
      metadata: op.block.metadata || {},
    };
    document.blocks.splice(Number.isInteger(op.index) ? op.index : document.blocks.length, 0, block);
  } else if (op.type === "update-block" && currentBlock) {
    document.blocks[blockIndex] = {
      ...currentBlock,
      content: op.content === undefined ? currentBlock.content : op.content,
      metadata: { ...currentBlock.metadata, ...(op.metadata || {}) },
    };
  } else if (op.type === "delete-block" && currentBlock) {
    document.blocks.splice(blockIndex, 1);
  } else if (op.type === "comment") {
    document.comments.push({
      id: op.id || `comment-${document.comments.length + 1}`,
      blockId: op.blockId,
      actorId,
      body: op.body || "",
      status: "open",
    });
  } else if (op.type === "suggestion") {
    document.suggestions.push({
      id: op.id || `suggestion-${document.suggestions.length + 1}`,
      blockId: op.blockId,
      actorId,
      proposedContent: op.proposedContent || "",
      status: "pending",
    });
  } else if (op.type === "task") {
    document.tasks.push({
      id: op.id || `task-${document.tasks.length + 1}`,
      title: op.title || "Untitled task",
      assigneeId: op.assigneeId || actorId,
      status: op.status || "open",
      linkedBlockId: op.blockId || null,
    });
  } else {
    return {
      document,
      accepted: false,
      reason: "unsupported-operation",
      operationHash: hashRecord(op),
    };
  }

  return {
    document,
    accepted: true,
    operationHash: hashRecord(op),
  };
}

function applyOperationBatch(documentInput, operations) {
  let document = normalizeDocument(documentInput);
  const results = asArray(operations).map((operation) => {
    const result = applyOperation(document, operation);
    if (result.accepted) document = result.document;
    return {
      accepted: result.accepted,
      reason: result.reason || null,
      operationHash: result.operationHash,
    };
  });

  return {
    document,
    results,
    acceptedCount: results.filter((result) => result.accepted).length,
    rejectedCount: results.filter((result) => !result.accepted).length,
  };
}

function createVersionSnapshot(documentInput, label) {
  const document = normalizeDocument(documentInput);
  return {
    id: `snapshot-${document.versions.length + 1}`,
    label: label || "autosave",
    documentId: document.id,
    blockCount: document.blocks.length,
    openComments: document.comments.filter((comment) => comment.status === "open").length,
    pendingSuggestions: document.suggestions.filter((suggestion) => suggestion.status === "pending").length,
    openTasks: document.tasks.filter((task) => task.status !== "done").length,
    contentHash: hashRecord(document.blocks),
    createdAt: new Date().toISOString(),
  };
}

function buildPresenceSummary(documentInput) {
  const document = normalizeDocument(documentInput);
  return document.presence.map((presence) => ({
    userId: presence.userId,
    name: presence.name || presence.userId,
    sectionId: presence.sectionId || null,
    cursorBlockId: presence.cursorBlockId || null,
    stale: presence.lastSeenAt
      ? Date.now() - new Date(presence.lastSeenAt).getTime() > 1000 * 60 * 5
      : true,
  }));
}

function buildScientificFormattingSummary(documentInput) {
  const document = normalizeDocument(documentInput);
  const blocks = document.blocks;
  const citationKeys = new Set(document.references.map((reference) => reference.key).filter(Boolean));
  const citedKeys = new Set();
  const unresolvedCitations = [];

  for (const block of blocks) {
    const content = String(block.content || "");
    for (const match of content.matchAll(/@([A-Za-z0-9:_-]+)/g)) {
      citedKeys.add(match[1]);
      if (!citationKeys.has(match[1])) unresolvedCitations.push(match[1]);
    }
  }

  const blockTypes = new Set(blocks.map((block) => block.type));
  const hasLatex = blocks.some((block) => block.type === "latex" || /\$[^$]+\$/.test(String(block.content || "")));
  const hasCodeHighlighting = blocks.some((block) => block.type === "code" && block.metadata.language);
  const hasNotebook = blocks.some((block) => block.type === "notebook-cell");
  const templates = document.publicationTemplates.map((template) => ({
    id: template.id,
    name: template.name || template.id,
    style: template.style || "generic",
    requiredSections: asArray(template.requiredSections),
  }));

  return {
    markdownBlocks: blocks.filter((block) => block.type === "markdown").length,
    supportsLatex: hasLatex,
    supportsCodeHighlighting: hasCodeHighlighting,
    supportsNotebookCells: hasNotebook,
    blockTypes: [...blockTypes].sort(),
    referenceManager: {
      totalReferences: document.references.length,
      providers: [...new Set(document.references.map((reference) => reference.provider || "manual"))].sort(),
      citedKeys: [...citedKeys].sort(),
      unresolvedCitations: [...new Set(unresolvedCitations)].sort(),
    },
    publicationTemplates: templates,
  };
}

function buildReviewDashboard(documentInput) {
  const document = normalizeDocument(documentInput);
  const sectionMap = new Map();

  for (const block of document.blocks) {
    const section = sectionMap.get(block.sectionId) || {
      sectionId: block.sectionId,
      blocks: 0,
      comments: 0,
      suggestions: 0,
      locked: document.locks.some((lock) => lock.sectionId === block.sectionId && lock.status === "active"),
    };
    section.blocks += 1;
    sectionMap.set(block.sectionId, section);
  }

  for (const comment of document.comments.filter((comment) => comment.status === "open")) {
    const block = document.blocks.find((candidate) => candidate.id === comment.blockId);
    if (block && sectionMap.has(block.sectionId)) sectionMap.get(block.sectionId).comments += 1;
  }

  for (const suggestion of document.suggestions.filter((suggestion) => suggestion.status === "pending")) {
    const block = document.blocks.find((candidate) => candidate.id === suggestion.blockId);
    if (block && sectionMap.has(block.sectionId)) sectionMap.get(block.sectionId).suggestions += 1;
  }

  return {
    documentId: document.id,
    title: document.title,
    sections: [...sectionMap.values()],
    presence: buildPresenceSummary(document),
    formatting: buildScientificFormattingSummary(document),
    openTasks: document.tasks.filter((task) => task.status !== "done"),
    readyForSubmission:
      document.comments.every((comment) => comment.status !== "open") &&
      document.suggestions.every((suggestion) => suggestion.status !== "pending") &&
      document.tasks.every((task) => task.status === "done"),
  };
}

function exportPublicationOutline(documentInput) {
  const document = normalizeDocument(documentInput);
  const sections = [];
  for (const block of document.blocks) {
    let section = sections.find((candidate) => candidate.sectionId === block.sectionId);
    if (!section) {
      section = {
        sectionId: block.sectionId,
        heading: block.metadata.heading || block.sectionId,
        blockTypes: [],
        wordCount: 0,
      };
      sections.push(section);
    }
    section.blockTypes.push(block.type);
    section.wordCount += String(block.content || "").split(/\s+/).filter(Boolean).length;
  }

  return {
    documentId: document.id,
    title: document.title,
    sections,
    exportHash: hashRecord({ title: document.title, sections }),
  };
}

function blockContentHash(block) {
  return block ? hashRecord({ content: block.content || "", metadata: block.metadata || {} }) : null;
}

function offlineConflictForOperation(document, operation) {
  const op = operation || {};
  const actorId = op.actorId || "unknown";
  const blockIndex = op.blockId ? findBlockIndex(document, op.blockId) : -1;
  const currentBlock = blockIndex >= 0 ? document.blocks[blockIndex] : null;
  const sectionId = op.sectionId || (currentBlock && currentBlock.sectionId) || (op.block && op.block.sectionId);
  const conflicts = [];

  if (op.blockId && !currentBlock && op.type !== "insert-block") {
    conflicts.push({
      code: "REVIEW_TARGET_MISSING",
      severity: "high",
      message: "Queued operation targets a block that no longer exists.",
      blockId: op.blockId,
      resolution: "manual-review",
    });
  }

  if (sectionId && isSectionLocked(document, sectionId, actorId)) {
    conflicts.push({
      code: "SECTION_LOCK_CONFLICT",
      severity: "high",
      message: "Queued operation conflicts with an active section lock.",
      sectionId,
      actorId,
      resolution: "defer-until-unlocked",
    });
  }

  if (currentBlock && op.baseBlockHash && op.baseBlockHash !== blockContentHash(currentBlock)) {
    conflicts.push({
      code: op.type === "update-block" ? "STALE_BLOCK_VERSION" : "REVIEW_CONTEXT_STALE",
      severity: "medium",
      message: "Queued operation was based on an older block version.",
      blockId: op.blockId,
      expectedHash: op.baseBlockHash,
      actualHash: blockContentHash(currentBlock),
      resolution: op.type === "update-block" ? "converted-to-suggestion" : "preserve-with-context-warning",
    });
  }

  return conflicts;
}

function rebaseOfflineQueue(documentInput, queueInput) {
  let document = normalizeDocument(documentInput);
  const queue = queueInput || {};
  const conflicts = [];
  const applied = [];
  const baseSnapshot = createVersionSnapshot(document, `${queue.clientId || "offline"} rebase base`);

  for (const operation of asArray(queue.operations)) {
    const operationConflicts = offlineConflictForOperation(document, operation);
    conflicts.push(...operationConflicts.map((conflict) => ({
      ...conflict,
      operationHash: hashRecord(operation),
    })));

    const hasBlockingConflict = operationConflicts.some(
      (conflict) => conflict.code === "SECTION_LOCK_CONFLICT" || conflict.code === "REVIEW_TARGET_MISSING",
    );
    if (hasBlockingConflict) continue;

    const staleUpdate = operationConflicts.some((conflict) => conflict.code === "STALE_BLOCK_VERSION");
    const operationToApply = staleUpdate
      ? {
        type: "suggestion",
        id: operation.rebasedSuggestionId || `offline-suggestion-${applied.length + 1}`,
        actorId: operation.actorId,
        blockId: operation.blockId,
        proposedContent: operation.content || operation.proposedContent || "",
      }
      : operation;

    const result = applyOperation(document, operationToApply);
    if (result.accepted) {
      document = result.document;
      applied.push({
        originalOperationHash: hashRecord(operation),
        appliedOperationHash: result.operationHash,
        rebasedAs: staleUpdate ? "suggestion" : operation.type,
      });
    } else {
      conflicts.push({
        code: "REBASE_APPLICATION_REJECTED",
        severity: "medium",
        message: "Queued operation could not be applied after conflict checks.",
        reason: result.reason,
        operationHash: result.operationHash,
        resolution: "manual-review",
      });
    }
  }

  const restoreSnapshot = createVersionSnapshot(document, `${queue.clientId || "offline"} restore point`);

  return {
    clientId: queue.clientId || "offline-client",
    baseVersionId: queue.baseVersionId || null,
    baseContentHash: queue.baseContentHash || baseSnapshot.contentHash,
    appliedCount: applied.length,
    conflictCount: conflicts.length,
    applied,
    conflicts,
    restoreSnapshot,
    auditHash: hashRecord({
      clientId: queue.clientId,
      applied,
      conflicts,
      restoreSnapshot: restoreSnapshot.contentHash,
    }),
  };
}

function buildOfflineConflictReport(documentInput) {
  const document = normalizeDocument(documentInput);
  const queueReports = document.offlineQueues.map((queue) => rebaseOfflineQueue(document, queue));
  const conflicts = queueReports.flatMap((report) => report.conflicts);

  return {
    documentId: document.id,
    queueCount: queueReports.length,
    appliedCount: queueReports.reduce((sum, report) => sum + report.appliedCount, 0),
    conflictCount: conflicts.length,
    conflictCodes: [...new Set(conflicts.map((conflict) => conflict.code))].sort(),
    queues: queueReports,
    auditHash: hashRecord(queueReports.map((report) => ({
      clientId: report.clientId,
      appliedCount: report.appliedCount,
      conflictCount: report.conflictCount,
      auditHash: report.auditHash,
    }))),
  };
}

function buildCollaborativeEditorPacket(documentInput, operations) {
  const batch = applyOperationBatch(documentInput, operations);
  const snapshot = createVersionSnapshot(batch.document, "post-operation autosave");
  const documentWithSnapshot = {
    ...batch.document,
    versions: [...batch.document.versions, snapshot],
  };

  return {
    operationResults: batch.results,
    document: documentWithSnapshot,
    snapshot,
    dashboard: buildReviewDashboard(documentWithSnapshot),
    formatting: buildScientificFormattingSummary(documentWithSnapshot),
    offlineConflicts: buildOfflineConflictReport(documentInput),
    outline: exportPublicationOutline(documentWithSnapshot),
  };
}

module.exports = {
  applyOperation,
  applyOperationBatch,
  buildCollaborativeEditorPacket,
  buildOfflineConflictReport,
  buildPresenceSummary,
  buildReviewDashboard,
  buildScientificFormattingSummary,
  createVersionSnapshot,
  exportPublicationOutline,
  hashRecord,
  isSectionLocked,
  normalizeDocument,
  rebaseOfflineQueue,
};
