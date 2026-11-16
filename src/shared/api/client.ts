import { emitAuthEvent } from "@/shared/api/authEvents";

/**
 * 공통 HTTP 요청 계층.
 * - 토큰은 HttpOnly 쿠키로만 오가므로 credentials: "include"로 보내고, 응답 본문에서 토큰을 읽지 않는다.
 * - 모든 요청은 취소(signal)와 타임아웃을 지원한다.
 * - 401 EXPIRED_TOKEN이면 AccessToken을 한 번만 재발급하고 원래 요청을 한 번 재시도한다.
 * - 그 밖의 401은 세션 종료, 403 PASSWORD_CHANGE_REQUIRED는 비밀번호 변경 강제로 알린다.
 */

export type ApiFailure =
  | { kind: "http"; status: number; code: string | null; message: string | null }
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
    return { ok: false, failure: { kind: "http", status: response.status, code, message } };
  } catch {
    if (timedOut) return { ok: false, failure: { kind: "timeout" } };
    if (signal?.aborted) return { ok: false, failure: { kind: "aborted" } };
    return { ok: false, failure: { kind: "network" } };
  } finally {
    window.clearTimeout(timer);
    signal?.removeEventListener("abort", forwardAbort);
  }
};

/** 동시에 여러 요청이 만료돼도 재발급은 한 번만 보낸다. */
let refreshInFlight: Promise<boolean> | null = null;

const refreshAccessToken = function () {
  if (!refreshInFlight) {
    refreshInFlight = send<null>({ method: "POST", path: "/auth/refresh" })
      .then(({ ok }) => ok)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
};

const reportAuthFailure = function (failure: ApiFailure) {
  if (failure.kind !== "http") return;
  const { status, code } = failure;
  if (status === 401) {
    emitAuthEvent({ type: "sessionEnded", reason: code === "UNAUTHORIZED" ? "unauthorized" : "expired" });
    return;
  }
  if (status === 403 && code === "PASSWORD_CHANGE_REQUIRED") {
    emitAuthEvent({ type: "passwordChangeRequired" });
  }
};

export const apiRequest = async function <T>(options: RequestOptions): Promise<ApiResult<T>> {
  const { scope = "session" } = options;
  const first = await send<T>(options);
  if (first.ok === true || scope === "public") return first;

  const { failure } = first;
  const expired = failure.kind === "http" && failure.status === 401 && failure.code === "EXPIRED_TOKEN";
  if (!expired) {
    reportAuthFailure(failure);
    return first;
  }

  const refreshed = await refreshAccessToken();
  if (!refreshed) {
    // 재발급이 어떤 401로 실패하든 다시 시도하지 않고 로그인 화면으로 보낸다.
    emitAuthEvent({ type: "sessionEnded", reason: "expired" });
    return first;
  }

  const retried = await send<T>(options);
  if (retried.ok === false) reportAuthFailure(retried.failure);
  return retried;
};
