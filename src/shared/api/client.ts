import { emitAuthEvent } from "@/shared/api/authEvents";

/**
 * 공통 HTTP 요청 계층.
 * - 토큰은 HttpOnly 쿠키로만 오가므로 credentials: "include"로 보내고, 응답 본문에서 토큰을 읽지 않는다.
 * - 모든 요청은 취소(signal)와 타임아웃을 지원한다.
 * - 401 EXPIRED_TOKEN이면 AccessToken을 한 번만 재발급하고 원래 요청을 한 번 재시도한다.
 * - 그 밖의 401은 세션 종료, 403 PASSWORD_CHANGE_REQUIRED는 비밀번호 변경 강제로 알린다.
 */

export type ApiFailure =
  | {
      kind: "http";
      status: number;
      code: string | null;
      message: string | null;
      /** 기능 명세가 정한 업무 오류의 조치용 보조 데이터(공통 규약 2절). 서버가 보낸 경우에만 있다. */
      data?: unknown;
    }
  | { kind: "network" }
  | { kind: "timeout" }
  | { kind: "aborted" };

export type ApiResult<T> = { ok: true; data: T } | { ok: false; failure: ApiFailure };

/** "session": 로그인 세션이 필요한 API, "public": 로그인·재발급·로그아웃처럼 세션 처리 대상이 아닌 API */
type AuthScope = "session" | "public";

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  path: string;
  body?: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
  scope?: AuthScope;
}

interface ApiEnvelope<T> {
  success?: boolean;
  response?: T | null;
  error?: { code?: string; message?: string } | null;
}

const DEFAULT_TIMEOUT_MS = 10_000;

export const API_BASE_URL = (import.meta.env.VITE_API_URL || "/api").replace(/\/+$/, "");

const readEnvelope = async function <T>(response: Response): Promise<ApiEnvelope<T> | null> {
  const text = await response.text().catch(() => "");
  if (!text) return null;
  try {
    return JSON.parse(text) as ApiEnvelope<T>;
  } catch {
    return null;
  }
};

const send = async function <T>({
  method = "GET",
  path,
  body,
  signal,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: RequestOptions): Promise<ApiResult<T>> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const forwardAbort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener("abort", forwardAbort);

  try {
    const hasBody = body !== undefined;
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      credentials: "include",
      cache: "no-store",
      headers: hasBody ? { Accept: "application/json", "Content-Type": "application/json" } : { Accept: "application/json" },
      body: hasBody ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const envelope = await readEnvelope<T>(response);
    if (response.ok && envelope?.success !== false) {
      return { ok: true, data: (envelope?.response ?? null) as T };
    }
    const { code = null, message = null } = envelope?.error ?? {};
    // success=false여도 response에 조치용 데이터가 올 수 있다(예: 멤버 제외 409의 재배정 업무 목록). 있을 때만 담는다.
    const data = envelope?.response ?? null;
    return {
      ok: false,
      failure: { kind: "http", status: response.status, code, message, ...(data !== null ? { data } : {}) },
    };
  } catch {
    if (timedOut) return { ok: false, failure: { kind: "timeout" } };
    if (signal?.aborted) return { ok: false, failure: { kind: "aborted" } };
    return { ok: false, failure: { kind: "network" } };
  } finally {
    window.clearTimeout(timer);
    signal?.removeEventListener("abort", forwardAbort);
  }
};

/**
 * 재발급 결과. rejected = 서버가 재발급을 거절함(RefreshToken 없음·만료·세션 종료 등, 401·403·404),
 * unavailable = 서버에 닿지 못했거나 서버 오류라 판정할 수 없음(세션을 끝내지 않는다).
 */
type RefreshOutcome = { kind: "refreshed" } | { kind: "rejected" } | { kind: "unavailable"; failure: ApiFailure };

/** 동시에 여러 요청이 만료돼도 재발급은 한 번만 보낸다. */
let refreshInFlight: Promise<RefreshOutcome> | null = null;

const refreshAccessToken = function (): Promise<RefreshOutcome> {
  if (!refreshInFlight) {
    refreshInFlight = send<null>({ method: "POST", path: "/auth/refresh" })
      .then((result): RefreshOutcome => {
        if (result.ok === true) return { kind: "refreshed" };
        const { failure } = result;
        if (failure.kind === "http" && (failure.status === 401 || failure.status === 403 || failure.status === 404)) {
          return { kind: "rejected" };
        }
        return { kind: "unavailable", failure };
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
};

/** 403을 받은 세션이 비밀번호 변경 강제 상태인지 서버 계정으로 확인한다(동시에 여러 403이 와도 한 번만 묻는다). */
let passwordCheckInFlight: Promise<boolean> | null = null;

const isPasswordChangeRequired = function (): Promise<boolean> {
  if (!passwordCheckInFlight) {
    // GET /api/auth/me는 비밀번호 변경이 강제된 세션에도 허용된다(공통 규약 3절).
    passwordCheckInFlight = send<{ mustChangePassword?: unknown }>({ method: "GET", path: "/auth/me" })
      .then((result) => result.ok === true && result.data?.mustChangePassword === true)
      .finally(() => {
        passwordCheckInFlight = null;
      });
  }
  return passwordCheckInFlight;
};

const isStatus = (failure: ApiFailure, status: number) => failure.kind === "http" && failure.status === status;

/** 403이 비밀번호 변경 강제 때문이면 알린다. 결과는 그대로 돌려준다. */
const reportForbidden = async function <T>(result: ApiResult<T>): Promise<ApiResult<T>> {
  if (await isPasswordChangeRequired()) emitAuthEvent({ type: "passwordChangeRequired" });
  return result;
};

/**
 * 세션 API 요청.
 * 서버 오류 본문에는 code가 없다(공통 규약 6절: error는 message·status뿐). 그래서 EXPIRED_TOKEN·UNAUTHORIZED·
 * INVALID_TOKEN·SESSION_EXPIRED를 구분할 수 없어, 401이면 재발급을 한 번 시도해 그 결과로 판단한다.
 * - 재발급 성공: 원래 요청을 한 번만 다시 보낸다. 그래도 401이면 세션 종료
 * - 재발급 거절: 세션 종료(로그인 화면으로)
 * - 재발급 판정 불가(네트워크·서버 오류): 세션을 유지하고 그 실패를 돌려준다
 * 403이면 PASSWORD_CHANGE_REQUIRED인지 서버 계정(mustChangePassword)으로 확인한다. 403은 PM 전용 등 다른 사유도 쓰기 때문이다.
 */
export const apiRequest = async function <T>(options: RequestOptions): Promise<ApiResult<T>> {
  const { scope = "session" } = options;
  const first = await send<T>(options);
  if (first.ok === true || scope === "public") return first;

  const { failure } = first;
  if (isStatus(failure, 403)) return reportForbidden(first);
  if (!isStatus(failure, 401)) return first;

  const refresh = await refreshAccessToken();
  if (refresh.kind === "unavailable") return { ok: false, failure: refresh.failure };
  if (refresh.kind === "rejected") {
    emitAuthEvent({ type: "sessionEnded", reason: "expired" });
    return first;
  }

  const retried = await send<T>(options);
  if (retried.ok === true) return retried;
  // 비밀번호 변경이 강제된 세션은 만료 토큰을 재발급한 뒤 403으로 막힐 수 있다.
  if (isStatus(retried.failure, 403)) return reportForbidden(retried);
  if (isStatus(retried.failure, 401)) emitAuthEvent({ type: "sessionEnded", reason: "expired" });
  return retried;
};
