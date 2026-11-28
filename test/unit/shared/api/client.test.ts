import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/shared/api/client";
import { subscribeAuthEvents, type AuthEvent } from "@/shared/api/authEvents";

/**
 * BE 실제 오류 응답(ApiResponse.error): { success:false, response:null, error:{ message, status } } — code 필드 없음.
 * 401 메시지는 ErrorCode 문구 그대로(EXPIRED_TOKEN·UNAUTHORIZED·SESSION_EXPIRED가 모두 401).
 */
const ok = (response: unknown) => new Response(JSON.stringify({ success: true, response, error: null }), { status: 200 });
const fail = (status: number, message: string) =>
  new Response(JSON.stringify({ success: false, response: null, error: { message, status } }), { status });

const EXPIRED = () => fail(401, "인증 토큰이 만료되었습니다");
const NO_LOGIN = () => fail(401, "로그인이 필요합니다");

type Handler = () => Response | Promise<Response>;

/** 경로별로 응답 순서를 정한다. 같은 경로를 여러 번 부르면 차례대로 꺼낸다. */
const route = function (queues: Record<string, Handler[]>) {
  const calls: string[] = [];
  const fetchMock = vi.fn(async (...[input, init]: Parameters<typeof fetch>) => {
    const key = `${init?.method ?? "GET"} ${new URL(String(input), "http://localhost").pathname}`;
    calls.push(key);
    const next = queues[key]?.shift();
    if (!next) throw new Error(`정하지 않은 요청: ${key}`);
    return next();
  });
  vi.stubGlobal("fetch", fetchMock);
  return calls;
};

let events: AuthEvent[] = [];
let unsubscribe: () => void = () => undefined;

beforeEach(() => {
  vi.stubGlobal("window", globalThis);
  events = [];
  unsubscribe = subscribeAuthEvents((event) => events.push(event));
});

afterEach(() => {
  unsubscribe();
  vi.unstubAllGlobals();
});

describe("401 → AccessToken 재발급", () => {
  it("재발급이 성공하면 원래 요청을 한 번 다시 보내고 세션을 유지한다", async () => {
    const calls = route({
      "GET /api/me/todos": [EXPIRED, () => ok({ items: [1] })],
      "POST /api/auth/refresh": [() => ok(null)],
    });
    const result = await apiRequest<{ items: number[] }>({ path: "/me/todos" });
    expect(result).toEqual({ ok: true, data: { items: [1] } });
    expect(calls).toEqual(["GET /api/me/todos", "POST /api/auth/refresh", "GET /api/me/todos"]);
    expect(events).toEqual([]);
  });

  it("재발급이 거절(401)되면 세션 종료를 한 번 알리고 원래 실패를 돌려준다", async () => {
    const calls = route({
      "GET /api/me/todos": [NO_LOGIN],
      "POST /api/auth/refresh": [NO_LOGIN],
    });
    const result = await apiRequest({ path: "/me/todos" });
    expect(result).toMatchObject({ ok: false, failure: { kind: "http", status: 401, code: null } });
    expect(calls).toEqual(["GET /api/me/todos", "POST /api/auth/refresh"]);
    expect(events).toEqual([{ type: "sessionEnded", reason: "expired" }]);
  });

  it.each([403, 404])("재발급이 %i로 거절돼도 세션을 끝낸다", async (status) => {
    route({ "GET /api/me/todos": [EXPIRED], "POST /api/auth/refresh": [() => fail(status, "x")] });
    await apiRequest({ path: "/me/todos" });
    expect(events).toEqual([{ type: "sessionEnded", reason: "expired" }]);
  });

  it("재발급 중 네트워크가 끊기면 세션을 끝내지 않고 네트워크 실패를 돌려준다", async () => {
    route({
      "GET /api/me/todos": [EXPIRED],
      "POST /api/auth/refresh": [
        () => {
          throw new TypeError("Failed to fetch");
        },
      ],
    });
    const result = await apiRequest({ path: "/me/todos" });
    expect(result).toEqual({ ok: false, failure: { kind: "network" } });
    expect(events).toEqual([]);
  });

  it("재발급 서버 오류(500·503)도 세션을 끝내지 않는다", async () => {
    route({ "GET /api/me/todos": [EXPIRED], "POST /api/auth/refresh": [() => fail(503, "외부 서비스에 일시적으로 연결할 수 없습니다")] });
    const result = await apiRequest({ path: "/me/todos" });
    expect(result).toMatchObject({ ok: false, failure: { status: 503 } });
    expect(events).toEqual([]);
  });

  it("재발급 뒤 다시 보낸 요청도 401이면 더 시도하지 않고 세션을 끝낸다", async () => {
    const calls = route({
      "GET /api/me/todos": [EXPIRED, () => fail(401, "세션이 만료되었습니다. 다시 로그인해 주세요")],
      "POST /api/auth/refresh": [() => ok(null)],
    });
    await apiRequest({ path: "/me/todos" });
    expect(calls).toHaveLength(3);
    expect(events).toEqual([{ type: "sessionEnded", reason: "expired" }]);
  });

  it("동시에 여러 요청이 401이어도 재발급은 한 번만 보낸다", async () => {
    const calls = route({
      "GET /api/me/todos": [EXPIRED, () => ok("a")],
      "GET /api/me/events": [EXPIRED, () => ok("b")],
      "POST /api/auth/refresh": [async () => ok(null)],
    });
    const [a, b] = await Promise.all([apiRequest({ path: "/me/todos" }), apiRequest({ path: "/me/events" })]);
    expect(a).toEqual({ ok: true, data: "a" });
    expect(b).toEqual({ ok: true, data: "b" });
    expect(calls.filter((call) => call === "POST /api/auth/refresh")).toHaveLength(1);
  });

  it("공개 API(로그인·공개 라벨)의 401은 재발급하지 않는다", async () => {
    const calls = route({ "POST /api/auth/login": [() => fail(401, "로그인이 필요합니다")] });
    await apiRequest({ method: "POST", path: "/auth/login", body: {}, scope: "public" });
    expect(calls).toEqual(["POST /api/auth/login"]);
    expect(events).toEqual([]);
  });

  it("401이 아닌 실패(400·404·409·500)는 재발급하지 않는다", async () => {
    const calls = route({ "GET /api/projects/1": [() => fail(404, "프로젝트를 찾을 수 없습니다")] });
    const result = await apiRequest({ path: "/projects/1" });
    expect(result).toMatchObject({ ok: false, failure: { status: 404 } });
    expect(calls).toEqual(["GET /api/projects/1"]);
  });
});

describe("403 → 비밀번호 변경 강제 확인", () => {
  it("서버 계정이 mustChangePassword면 비밀번호 변경 화면으로 보내는 이벤트를 낸다", async () => {
    route({
      "GET /api/me/todos": [() => fail(403, "비밀번호를 변경한 뒤 이용할 수 있습니다")],
      "GET /api/auth/me": [() => ok({ userId: 5, loginId: "hong", name: "홍길동", systemRole: "USER", mustChangePassword: true })],
    });
    const result = await apiRequest({ path: "/me/todos" });
    expect(result).toMatchObject({ ok: false, failure: { status: 403 } });
    expect(events).toEqual([{ type: "passwordChangeRequired" }]);
  });

  it("다른 403(PM 전용 등)이면 이벤트를 내지 않는다", async () => {
    route({
      "DELETE /api/projects/1/members/11": [() => fail(403, "프로젝트 PM만 할 수 있는 작업입니다")],
      "GET /api/auth/me": [() => ok({ userId: 5, loginId: "hong", name: "홍길동", systemRole: "USER", mustChangePassword: false })],
    });
    await apiRequest({ method: "DELETE", path: "/projects/1/members/11" });
    expect(events).toEqual([]);
  });

  it("만료 토큰을 재발급한 뒤 403이면(비밀번호 변경 강제 세션) 그때도 확인한다", async () => {
    route({
      "GET /api/me/todos": [EXPIRED, () => fail(403, "비밀번호를 변경한 뒤 이용할 수 있습니다")],
      "POST /api/auth/refresh": [() => ok(null)],
      "GET /api/auth/me": [() => ok({ userId: 5, loginId: "hong", name: "홍길동", systemRole: "USER", mustChangePassword: true })],
    });
    await apiRequest({ path: "/me/todos" });
    expect(events).toEqual([{ type: "passwordChangeRequired" }]);
  });

  it("계정 확인이 실패해도 이벤트를 내지 않고 원래 403을 돌려준다", async () => {
    route({
      "GET /api/me/todos": [() => fail(403, "x")],
      "GET /api/auth/me": [
        () => {
          throw new TypeError("Failed to fetch");
        },
      ],
    });
    const result = await apiRequest({ path: "/me/todos" });
    expect(result).toMatchObject({ ok: false, failure: { status: 403 } });
    expect(events).toEqual([]);
  });
});
