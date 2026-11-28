// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import ServerMemberPanel from "@/features/project/components/members/ServerMemberPanel";
import { PROJECT_MEMBER_TEXT } from "@/features/project/i18n/member";
import { formatLabel } from "@/shared/i18n/store";
import { jsonOk, stubFetch } from "@/test/appHarness";

/** 실제 BE ProjectMemberResponse 형식 */
const MEMBERS = [
  { userId: 5, name: "홍길동", actor: "PM", assignedTaskCount: 0 },
  { userId: 11, name: "이개발", actor: "DEVELOPER", assignedTaskCount: 4 },
];

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const renderPanel = (props: { viewerUserId: number | null; viewerIsExecutive: boolean; approverUserIds?: number[]; onChanged?: () => void }) =>
  render(<ServerMemberPanel projectId={77} actors={["pm", "dev", "qa"]} onChanged={props.onChanged ?? vi.fn()} {...props} />);

describe("ServerMemberPanel 권한", () => {
  it("경영진은 서버 목록에서 PM으로 보여도 읽기 전용이다", async () => {
    stubFetch({ "GET /api/projects/77/members": () => jsonOk({ items: MEMBERS, nextCursor: null, hasNext: false }) });
    renderPanel({ viewerUserId: 5, viewerIsExecutive: true });

    expect(await screen.findByText(new RegExp(PROJECT_MEMBER_TEXT.readOnly))).toBeTruthy();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("로그인 정보가 없으면 읽기 전용이다", async () => {
    stubFetch({ "GET /api/projects/77/members": () => jsonOk({ items: MEMBERS, nextCursor: null, hasNext: false }) });
    renderPanel({ viewerUserId: null, viewerIsExecutive: false });

    expect(await screen.findByText(new RegExp(PROJECT_MEMBER_TEXT.readOnly))).toBeTruthy();
  });

  it("멤버가 없으면 빈 상태를 보여 준다", async () => {
    stubFetch({ "GET /api/projects/77/members": () => jsonOk({ items: [], nextCursor: null, hasNext: false }) });
    renderPanel({ viewerUserId: 5, viewerIsExecutive: false });

    expect(await screen.findByText(PROJECT_MEMBER_TEXT.empty)).toBeTruthy();
    expect(screen.getByText(formatLabel(PROJECT_MEMBER_TEXT.pmCount, { count: 0 }))).toBeTruthy();
  });
});

describe("ServerMemberPanel 게이트 승인자", () => {
  it("화면이 아는 승인자는 PM으로 고를 수 없고 제외 버튼도 막는다", async () => {
    stubFetch({ "GET /api/projects/77/members": () => jsonOk({ items: MEMBERS, nextCursor: null, hasNext: false }) });
    renderPanel({ viewerUserId: 5, viewerIsExecutive: false, approverUserIds: [11] });

    const select = (await screen.findByRole("combobox", { name: formatLabel(PROJECT_MEMBER_TEXT.roleSelect, { name: "이개발" }) })) as HTMLSelectElement;
    const pmOption = [...select.options].find((option) => option.value === "pm");
    expect(pmOption?.disabled).toBe(true);
    expect([...select.options].filter((option) => !option.disabled).map((option) => option.value)).toEqual(["dev", "qa"]);
    expect(screen.getByText(PROJECT_MEMBER_TEXT.approver)).toBeTruthy();
    expect(screen.getByText(PROJECT_MEMBER_TEXT.approverHint)).toBeTruthy();
    const remove = screen.getByRole("button", { name: new RegExp(formatLabel(PROJECT_MEMBER_TEXT.removeAria, { name: "이개발" }).replace(/[()]/g, "\\$&")) });
    expect(remove).toHaveProperty("disabled", true);
  });
});

describe("ServerMemberPanel 중복 제출 방지", () => {
  it("처리 중에는 확인 버튼을 다시 눌러도 한 번만 보내고, 성공하면 변경을 알린다", async () => {
    let resolve: (response: Response) => void = () => undefined;
    const onChanged = vi.fn();
    const { calls } = stubFetch({
      "GET /api/projects/77/members": () => jsonOk({ items: MEMBERS, nextCursor: null, hasNext: false }),
      "PATCH /api/projects/77/members/11/role": () => new Promise<Response>((done) => (resolve = done)),
    });
    renderPanel({ viewerUserId: 5, viewerIsExecutive: false, onChanged });

    fireEvent.change(await screen.findByRole("combobox", { name: formatLabel(PROJECT_MEMBER_TEXT.roleSelect, { name: "이개발" }) }), {
      target: { value: "qa" },
    });
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: PROJECT_MEMBER_TEXT.confirmChange }));
    const busy = within(dialog).getByRole("button", { name: new RegExp(PROJECT_MEMBER_TEXT.submitting) });
    expect(busy).toHaveProperty("disabled", true);
    fireEvent.click(busy);
    expect(calls.filter(({ method }) => method === "PATCH")).toHaveLength(1);

    resolve(jsonOk({ userId: 11, name: "이개발", actor: "QA", assignedTaskCount: 4 }));
    expect(await screen.findByText(formatLabel(PROJECT_MEMBER_TEXT.roleChanged, { name: "이개발", after: "QA" }))).toBeTruthy();
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(calls.filter(({ method }) => method === "PATCH")).toHaveLength(1);
  });
});
