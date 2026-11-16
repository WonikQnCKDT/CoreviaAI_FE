import { useCallback, useEffect, useRef, useState } from "react";
import { useDemoStore } from "@/stores/DemoStore";
import { useAuth } from "@/features/auth/authContext";
import { fetchAllProjects, fetchProjectDetail, fetchProjectPhases } from "@/features/project/api/projectApi";
import { AUTH_TEXT } from "@/features/auth/i18n/ko";
import type { ApiFailure } from "@/shared/api/client";

export type ServerLoadState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "notFound" }
  | { phase: "ready" };

export const PROJECT_TEXT = {
  loadListFailed: "프로젝트 목록을 불러오지 못했습니다",
  loadDetailFailed: "프로젝트를 불러오지 못했습니다",
  loading: "프로젝트를 불러오는 중입니다",
  retry: "다시 시도",
} as const;

const failureMessage = function (failure: ApiFailure): string {
  if (failure.kind === "timeout") return AUTH_TEXT.timeout;
  if (failure.kind === "network") return AUTH_TEXT.network;
  if (failure.kind === "http" && failure.message && failure.status === 400) return failure.message;
  return AUTH_TEXT.unknown;
};

/**
 * api 모드: GET /api/projects 전체를 받아 화면 프로젝트로 연결한다.
 * demo 모드: 아무것도 하지 않는다 (항상 ready).
 */
export const useServerProjectList = function () {
  const { mode } = useAuth();
  const { syncServerProjects } = useDemoStore();
  const isApi = mode === "api";
  const [state, setState] = useState<ServerLoadState>(isApi ? { phase: "loading" } : { phase: "ready" });
  const controllerRef = useRef<AbortController | null>(null);

  const reload = useCallback(() => {
    if (!isApi) return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState({ phase: "loading" });
    fetchAllProjects({ signal: controller.signal }).then((result) => {
      if (controller.signal.aborted) return;
      if (result.ok === false) {
        const { failure } = result;
        // 시스템 관리자는 프로젝트 API가 404다 (프로젝트 데이터 접근 불가). 실패가 아니라 '볼 수 있는 프로젝트 없음'이다.
        if (failure.kind === "http" && failure.status === 404) {
          syncServerProjects([]);
          setState({ phase: "ready" });
          return;
        }
        setState({ phase: "error", message: failureMessage(failure) });
        return;
      }
      syncServerProjects(result.data);
      setState({ phase: "ready" });
    });
  }, [isApi, syncServerProjects]);

  useEffect(() => {
    reload();
    return () => controllerRef.current?.abort();
  }, [reload]);

  return { isApi, state, reload };
};

/**
 * api 모드: 상세와 폭포수 단계를 동시에 받아 화면 프로젝트에 반영한다.
 * - 404 PROJECT_NOT_FOUND: 없거나 볼 수 없는 프로젝트 → notFound
 * - 404 PHASES_NOT_AVAILABLE: 폭포수가 아닌 프로젝트 → 단계 없이 진행
 * routeProjectId가 숫자가 아니면 프론트 데모 프로젝트라 서버를 부르지 않는다.
 */
export const useServerProjectDetail = function (routeProjectId: string | undefined) {
  const { mode } = useAuth();
  const { syncServerProjectDetail, removeServerProject } = useDemoStore();
  const serverId = routeProjectId && /^\d+$/.test(routeProjectId) ? Number(routeProjectId) : null;
  const shouldLoad = mode === "api" && serverId !== null;
  const [state, setState] = useState<ServerLoadState>(shouldLoad ? { phase: "loading" } : { phase: "idle" });
  const controllerRef = useRef<AbortController | null>(null);

  const reload = useCallback(() => {
    if (!shouldLoad || serverId === null) {
      setState({ phase: "idle" });
      return;
    }
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState({ phase: "loading" });
    const { signal } = controller;

    Promise.all([fetchProjectDetail({ projectId: serverId, signal }), fetchProjectPhases({ projectId: serverId, signal })]).then(
      ([detailResult, phasesResult]) => {
        if (signal.aborted) return;
        if (detailResult.ok === false) {
          const { failure } = detailResult;
          if (failure.kind === "http" && failure.status === 404) {
            removeServerProject(serverId);
            setState({ phase: "notFound" });
            return;
          }
          setState({ phase: "error", message: failureMessage(failure) });
          return;
        }
        let phases = null;
        if (phasesResult.ok === true) {
          phases = phasesResult.data;
        } else {
          const { failure } = phasesResult;
          const notWaterfall = failure.kind === "http" && failure.code === "PHASES_NOT_AVAILABLE";
          if (!notWaterfall) {
            setState({ phase: "error", message: failureMessage(failure) });
            return;
          }
        }
        syncServerProjectDetail({ detail: detailResult.data, phases });
        setState({ phase: "ready" });
      },
    );
  }, [shouldLoad, serverId, syncServerProjectDetail, removeServerProject]);

  useEffect(() => {
    reload();
    return () => controllerRef.current?.abort();
  }, [reload]);

  return { state, reload };
};
