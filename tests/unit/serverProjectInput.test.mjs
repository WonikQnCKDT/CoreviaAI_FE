import { test } from "node:test";
import assert from "node:assert/strict";
import { hasServerProjectDraft, positiveServerId, validServerProjectCode } from "../../src/features/project/utils/serverProjectInput.ts";

test("accepts positive safe server IDs and rejects invalid IDs", () => {
  assert.equal(positiveServerId("7"), 7);
  assert.equal(positiveServerId("9007199254740991"), Number.MAX_SAFE_INTEGER);
  for (const input of ["", "0", "-1", "1.2", "2e3", "01", "9007199254740992"]) {
    assert.equal(positiveServerId(input), null, input);
  }
});

test("validates the existing BE project code format", () => {
  for (const input of ["QA", "Qa-12", " A2 ", "A".repeat(20)]) assert.equal(validServerProjectCode(input), true);
  for (const input of ["", "A", "-AA", "Q_A", "한글", "A".repeat(21)]) assert.equal(validServerProjectCode(input), false);
});

const emptyDraft = {
  basic: { name: "", code: "", startDate: "", endDate: "", department: "", visibility: "company" },
  methodology: null,
  departmentType: null,
  memberCount: 0,
  memberId: "",
  memberActor: "",
  approver: null,
};

test("a blank or fully reverted form does not warn about unsaved work", () => {
  assert.equal(hasServerProjectDraft(emptyDraft), false);
  const edited = { ...emptyDraft, basic: { ...emptyDraft.basic, name: "New project" } };
  assert.equal(hasServerProjectDraft(edited), true);
  assert.equal(hasServerProjectDraft({ ...edited, basic: { ...edited.basic, name: "" } }), false);
});

test("any basic field, a later selection or an unfinished invitation counts as a draft", () => {
  const basicChanges = { name: " ", code: "A", startDate: "2026-11-18", endDate: "2026-11-19", department: "x", visibility: "members" };
  for (const [key, value] of Object.entries(basicChanges)) {
    assert.equal(hasServerProjectDraft({ ...emptyDraft, basic: { ...emptyDraft.basic, [key]: value } }), true, key);
  }
  const laterChanges = { methodology: "waterfall", departmentType: "sw", memberCount: 1, memberId: "7", memberActor: "qa", approver: 7 };
  for (const [key, value] of Object.entries(laterChanges)) {
    assert.equal(hasServerProjectDraft({ ...emptyDraft, [key]: value }), true, key);
  }
});
