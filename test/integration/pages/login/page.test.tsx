import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import LoginPage from "@/pages/login/page";
import { AuthContext, type AuthContextValue } from "@/features/auth/authContext";
import { AUTH_TEXT } from "@/features/auth/i18n/ko";
import { BUTTON_TEXT } from "@/shared/i18n/catalog/button";
import { markSessionExpiredNotice, peekSessionNotice } from "@/features/auth/utils/session";
import { DemoStoreProvider } from "@/stores/DemoStore";
import { fakeAuth } from "@test/support/appHarness";

const renderLogin = (overrides: Partial<AuthContextValue> = {}) =>
  render(
    <DemoStoreProvider>
      <AuthContext.Provider value={fakeAuth("api", { status: "signedOut", account: null, ...overrides })}>
        <MemoryRouter initialEntries={["/login"]}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<div>홈 화면</div>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </DemoStoreProvider>,
  );

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("LoginPage 통합 테스트 (API 모드)", () => {
  it("아이디·비밀번호가 비어 있으면 제출을 막고 필드 오류를 보여준다", async () => {
    const signIn = vi.fn();
    renderLogin({ signIn });

    fireEvent.click(screen.getByRole("button", { name: "로그인" }));

    expect(await screen.findByText(AUTH_TEXT.loginIdRequired)).toBeTruthy();
    expect(screen.getByText(AUTH_TEXT.passwordRequired)).toBeTruthy();
    expect(signIn).not.toHaveBeenCalled();
  });

  it("유효한 자격증명으로 제출하면 signIn을 호출하고 실패 시 오류 메시지를 표시한다", async () => {
    const signIn = vi.fn(async () => ({ kind: "rejected" as const, field: "form" as const, message: "아이디 또는 비밀번호가 올바르지 않습니다." }));
    renderLogin({ signIn });

    fireEvent.change(screen.getByLabelText("아이디"), { target: { value: "hong.gd" } });
    fireEvent.change(screen.getByLabelText("비밀번호"), { target: { value: "Wrong1!pass" } });
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));

    await waitFor(() => expect(signIn).toHaveBeenCalledWith(expect.objectContaining({ loginId: "hong.gd", password: "Wrong1!pass" })));
    expect(await screen.findByText("아이디 또는 비밀번호가 올바르지 않습니다.")).toBeTruthy();
  });

  it("계정 잠금 응답(locked)을 받으면 잠금 안내를 표시한다", async () => {
    const signIn = vi.fn(async () => ({ kind: "locked" as const, message: "5회 연속 실패로 계정이 잠겼습니다." }));
    renderLogin({ signIn });

    fireEvent.change(screen.getByLabelText("아이디"), { target: { value: "hong.gd" } });
    fireEvent.change(screen.getByLabelText("비밀번호"), { target: { value: "Wrong1!pass" } });
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));

    expect(await screen.findByText("5회 연속 실패로 계정이 잠겼습니다.")).toBeTruthy();
    expect(screen.getByText("계정이 잠겨 있습니다.")).toBeTruthy();
  });

  it("세션 만료 안내를 화면에 한 번 표시하고 sessionStorage에서는 즉시 지운다", async () => {
    markSessionExpiredNotice();
    renderLogin();

    expect(await screen.findByText("로그인이 만료되었습니다. 다시 로그인해주세요.")).toBeTruthy();
    expect(peekSessionNotice()).toBeNull();
  });

  it("비밀번호 표시 토글 버튼이 input type을 password와 text 사이에서 전환한다", () => {
    renderLogin();
    const input = screen.getByLabelText("비밀번호") as HTMLInputElement;
    expect(input.type).toBe("password");

    fireEvent.click(screen.getByRole("button", { name: BUTTON_TEXT.showPassword }));
    expect(input.type).toBe("text");

    fireEvent.click(screen.getByRole("button", { name: BUTTON_TEXT.hidePassword }));
    expect(input.type).toBe("password");
  });
});
