import { describe, expect, it } from "vitest";
import type { ApiFailure } from "@/shared/api/client";
import { toSignInOutcome } from "@/features/auth/utils/authFailure";
import { interpretWbsFailure } from "@/features/wbs/utils/wbsRules";
import { interpretBoardFailure } from "@/features/board/utils/boardRules";
import { interpretTodoFailure } from "@/features/mywork/utils/todoRules";
import { interpretCreateFailure } from "@/features/project/utils/serverCreate";

const LEAKED_STACK_TRACE =
  "java.lang.NullPointerException: Cannot invoke method on null\n\tat org.wonik.coreviaai_be.domain.project.ProjectService.create(ProjectService.java:88)";

const server500Failure: ApiFailure = {
  kind: "http",
  status: 500,
  code: "INTERNAL_SERVER_ERROR",
  message: LEAKED_STACK_TRACE,
};

describe("사용자 화면 내부 예외·스택 트레이스 미노출 (FR-ADM-09, SCRUM-170)", () => {
  it("500 서버 오류 응답에 스택 트레이스가 실려 와도 사용자용 오류 해석기는 원문을 노출하지 않는다", () => {
    const signIn = toSignInOutcome(server500Failure);
    expect(signIn.kind).toBe("failed");
    if (signIn.kind === "failed") {
      expect(signIn.message).not.toContain("NullPointerException");
      expect(signIn.message).not.toContain("ProjectService.java");
    }

    const wbs = interpretWbsFailure("create", server500Failure);
    expect(wbs.message).not.toContain("NullPointerException");
    expect(wbs.message).not.toContain("ProjectService.java");

    const board = interpretBoardFailure("move", server500Failure);
    expect(board.message).not.toContain("NullPointerException");
    expect(board.message).not.toContain("ProjectService.java");

    const todo = interpretTodoFailure("create", server500Failure);
    expect(todo.message).not.toContain("NullPointerException");
    expect(todo.message).not.toContain("ProjectService.java");

    const projectCreate = interpretCreateFailure(server500Failure);
    expect(projectCreate.message).not.toContain("NullPointerException");
    expect(projectCreate.message).not.toContain("ProjectService.java");
  });
});
