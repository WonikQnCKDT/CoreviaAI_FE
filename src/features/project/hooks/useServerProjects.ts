import { useCallback, useEffect, useRef, useState } from "react";
import { useDemoStore } from "@/stores/DemoStore";
import { useAuth } from "@/features/auth/authContext";
import { fetchAllProjectMembers, fetchAllProjects, fetchProjectDetail, fetchProjectPhases } from "@/features/project/api/projectApi";
import { AUTH_TEXT } from "@/features/auth/i18n/ko";
import { PROJECT_LOAD_TEXT } from "@/features/project/i18n/ko";
import type { ApiFailure } from "@/shared/api/client";

export type ServerLoadState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "notFound" }
  | { phase: "ready" };

/** 기존 import 경로를 유지한다. 문구는 다국어 라벨 카탈로그(project.load.*)에서 읽는다. */
export const PROJECT_TEXT = PROJECT_LOAD_TEXT;

const failureMessage = function (failure: ApiFailure): string {
  if (failure.kind === "timeout") return AUTH_TEXT.timeout;
  if (failure.kind === "network") return AUTH_TEXT.network;
  if (failure.kind === "http" && failure.message && failure.status === 400) return failure.message;
  return AUTH_TEXT.unknown;
};

/** 목록 진척률을 채우려고 상세를 동시에 부르는 최대 개수. 프로젝트가 많아도 서버에 한꺼번에 몰리지 않게 한다 */
export const PROGRESS_FETCH_CONCURRENCY = 4;

/**
 * 목록 응답(ProjectSummaryResponse)에는 진척률이 없어, 프로젝트마다 상세(GET /api/projects/{id})를 불러 채운다.
 * 목록은 먼저 보여 주고 진척률은 받는 대로 채운다. 실패한 프로젝트는 '-'로 남긴다(목록 전체를 실패로 보지 않는다).
 */
const fillServerProgress = async function ({
  serverIds,
  signal,
  apply,
}: {
  serverIds: number[];
  signal: AbortSignal;
  apply: (serverId: number, progress: number) => void;
}) {
  const queue = [...serverIds];
  const worker = async () => {
    while (queue.length > 0 && !signal.aborted) {
      const serverId = queue.shift() as number;
      const result = await fetchProjectDetail({ projectId: serverId, signal });
      if (signal.aborted) return;
      if (result.ok === true) apply(serverId, result.data.progress);
    }
  };
  await Promise.all(Array.from({ length: Math.min(PROGRESS_FETCH_CONCURRENCY, queue.length) }, worker));
};

/**
 * api 모드: GET /api/projects 전체를 받아 화면 프로젝트로 연결하고, 진척률은 상세에서 채운다.
 * demo 모드: 아무것도 하지 않는다 (항상 ready).
 */
export const useServerProjectList = function () {
  const { mode } = useAuth();
  const { syncServerProjects, syncServerProjectProgress } = useDemoStore();
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
      void fillServerProgress({ serverIds: result.data.map((p) => p.id), signal: controller.signal, apply: syncServerProjectProgress });
    });
  }, [isApi, syncServerProjects, syncServerProjectProgress]);

  useEffect(() => {
    reload();
    return () => controllerRef.current?.abort();
  }, [reload]);

  return { isApi, state, reload };
};

/**
 * api 모드: 상세·단계·멤버를 동시에 받아 화면 프로젝트에 반영한다(03 v9: 상세에는 멤버·단계가 없다).
 * - 상세 404 PROJECT_NOT_FOUND: 없거나 볼 수 없는 프로젝트 → notFound
 * - 단계: 단계가 없으면 빈 배열. 상세가 성공했는데 단계가 404면 단계 없음으로 본다(이전 계약의 PHASES_NOT_AVAILABLE)
 * - 멤버: 받지 못하면 오류로 본다(멤버 권한 판단에 필요)
 * 오류 본문에는 code가 없어(공통 규약 6절) status로만 판단한다.
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

    Promise.all([
      fetchProjectDetail({ projectId: serverId, signal }),
      fetchProjectPhases({ projectId: serverId, signal }),
      fetchAllProjectMembers({ projectId: serverId, signal }),
    ]).then(
      ([detailResult, phasesResult, membersResult]) => {
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
          const noPhases = failure.kind === "http" && failure.status === 404;
          if (!noPhases) {
            setState({ phase: "error", message: failureMessage(failure) });
            return;
          }
          phases = [];
        }
        if (membersResult.ok === false) {
          setState({ phase: "error", message: failureMessage(membersResult.failure) });
          return;
        }
        syncServerProjectDetail({ detail: detailResult.data, phases, members: membersResult.data });
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
