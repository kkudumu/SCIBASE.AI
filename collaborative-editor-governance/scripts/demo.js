"use strict";

const sample = require("../data/sample-document.json");
const { buildCollaborativeEditorPacket } = require("../src/editor-governance");

const packet = buildCollaborativeEditorPacket(sample.document, sample.operations);

console.log(
  JSON.stringify(
    {
      title: packet.document.title,
      acceptedOperations: packet.operationResults.filter((result) => result.accepted).length,
      rejectedOperations: packet.operationResults.filter((result) => !result.accepted).length,
      snapshot: packet.snapshot,
      readyForSubmission: packet.dashboard.readyForSubmission,
      sections: packet.dashboard.sections,
      outlineHash: packet.outline.exportHash,
    },
    null,
    2,
  ),
);
