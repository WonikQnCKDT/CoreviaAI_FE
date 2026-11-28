// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import Sidebar from "@/layouts/Sidebar";
import { renderApp } from "@test/support/appHarness";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
});

describe("Sidebar 데모 환경 표시", () => {
  it("서버(api) 모드에서는 '데모 환경' 표시와 데모 설정 링크를 숨긴다", () => {
    renderApp({
      mode: "api",
      route: "/",
      routes: [
        {
          path: "/",
          element: <Sidebar mobileOpen={false} onClose={() => {}} collapsed={false} onToggleCollapse={() => {}} />,
        },
      ],
    });
    expect(screen.queryByText("데모 환경")).toBeNull();
    expect(screen.queryByRole("link", { name: "데모 설정" })).toBeNull();
  });

  it("데모(demo) 모드에서는 '데모 환경' 표시와 데모 설정 링크를 보여 준다", () => {
    renderApp({
      mode: "demo",
      route: "/",
      routes: [
        {
          path: "/",
          element: <Sidebar mobileOpen={false} onClose={() => {}} collapsed={false} onToggleCollapse={() => {}} />,
        },
      ],
    });
    expect(screen.getByText("데모 환경")).toBeTruthy();
    expect(screen.getByRole("link", { name: "데모 설정" })).toBeTruthy();
  });
});
