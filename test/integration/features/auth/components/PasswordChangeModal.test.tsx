import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import PasswordChangeModal from "@/features/auth/components/PasswordChangeModal";
import { AuthContext, type AuthContextValue } from "@/features/auth/authContext";
import { AUTH_TEXT } from "@/features/auth/i18n/ko";
import { BUTTON_TEXT } from "@/shared/i18n/catalog/button";
import { fakeAuth } from "@test/support/appHarness";

const renderModal = (
  props: { open?: boolean; forced?: boolean; onClose?: () => void } = {},
  authOverrides: Partial<AuthContextValue> = {},
) =>
  render(
    <AuthContext.Provider value={fakeAuth("api", authOverrides)}>
      <PasswordChangeModal open={props.open ?? true} forced={props.forced} onClose={props.onClose ?? vi.fn()} />
    </AuthContext.Provider>,
  );

afterEach(() => {
  cleanup();
});

describe("PasswordChangeModal (FR-ADM-01, NFR-04, SCRUM-96·100)", () => {
  it("새 비밀번호가 현재 비밀번호와 같으면 제출을 막는다", async () => {
    const changePassword = vi.fn();
    renderModal({}, { changePassword });

    fireEvent.change(screen.getByLabelText("현재 비밀번호"), { target: { value: "Pass1234!" } });
    fireEvent.change(screen.getByLabelText("새 비밀번호"), { target: { value: "Pass1234!" } });
    fireEvent.change(screen.getByLabelText("새 비밀번호 확인"), { target: { value: "Pass1234!" } });
    fireEvent.click(screen.getByRole("button", { name: BUTTON_TEXT.change }));

    expect(await screen.findByText(AUTH_TEXT.sameAsCurrent)).toBeTruthy();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it("비밀번호 정책(영문·숫자·특수문자, 8~64자) 미충족 또는 확인 불일치 시 제출을 막는다", async () => {
    const changePassword = vi.fn();
    renderModal({}, { changePassword });

    fireEvent.change(screen.getByLabelText("현재 비밀번호"), { target: { value: "OldPass1!" } });
    fireEvent.change(screen.getByLabelText("새 비밀번호"), { target: { value: "weak" } });
    fireEvent.change(screen.getByLabelText("새 비밀번호 확인"), { target: { value: "different" } });
    fireEvent.click(screen.getByRole("button", { name: BUTTON_TEXT.change }));

    expect(await screen.findByText("비밀번호 규칙을 모두 충족해야 합니다.")).toBeTruthy();
    expect(screen.getByText("새 비밀번호와 일치하지 않습니다.")).toBeTruthy();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it("유효한 입력으로 제출하면 changePassword를 호출한다", async () => {
    const changePassword = vi.fn(async () => ({ kind: "success" as const }));
    renderModal({}, { changePassword });

    fireEvent.change(screen.getByLabelText("현재 비밀번호"), { target: { value: "OldPass1!" } });
    fireEvent.change(screen.getByLabelText("새 비밀번호"), { target: { value: "NewPass2@" } });
    fireEvent.change(screen.getByLabelText("새 비밀번호 확인"), { target: { value: "NewPass2@" } });
    fireEvent.click(screen.getByRole("button", { name: BUTTON_TEXT.change }));

    await waitFor(() =>
      expect(changePassword).toHaveBeenCalledWith(
        expect.objectContaining({ currentPassword: "OldPass1!", newPassword: "NewPass2@" }),
      ),
    );
  });

  it("강제 변경(forced=true) 상태에서는 취소 버튼이 없고 로그아웃만 할 수 있다", () => {
    const signOut = vi.fn(async () => undefined);
    renderModal({ forced: true }, { signOut });

    expect(screen.queryByRole("button", { name: "취소" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
