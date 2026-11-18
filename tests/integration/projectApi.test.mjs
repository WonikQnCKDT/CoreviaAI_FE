import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

let vite;
let api;
const previousApiUrl = process.env.VITE_API_URL;

before(async () => {
  process.env.VITE_API_URL = "/api";
  globalThis.window = { setTimeout, clearTimeout };
  vite = await createServer({
    configFile: false,
    resolve: { alias: { "@": fileURLToPath(new URL("../../src", import.meta.url)) } },
    server: { middlewareMode: true, ws: false, watch: null },
  });
  api = await vite.ssrLoadModule("/src/features/project/api/projectApi.ts");
});

after(async () => {
  await vite?.close();
  delete globalThis.window;
  if (previousApiUrl === undefined) delete process.env.VITE_API_URL;
  else process.env.VITE_API_URL = previousApiUrl;
});

function mockRequest(t, method, path, body, response, status = 200) {
  const fetch = t.mock.method(globalThis, "fetch", async (url, request) => {
    assert.equal(new URL(url, "http://localhost").pathname + new URL(url, "http://localhost").search, path);
    assert.equal(request.method, method);
    assert.equal(request.credentials, "include");
    if (body) assert.deepEqual(JSON.parse(request.body), body);
    return Response.json(response, { status });
  });
  t.after(() => assert.equal(fetch.mock.callCount(), 1));
}

test("sends creation payload and maps the returned server project", async (t) => {
  const options = {
    name: "QA", code: "QA-01", startDate: "2026-11-18", endDate: "2026-11-19",
    departmentId: 3, visibility: "company", methodology: "waterfall", departmentType: "sw",
    actors: ["pm", "dev"], members: [{ userId: 8, actor: "dev" }], gateApproverUserId: 8,
  };
  const payload = {
    ...options, visibility: "COMPANY", methodology: "WATERFALL", departmentType: "SW",
    actors: ["PM", "DEVELOPER"], members: [{ userId: 8, actor: "DEVELOPER" }],
  };
  mockRequest(t, "POST", "/api/projects", payload, {
    success: true, response: { ...payload, id: 1, pmUserId: 7, members: [{ ...payload.members[0], name: "QA User" }] },
  });
  const result = await api.createProject({ input: options });
  assert.equal(result.ok, true);
  assert.equal(result.data.id, 1);
  assert.equal(result.data.members[0].actor, "dev");
});

test("propagates permission denial from the code check", async (t) => {
  mockRequest(t, "GET", "/api/projects/code-availability?code=QA-01", null,
    { success: false, error: { code: "PROJECT_CREATION_FORBIDDEN", message: "Denied" } }, 403);
  const result = await api.checkProjectCode({ code: "QA-01" });
  assert.deepEqual(result, { ok: false, failure: { kind: "http", status: 403, code: "PROJECT_CREATION_FORBIDDEN", message: "Denied" } });
});

test("maps the member role and task count without discarding the cursor", async (t) => {
  mockRequest(t, "GET", "/api/projects/1/members?cursor=next", null, {
    success: true, response: {
      items: [{ userId: 7, name: "QA", actor: "QA", assignedTaskCount: 2 }],
      hasNext: false, nextCursor: null,
    },
  });
  const result = await api.fetchProjectMembers({ projectId: 1, cursor: "next" });
  assert.deepEqual(result.data, {
    items: [{ userId: 7, name: "QA", actor: "qa", assignedTaskCount: 2 }], hasNext: false, nextCursor: null,
  });
});

test("serializes PM delegation when the departing PM leaves the project", async (t) => {
  mockRequest(t, "POST", "/api/projects/1/pm-delegation",
    { newPmUserId: 8, previousPmAction: "LEAVE", previousPmActor: null }, { success: true, response: {} });
  assert.equal((await api.delegateProjectPm({ projectId: 1, newPmUserId: 8, previousPmActor: null })).ok, true);
});

test("serializes member invitations and uses the server conflict as the result", async (t) => {
  mockRequest(t, "POST", "/api/projects/1/members", { members: [{ userId: 8, actor: "DEVELOPER" }] },
    { success: false, error: { code: "ALREADY_PROJECT_MEMBER", message: "Already a member" } }, 409);
  const result = await api.inviteProjectMember({ projectId: 1, userId: 8, actor: "dev" });
  assert.equal(result.failure.status, 409);
});

test("uses the role patch and the member delete endpoints", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async (url, request) => {
    const path = new URL(url, "http://localhost").pathname;
    if (request.method === "PATCH") {
      assert.equal(path, "/api/projects/1/members/8/role");
      assert.deepEqual(JSON.parse(request.body), { actor: "QA" });
    } else {
      assert.equal(request.method, "DELETE");
      assert.equal(path, "/api/projects/1/members/8");
      assert.equal(request.body, undefined);
    }
    return Response.json({ success: true, response: null });
  });
  assert.equal((await api.changeProjectMemberRole({ projectId: 1, userId: 8, actor: "qa" })).ok, true);
  assert.equal((await api.removeProjectMember({ projectId: 1, userId: 8 })).ok, true);
  assert.equal(fetch.mock.callCount(), 2);
});

test("sends the existing administrator PM reassignment contract", async (t) => {
  mockRequest(t, "PUT", "/api/admin/projects/pm", { projectCode: "QA-01", newPmUserId: 8 },
    { success: true, response: {} });
  assert.equal((await api.reassignProjectPm({ projectCode: " QA-01 ", newPmUserId: 8 })).ok, true);
});
