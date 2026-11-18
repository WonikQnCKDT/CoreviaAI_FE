import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router-dom";
import { createServer } from "vite";

let vite;
let createProjectCore;
let createProjectModuleRegistry;
let ProjectModuleRoute;

before(async () => {
  vite = await createServer({
    configFile: false,
    resolve: { alias: { "@": fileURLToPath(new URL("../../src", import.meta.url)) } },
    server: { middlewareMode: true, ws: false, watch: null },
  });
  ({ createProjectCore } = await vite.ssrLoadModule("/src/app/projectModules/projectCore.ts"));
  ({ createProjectModuleRegistry } = await vite.ssrLoadModule("/src/core/projectModules/registry.ts"));
  ({ default: ProjectModuleRoute } = await vite.ssrLoadModule("/src/app/projectModules/ProjectModuleRoute.tsx"));
});

after(async () => { await vite?.close(); });

test("mounts an extension through the project router and renders only current-project data", () => {
  const scope = { projectId: "sample", departmentType: "manufacturing", method: "iterative", actors: ["inspector"] };
  const core = createProjectCore({ id: "sample", riskScore: 34 }, [
    { id: "task", projectId: "sample", name: "Visible work" },
    { id: "foreign", projectId: "other", name: "Unrelated work" },
  ], [
    { id: "notice", projectId: "sample", title: "Visible notice" },
    { id: "foreign", projectId: "other", title: "Unrelated notice" },
    { id: "personal", projectId: null, title: "Personal notice" },
  ]);
  function QualityPage({ core }) {
    return createElement("article", null,
      core.work.list().map(({ title }) => title).join(", "),
      ` score ${core.risk.readScore()} `,
      core.notifications.list().map(({ title }) => title).join(", "),
    );
  }

  const registry = createProjectModuleRegistry([{
    id: "quality", label: "Quality", supports: ({ departmentType }) => departmentType === "manufacturing",
    pages: [{ path: "quality/review", label: "Review", Component: QualityPage }],
  }], ["settings"]);

  function renderRoute(pages, loading = false, data = core) {
    const context = { props: { scope, core: data }, pages, loading, loadFailed: false };
    const router = createMemoryRouter([{
      path: "/projects/:projectId",
      element: createElement(Outlet, { context }),
      children: [{ path: "*", element: createElement(ProjectModuleRoute) }],
    }], { initialEntries: ["/projects/sample/quality/review"] });
    try {
      return renderToStaticMarkup(createElement(RouterProvider, { router }));
    } finally {
      router.dispose();
    }
  }

  const html = renderRoute(registry.list(scope).flatMap(({ pages }) => pages));
  assert.match(html, /Visible work.*score 34.*Visible notice/);
  assert.doesNotMatch(html, /Unrelated|Personal notice/);
  assert.match(renderRoute([]), /페이지를 찾을 수 없습니다/);
  assert.doesNotMatch(renderRoute([], true), /Visible work/);
  const replacement = {
    work: { list: () => [{ title: "External work" }] },
    risk: { readScore: () => 58 },
    notifications: { list: () => [{ title: "External notice" }] },
  };
  const pages = registry.list(scope).flatMap((entry) => entry.pages);
  assert.match(renderRoute(pages, false, replacement), /External work.*score 58.*External notice/);
});

test("API projects do not expose demo data when the server has no source for the contracts", () => {
  const core = createProjectCore({ id: "7", serverId: 7, riskScore: 0 },
    [{ id: "local", projectId: "7" }], [{ id: "local", projectId: "7" }]);
  assert.deepEqual(core.work.list(), []);
  assert.equal(core.risk.readScore(), null);
  assert.deepEqual(core.notifications.list(), []);
});

test("extension lint permits the public contract and rejects imports that bypass it", async () => {
  const lint = new ESLint();
  const filePath = "src/extensions/quality/module.ts";
  const valid = 'import type { ProjectCore } from "@/core/projectModules/contracts"; export type Boundary = ProjectCore;';
  const forbidden = [
    'import { useDemoStore } from "@/stores/DemoStore"; export const value = useDemoStore;',
    'import { useDemoStore } from "../../stores/DemoStore"; export const value = useDemoStore;',
    'export const escaped = import("@/stores/DemoStore");',
  ];
  const [allowed] = await lint.lintText(valid, { filePath });
  assert.equal(allowed.errorCount, 0);
  for (const code of forbidden) {
    const [result] = await lint.lintText(code, { filePath });
    assert.ok(result.messages.some(({ ruleId }) => ruleId === "no-restricted-imports" || ruleId === "no-restricted-syntax"));
  }
});
