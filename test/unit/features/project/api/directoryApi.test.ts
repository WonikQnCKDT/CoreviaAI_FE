import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  departmentPath,
  fetchDepartments,
  normalizeUserSearchKeyword,
  searchUsers,
  type DirectoryDepartment,
} from "@/features/project/api/directoryApi";
import { departmentDto, userSearchDto } from "@test/support/projectFixtures";

const ok = (response: unknown) => new Response(JSON.stringify({ success: true, response, error: null }), { status: 200 });
const fail = (status: number, message: string) =>
  new Response(JSON.stringify({ success: false, response: null, error: { message, status } }), { status });

const fetchMock = vi.fn<typeof fetch>();
const lastUrl = () => new URL(String(fetchMock.mock.calls.at(-1)?.[0]), "http://localhost");

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("window", globalThis);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchDepartments", () => {
  it("GET /api/departments 응답(BE 형식)을 그대로 화면 모델로 바꾼다", async () => {
    fetchMock.mockResolvedValue(ok([departmentDto(2, "개발팀", 1), departmentDto(1, "본부")]));
    const result = await fetchDepartments();
    expect(lastUrl().pathname).toBe("/api/departments");
    expect(result).toEqual({
      ok: true,
      data: [
        { id: 2, parentId: 1, name: "개발팀" },
        { id: 1, parentId: null, name: "본부" },
      ],
    });
  });

  it("빈 목록·null 응답은 빈 배열", async () => {
    fetchMock.mockResolvedValue(ok([]));
    expect(await fetchDepartments()).toEqual({ ok: true, data: [] });
    fetchMock.mockResolvedValue(ok(null));
    expect(await fetchDepartments()).toEqual({ ok: true, data: [] });
  });

  it("시스템 관리자(404) 등 실패는 그대로 돌려준다", async () => {
    fetchMock.mockResolvedValue(fail(404, "요청한 자원을 찾을 수 없습니다"));
    expect(await fetchDepartments()).toMatchObject({ ok: false, failure: { kind: "http", status: 404 } });
  });
});

describe("normalizeUserSearchKeyword (BE UserSearchKeyword와 같은 규칙)", () => {
  it("앞뒤 공백을 빼고 2자·50자 경계를 허용한다", () => {
    expect(normalizeUserSearchKeyword("  홍길  ")).toBe("홍길");
    expect(normalizeUserSearchKeyword("ab")).toBe("ab");
    expect(normalizeUserSearchKeyword("가".repeat(50))).toBe("가".repeat(50));
    expect(normalizeUserSearchKeyword("😀😀")).toBe("😀😀");
  });

  it.each(["", " ", "홍", " 홍 ", "가".repeat(51), "😀".repeat(51), "홍\u0000길", "홍\n길", "a\u007fb"])("%j는 요청하지 않는다", (raw) => {
    expect(normalizeUserSearchKeyword(raw)).toBeNull();
  });
});

describe("searchUsers", () => {
  it("정규화한 검색어와 size를 보내고 응답 4개 필드만 담는다", async () => {
    fetchMock.mockResolvedValue(ok([userSearchDto(11, "김철수", "개발팀", "백엔드"), userSearchDto(12, "김철민", null, null)]));
    const result = await searchUsers({ keyword: "  김철 " });
    expect(lastUrl().pathname).toBe("/api/users/search");
    expect(Object.fromEntries(lastUrl().searchParams)).toEqual({ keyword: "김철", size: "20" });
    expect(result).toEqual({
      ok: true,
      data: [
        { id: 11, name: "김철수", departmentName: "개발팀", jobTitle: "백엔드" },
        { id: 12, name: "김철민", departmentName: null, jobTitle: null },
      ],
    });
  });

  it("%·_ 같은 문자는 URL 인코딩해 그대로 보낸다(이스케이프는 서버가 한다)", async () => {
    fetchMock.mockResolvedValue(ok([]));
    await searchUsers({ keyword: "10%_a&b" });
    expect(lastUrl().searchParams.get("keyword")).toBe("10%_a&b");
  });

  it("규칙에 맞지 않는 검색어는 요청하지 않고 빈 목록", async () => {
    expect(await searchUsers({ keyword: "홍" })).toEqual({ ok: true, data: [] });
    expect(await searchUsers({ keyword: "   " })).toEqual({ ok: true, data: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    [0, "1"],
    [-5, "1"],
    [1, "1"],
    [20, "20"],
    [21, "20"],
    [Number.NaN, "20"],
  ])("size %s → %s (서버 범위 1~20)", async (size, expected) => {
    fetchMock.mockResolvedValue(ok([]));
    await searchUsers({ keyword: "홍길", size });
    expect(lastUrl().searchParams.get("size")).toBe(expected);
  });

  it("실패(400·시간 초과 등)는 그대로 돌려준다", async () => {
    fetchMock.mockResolvedValue(fail(400, "검색어는 앞뒤 공백을 뺀 2~50자로 입력해 주세요. 제어 문자는 쓸 수 없습니다"));
    expect(await searchUsers({ keyword: "홍길" })).toMatchObject({ ok: false, failure: { kind: "http", status: 400 } });
  });

  it("취소하면 aborted", async () => {
    fetchMock.mockImplementation((_input, init) =>
      new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))),
    );
    const controller = new AbortController();
    const pending = searchUsers({ keyword: "홍길", signal: controller.signal });
    controller.abort();
    expect(await pending).toMatchObject({ ok: false, failure: { kind: "aborted" } });
  });
});

describe("departmentPath", () => {
  const byId = (items: DirectoryDepartment[]) => new Map(items.map((item) => [item.id, item]));

  it("상위 부서 이름을 이어 붙이고, 최상위는 이름만", () => {
    const items = [
      { id: 1, parentId: null, name: "본부" },
      { id: 2, parentId: 1, name: "개발실" },
      { id: 3, parentId: 2, name: "플랫폼팀" },
    ];
    expect(departmentPath(items[2], byId(items))).toBe("본부 > 개발실 > 플랫폼팀");
    expect(departmentPath(items[0], byId(items))).toBe("본부");
  });

  it("상위가 목록에 없거나(비활성) 순환이면 멈춘다", () => {
    expect(departmentPath({ id: 5, parentId: 99, name: "고립팀" }, new Map())).toBe("고립팀");
    const loop = [
      { id: 1, parentId: 2, name: "A" },
      { id: 2, parentId: 1, name: "B" },
    ];
    expect(departmentPath(loop[0], byId(loop))).toBe("B > A");
  });
});
