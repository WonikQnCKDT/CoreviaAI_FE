// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import UserSearchPicker from "@/features/project/components/UserSearchPicker";
import { USER_SEARCH_TEXT } from "@/features/project/i18n/ko";
import { BUTTON_TEXT } from "@/shared/i18n/catalog/button";
import { formatLabel } from "@/shared/i18n/store";
import { jsonFail, jsonOk, stubFetch } from "@test/support/appHarness";
import { userSearchDto } from "@test/support/projectFixtures";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const renderPicker = (props: Partial<Parameters<typeof UserSearchPicker>[0]> = {}) => {
  const onSelect = vi.fn();
  render(<UserSearchPicker id="picker" label="멤버 찾기" onSelect={onSelect} debounceMs={0} {...props} />);
  return { onSelect, input: screen.getByRole("combobox", { name: "멤버 찾기" }) };
};

const type = (input: HTMLElement, value: string) => {
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value } });
};

describe("UserSearchPicker", () => {
  it("2자 미만이면 요청하지 않고 안내만 보인다", async () => {
    const { calls } = stubFetch({});
    const { input } = renderPicker();
    type(input, "김");
    expect(screen.getByText(USER_SEARCH_TEXT.tooShort)).toBeTruthy();
    type(input, "  김 ");
    await act(async () => new Promise((resolve) => setTimeout(resolve, 10)));
    expect(calls).toHaveLength(0);
  });

  it("검색 결과를 보이고 클릭하면 고른 사람을 넘긴 뒤 입력칸을 비운다", async () => {
    const { calls } = stubFetch({
      "GET /api/users/search": () => jsonOk([userSearchDto(11, "김철수", "개발팀", "백엔드"), userSearchDto(12, "김철민", null)]),
    });
    const { input, onSelect } = renderPicker();
    type(input, " 김철 ");

    const option = await screen.findByRole("option", { name: /김철수/ });
    expect(screen.getByText("개발팀 · 백엔드")).toBeTruthy();
    expect(screen.getByText(USER_SEARCH_TEXT.noDepartment)).toBeTruthy();
    expect(screen.getByText(formatLabel(USER_SEARCH_TEXT.resultCount, { count: "2" }))).toBeTruthy();
    expect(calls[0].path).toBe("/api/users/search?keyword=%EA%B9%80%EC%B2%A0&size=20");

    fireEvent.click(option);
    expect(onSelect).toHaveBeenCalledWith({ id: 11, name: "김철수", departmentName: "개발팀", jobTitle: "백엔드" });
    expect(input).toHaveProperty("value", "");
  });

  it("키보드: ↓↑로 이동하고 Enter로 고르며, Enter는 바깥 form을 제출하지 않는다", async () => {
    stubFetch({ "GET /api/users/search": () => jsonOk([userSearchDto(11, "김철수"), userSearchDto(12, "김철민")]) });
    const onSubmit = vi.fn((event: Event) => event.preventDefault());
    const onSelect = vi.fn();
    render(
      <form onSubmit={(event) => onSubmit(event.nativeEvent)}>
        <UserSearchPicker id="picker" label="멤버 찾기" onSelect={onSelect} debounceMs={0} />
      </form>,
    );
    const input = screen.getByRole("combobox", { name: "멤버 찾기" });
    type(input, "김철");
    await screen.findByRole("option", { name: /김철민/ });

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(screen.getByRole("option", { name: /김철수/ }).getAttribute("aria-selected")).toBe("true");
    expect(input.getAttribute("aria-activedescendant")).toBe(screen.getByRole("option", { name: /김철수/ }).id);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" }); // 마지막 다음은 처음
    fireEvent.keyDown(input, { key: "ArrowUp" }); // 처음 이전은 마지막
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 12 }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("Esc는 목록만 닫고 바깥(document)으로 번지지 않는다. 목록이 닫혀 있으면 번진다", async () => {
    stubFetch({ "GET /api/users/search": () => jsonOk([userSearchDto(11, "김철수")]) });
    const onDocumentKey = vi.fn();
    document.addEventListener("keydown", onDocumentKey);
    const { input } = renderPicker();
    type(input, "김철");
    await screen.findByRole("option", { name: /김철수/ });

    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(onDocumentKey).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onDocumentKey).toHaveBeenCalledTimes(1);
    document.removeEventListener("keydown", onDocumentKey);
  });

  it("결과가 없으면 없음 안내, 이미 고른 사람은 결과에서 뺀다", async () => {
    stubFetch({ "GET /api/users/search": ({ url }) => jsonOk(url.searchParams.get("keyword") === "없는" ? [] : [userSearchDto(11, "김철수"), userSearchDto(12, "김철민")]) });
    const { input } = renderPicker({ excludeUserIds: [11] });
    type(input, "김철");
    expect(await screen.findByRole("option", { name: /김철민/ })).toBeTruthy();
    expect(screen.queryByRole("option", { name: /김철수/ })).toBeNull();

    type(input, "없는");
    expect(await screen.findByText(formatLabel(USER_SEARCH_TEXT.empty, { keyword: "없는" }))).toBeTruthy();
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("20명(상한)을 받으면 좁혀 달라는 안내를 붙인다", async () => {
    stubFetch({ "GET /api/users/search": () => jsonOk(Array.from({ length: 20 }, (_, index) => userSearchDto(index + 1, `김${index}`))) });
    const { input } = renderPicker();
    type(input, "김김");
    expect(await screen.findByText(new RegExp(USER_SEARCH_TEXT.limitNote))).toBeTruthy();
    expect(screen.getAllByRole("option")).toHaveLength(20);
  });

  it("실패하면 오류와 다시 시도를 보이고, 다시 시도로 다시 요청한다", async () => {
    let attempt = 0;
    stubFetch({
      "GET /api/users/search": () => {
        attempt += 1;
        return attempt === 1 ? jsonFail(500, "서버에서 오류가 발생했습니다") : jsonOk([userSearchDto(11, "김철수")]);
      },
    });
    const { input } = renderPicker();
    type(input, "김철");
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText(/서버에서 오류가 발생했습니다/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: BUTTON_TEXT.retry }));
    expect(await screen.findByRole("option", { name: /김철수/ })).toBeTruthy();
    expect(attempt).toBe(2);
  });

  it("입력을 멈출 때까지 기다렸다 한 번만 요청하고, 새 입력이 오면 이전 요청을 취소한다", async () => {
    vi.useFakeTimers();
    const signals: AbortSignal[] = [];
    const fetchMock = vi.fn((...[, init]: Parameters<typeof fetch>) => {
      if (init?.signal) signals.push(init.signal);
      return new Promise<Response>(() => undefined);
    });
    vi.stubGlobal("fetch", fetchMock);
    const { input } = renderPicker({ debounceMs: 300 });

    type(input, "김철");
    type(input, "김철수");
    await act(async () => {
      vi.advanceTimersByTime(299);
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText(USER_SEARCH_TEXT.loading)).toBeTruthy();
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain(encodeURIComponent("김철수"));

    type(input, "김철수님");
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);
  });

  it("비활성이면 입력할 수 없고 이유를 보인다", () => {
    stubFetch({});
    const { input } = renderPicker({ disabled: true, disabledReason: "PM 외 액터를 먼저 지정해 주세요." });
    expect(input).toHaveProperty("disabled", true);
    expect(screen.getByText("PM 외 액터를 먼저 지정해 주세요.")).toBeTruthy();
  });

  it("고른 뒤에도 같은 입력칸에서 계속 찾아 고를 수 있다", async () => {
    stubFetch({ "GET /api/users/search": () => jsonOk([userSearchDto(11, "김철수")]) });
    const { input, onSelect } = renderPicker();
    type(input, "김철");
    fireEvent.click(await screen.findByRole("option", { name: /김철수/ }));
    type(input, "김철");
    fireEvent.click(await screen.findByRole("option", { name: /김철수/ }));
    await waitFor(() => expect(onSelect).toHaveBeenCalledTimes(2));
  });
});
