import {
  fetchCommonCodes,
  type CommonCodeGroup,
  type CommonCodeGroupData,
  type CommonCodeItem,
} from "@/shared/codes/codeApi";
import type { ApiResult } from "@/shared/api/client";
import {
  CODE_GROUP_LABEL,
  HEALTH_LABEL,
  PROJECT_STATUS_LABEL,
  REQUEST_RESULT_LABEL,
  TASK_STATUS_LABEL,
} from "@/shared/i18n/catalog/status";
import { translate } from "@/shared/i18n/store";

/**
 * 화면용 공통 코드 캐시 및 폴백 저장소 (FR-ADM-07).
 * - 같은 그룹을 여러 화면·컴포넌트에서 불러도 한 번만 요청한다(캐시 + 동시 요청 합치기).
 * - 서버 조회에 실패하거나 데모 모드일 때는 BE V8 시드와 같은 정적 폴백 목록을 돌려준다.
 * - 표시 문구는 읽을 때마다 translate(labelKey, fallback)로 다국어 라벨을 적용한다.
 */

export interface FallbackCodeEntry {
  code: string;
  labelKey: string;
  sortOrder: number;
  fallback: () => string;
}

const FALLBACK_ENTRIES: Record<CommonCodeGroup, readonly FallbackCodeEntry[]> = {
  RISK_LEVEL: [
    { code: "NORMAL", labelKey: "code.RISK_LEVEL.NORMAL", sortOrder: 1, fallback: () => HEALTH_LABEL.normal },
    { code: "CAUTION", labelKey: "code.RISK_LEVEL.CAUTION", sortOrder: 2, fallback: () => HEALTH_LABEL.caution },
    { code: "DANGER", labelKey: "code.RISK_LEVEL.DANGER", sortOrder: 3, fallback: () => HEALTH_LABEL.danger },
  ],
  TASK_STATUS: [
    { code: "TODO", labelKey: "code.TASK_STATUS.TODO", sortOrder: 1, fallback: () => TASK_STATUS_LABEL.todo },
    { code: "IN_PROGRESS", labelKey: "code.TASK_STATUS.IN_PROGRESS", sortOrder: 2, fallback: () => TASK_STATUS_LABEL.progress },
    { code: "REVIEW", labelKey: "code.TASK_STATUS.REVIEW", sortOrder: 3, fallback: () => TASK_STATUS_LABEL.review },
    { code: "DONE", labelKey: "code.TASK_STATUS.DONE", sortOrder: 4, fallback: () => TASK_STATUS_LABEL.done },
  ],
  REQUEST_RESULT: [
    { code: "SUCCESS", labelKey: "code.REQUEST_RESULT.SUCCESS", sortOrder: 1, fallback: () => REQUEST_RESULT_LABEL.success },
    { code: "FAILURE", labelKey: "code.REQUEST_RESULT.FAILURE", sortOrder: 2, fallback: () => REQUEST_RESULT_LABEL.failure },
  ],
  PROJECT_STATUS: [
    { code: "PLANNED", labelKey: "code.PROJECT_STATUS.PLANNED", sortOrder: 1, fallback: () => PROJECT_STATUS_LABEL.planned },
    { code: "IN_PROGRESS", labelKey: "code.PROJECT_STATUS.IN_PROGRESS", sortOrder: 2, fallback: () => PROJECT_STATUS_LABEL.inProgress },
    { code: "ON_HOLD", labelKey: "code.PROJECT_STATUS.ON_HOLD", sortOrder: 3, fallback: () => PROJECT_STATUS_LABEL.onHold },
    { code: "COMPLETED", labelKey: "code.PROJECT_STATUS.COMPLETED", sortOrder: 4, fallback: () => PROJECT_STATUS_LABEL.completed },
    { code: "CANCELLED", labelKey: "code.PROJECT_STATUS.CANCELLED", sortOrder: 5, fallback: () => PROJECT_STATUS_LABEL.cancelled },
  ],
};

const cache = new Map<string, CommonCodeGroupData>();
const inFlight = new Map<string, Promise<ApiResult<CommonCodeGroupData>>>();
const listeners = new Set<(groupCode?: string) => void>();

const notify = (groupCode?: string) => {
  listeners.forEach((listener) => listener(groupCode));
};

export const subscribeCodeCache = function (listener: (groupCode?: string) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getCachedCommonCodes = function (groupCode: string): CommonCodeGroupData | null {
  return cache.get(groupCode) ?? null;
};

/** 그룹의 정적 폴백 목록(BE V8 시드 기준). */
export const fallbackCommonCodes = function (groupCode: CommonCodeGroup): CommonCodeGroupData {
  const entries = FALLBACK_ENTRIES[groupCode] ?? [];
  return {
    groupCode,
    labelKey: `codeGroup.${groupCode}`,
    codes: entries.map(({ code, labelKey, sortOrder }) => ({ code, labelKey, sortOrder })),
  };
};

/** 코드 항목의 현재 언어 표시 문구를 돌려준다. 라벨 묶음에 없으면 정적 기본 문구(한국어)를 쓴다. */
export const resolveCommonCodeLabel = function ({
  groupCode,
  code,
  labelKey,
  fallback,
}: {
  groupCode: CommonCodeGroup;
  code: string;
  labelKey?: string;
  fallback?: string;
}): string {
  const entry = FALLBACK_ENTRIES[groupCode]?.find((item) => item.code === code);
  const key = labelKey ?? entry?.labelKey ?? `code.${groupCode}.${code}`;
  const defaultText = fallback ?? entry?.fallback() ?? code;
  return translate(key, defaultText);
};

/** 그룹 이름의 현재 언어 표시 문구. */
export const resolveCodeGroupLabel = function (groupCode: CommonCodeGroup): string {
  return CODE_GROUP_LABEL[groupCode];
};

/**
 * 공통 코드를 캐시에서 읽거나 서버에서 불러온다.
 * - 캐시에 있고 force가 아니면 네트워크 요청을 보내지 않는다.
 * - 같은 그룹에 대한 동시 요청은 하나의 Promise를 공유한다(signal은 호출자 단위 취소로만 처리).
 */
export const loadCommonCodes = async function ({
  groupCode,
  force = false,
}: {
  groupCode: CommonCodeGroup | string;
  force?: boolean;
}): Promise<ApiResult<CommonCodeGroupData>> {
  if (!force) {
    const cached = cache.get(groupCode);
    if (cached) return { ok: true, data: cached };
  }
  const existing = inFlight.get(groupCode);
  if (existing && !force) return existing;

  const request = fetchCommonCodes({ groupCode })
    .then((result) => {
      if (result.ok === true) {
        cache.set(groupCode, result.data);
      }
      return result;
    })
    .finally(() => {
      if (inFlight.get(groupCode) === request) inFlight.delete(groupCode);
    });

  inFlight.set(groupCode, request);
  return request;
};

/** 관리자 화면에서 정렬 순서 등을 변경했을 때 캐시를 비우고 구독 화면을 다시 불러오게 한다. */
export const invalidateCodeCache = function (groupCode?: string) {
  if (groupCode) {
    cache.delete(groupCode);
    inFlight.delete(groupCode);
  } else {
    cache.clear();
    inFlight.clear();
  }
  notify(groupCode);
};

/** 로그아웃·테스트 초기화용 */
export const resetCodeCache = function () {
  cache.clear();
  inFlight.clear();
};

export interface ResolvedCommonCode extends CommonCodeItem {
  label: string;
}

export const resolveCodeList = function (groupCode: CommonCodeGroup, items: CommonCodeItem[]): ResolvedCommonCode[] {
  return items.map((item) => ({
    ...item,
    label: resolveCommonCodeLabel({ groupCode, code: item.code, labelKey: item.labelKey }),
  }));
};

/** 서버 공통 코드 RISK_LEVEL → 화면 Health 값 */
export const RISK_LEVEL_TO_HEALTH: Readonly<Record<string, "normal" | "caution" | "danger">> = {
  NORMAL: "normal",
  CAUTION: "caution",
  DANGER: "danger",
};

/** 화면 TaskStatus ↔ 서버 공통 코드 TASK_STATUS (BE V8 시드 기준) */
export const TASK_STATUS_TO_CODE: Readonly<Record<"todo" | "progress" | "review" | "done", string>> = {
  todo: "TODO",
  progress: "IN_PROGRESS",
  review: "REVIEW",
  done: "DONE",
};

export const CODE_TO_TASK_STATUS: Readonly<Record<string, "todo" | "progress" | "review" | "done">> = {
  TODO: "todo",
  IN_PROGRESS: "progress",
  REVIEW: "review",
  DONE: "done",
};
