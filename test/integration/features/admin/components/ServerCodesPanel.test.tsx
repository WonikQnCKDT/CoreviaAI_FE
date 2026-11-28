import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import ServerCodesPanel from "@/features/admin/components/ServerCodesPanel";
import { ADMIN_CODE_TEXT, ADMIN_TEXT } from "@/features/admin/i18n/ko";
import { applyLabels, resetLabels } from "@/shared/i18n/store";
import { jsonOk, stubFetch } from "@test/support/appHarness";

const groupsDto = [
  { id: 1, groupCode: "TASK_STATUS", labelKey: "codeGroup.TASK_STATUS", description: "업무 상태", createdAt: "2026-11-01T00:00:00Z", updatedAt: "2026-11-01T00:00:00Z" },
  { id: 2, groupCode: "RISK_LEVEL", labelKey: "codeGroup.RISK_LEVEL", description: "위험 수준", createdAt: "2026-11-01T00:00:00Z", updatedAt: "2026-11-01T00:00:00Z" },
];

const taskCodesDto = [
  { id: 10, code: "TODO", labelKey: "code.TASK_STATUS.TODO", sortOrder: 1, active: true, createdAt: "2026-11-01T00:00:00Z", updatedAt: "2026-11-01T00:00:00Z" },
  { id: 11, code: "DONE", labelKey: "code.TASK_STATUS.DONE", sortOrder: 2, active: true, createdAt: "2026-11-01T00:00:00Z", updatedAt: "2026-11-01T00:00:00Z" },
];

const riskCodesDto = [
  { id: 20, code: "NORMAL", labelKey: "code.RISK_LEVEL.NORMAL", sortOrder: 1, active: true, createdAt: "2026-11-01T00:00:00Z", updatedAt: "2026-11-01T00:00:00Z" },
];

beforeEach(() => {
  resetLabels();
});

afterEach(() => {
  cleanup();
  resetLabels();
  vi.unstubAllGlobals();
});

describe("ServerCodesPanel 공통 코드 관리 (FR-ADM-07, NFR-20, SCRUM-168·171)", () => {
  it("그룹별 코드를 조회하고 다른 그룹을 선택하면 해당 그룹의 코드를 불러온다", async () => {
    const { unexpected } = stubFetch({
      "GET /api/admin/code-groups": () => jsonOk(groupsDto),
      "GET /api/admin/code-groups/TASK_STATUS/codes": () => jsonOk(taskCodesDto),
      "GET /api/admin/code-groups/RISK_LEVEL/codes": () => jsonOk(riskCodesDto),
    });

    render(<ServerCodesPanel />);

    expect(await screen.findByText("TODO")).toBeTruthy();
    expect(screen.getByText("DONE")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /RISK_LEVEL/ }));
    expect(await screen.findByText("NORMAL")).toBeTruthy();
    expect(screen.queryByText("TODO")).toBeNull();
    expect(unexpected).toEqual([]);
  });

  it("코드 값은 고정되어 수정·삭제 버튼이 없고 안내 문구를 표시한다", async () => {
    stubFetch({
      "GET /api/admin/code-groups": () => jsonOk(groupsDto),
      "GET /api/admin/code-groups/TASK_STATUS/codes": () => jsonOk(taskCodesDto),
    });

    render(<ServerCodesPanel />);
    const row = (await screen.findByText("TODO")).closest("tr") as HTMLElement;

    expect(within(row).queryByRole("button", { name: /삭제/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /코드 추가/ })).toBeNull();
    expect(screen.getByText((content) => content.includes(ADMIN_CODE_TEXT.fixedNote))).toBeTruthy();
  });

  it("표시 텍스트는 다국어 라벨 번들을 참조해 재배포 없이 반영된다", async () => {
    applyLabels({ language: "en", labels: { "code.TASK_STATUS.TODO": "To Do", "code.TASK_STATUS.DONE": "Completed" } });
    stubFetch({
      "GET /api/admin/code-groups": () => jsonOk(groupsDto),
      "GET /api/admin/code-groups/TASK_STATUS/codes": () => jsonOk(taskCodesDto),
    });

    render(<ServerCodesPanel />);
    expect(await screen.findByText("To Do")).toBeTruthy();
    expect(screen.getByText("Completed")).toBeTruthy();
  });

  it("정렬 순서만 변경할 수 있고 PATCH .../codes/{code}를 호출한다", async () => {
    const { calls, unexpected } = stubFetch({
      "GET /api/admin/code-groups": () => jsonOk(groupsDto),
      "GET /api/admin/code-groups/TASK_STATUS/codes": () => jsonOk(taskCodesDto),
      "PATCH /api/admin/code-groups/TASK_STATUS/codes/TODO": () => jsonOk({ ...taskCodesDto[0], sortOrder: 5 }),
    });

    render(<ServerCodesPanel />);
    const input = await screen.findByLabelText("TODO 정렬 순서");
    const row = input.closest("tr") as HTMLElement;

    fireEvent.change(input, { target: { value: "5" } });
    fireEvent.click(within(row).getByRole("button", { name: ADMIN_TEXT.save }));

    await waitFor(() =>
      expect(calls.find((c) => c.method === "PATCH" && c.path === "/api/admin/code-groups/TASK_STATUS/codes/TODO")).toMatchObject({
        body: { sortOrder: 5 },
      }),
    );
    expect(unexpected).toEqual([]);
  });
});
