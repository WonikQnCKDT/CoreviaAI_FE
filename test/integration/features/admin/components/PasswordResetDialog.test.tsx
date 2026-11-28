// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import PasswordResetDialog from "@/features/admin/components/PasswordResetDialog";
import { renderApp } from "@test/support/appHarness";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
});

describe("PasswordResetDialog 초기 임시 비밀번호 표시", () => {
  it("사용자 생성 응답의 initialTemporaryPassword가 있으면 추가 호출 없이 즉시 1회 표시한다", () => {
    renderApp({
      mode: "api",
      route: "/admin",
      routes: [
        {
          path: "/admin",
          element: (
            <PasswordResetDialog
              target={{ name: "홍길동", serverUserId: 12, initialTemporaryPassword: "Init!Pass2026" }}
              onClose={() => {}}
            />
          ),
        },
      ],
    });
    expect(screen.getByText("Init!Pass2026")).toBeTruthy();
  });
});
