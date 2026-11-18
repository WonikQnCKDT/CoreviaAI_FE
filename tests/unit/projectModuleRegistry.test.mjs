import { test } from "node:test";
import assert from "node:assert/strict";
import { createProjectModuleRegistry } from "../../src/core/projectModules/registry.ts";

const page = (path) => ({ path, label: path, Component: () => null });
const scope = { projectId: "p1", departmentType: "manufacturing", method: "iterative", actors: ["inspector"] };

test("selects modules by department, method and actor only when the profile is ready", () => {
  const core = { id: "core", label: "Core", pages: [page("wbs")] };
  const extension = {
    id: "quality", label: "Quality", pages: [page("quality/review")],
    supports: (project) => project.departmentType === "manufacturing" &&
      project.method === "iterative" && project.actors.includes("inspector"),
  };
  const registry = createProjectModuleRegistry([core, extension], ["settings"]);
  assert.deepEqual(registry.list(scope).map(({ id }) => id), ["core", "quality"]);
  assert.deepEqual(registry.list({ ...scope, actors: [] }).map(({ id }) => id), ["core"]);
  assert.deepEqual(registry.list(scope, false).map(({ id }) => id), ["core"]);
});

test("rejects duplicate module IDs and duplicate, reserved or unsafe routes", () => {
  const module = { id: "quality", label: "Quality", pages: [page("review")] };
  assert.throws(() => createProjectModuleRegistry([module, module], []), /duplicate project module/);
  assert.throws(() => createProjectModuleRegistry([module, { ...module, id: "external" }], []), /duplicate project module path/);
  assert.throws(() => createProjectModuleRegistry([module], ["review"]), /duplicate project module path/);
  for (const path of ["", ":id", "*", "../review", "/review", "review/"]) {
    assert.throws(() => createProjectModuleRegistry([{ ...module, pages: [page(path)] }], []), /project module path/);
  }
});
