import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/features/auth/authContext";
import type { CommonCodeGroup, CommonCodeGroupData } from "@/shared/codes/codeApi";
import {
  fallbackCommonCodes,
  getCachedCommonCodes,
  loadCommonCodes,
  resolveCodeList,
  resolveCommonCodeLabel,
  subscribeCodeCache,
  type ResolvedCommonCode,
} from "@/shared/codes/codeStore";

export interface UseCommonCodesResult {
  /** 정렬 순서 오름차순의 사용 중 코드 목록(표시 문구 포함) */
  codes: ResolvedCommonCode[];
  /** 코드 값으로 표시 문구를 찾는다. 없으면 라벨 키/폴백 문구를 돌려준다. */
  labelOf: (code: string, fallback?: string) => string;
  /** 현재 목록이 서버 응답인지 정적 폴백인지 */
  source: "server" | "fallback";
  /** 서버 조회 진행 여부 */
  loading: boolean;
}

/**
 * 화면용 공통 코드 조회 훅 (FR-ADM-07).
 * - api 모드 + 로그인 완료(비밀번호 변경 강제 아님)일 때 GET /api/codes/{groupCode}를 호출하고 캐시한다.
 * - 호출 중이거나 실패하거나 데모 모드일 때는 정적 폴백(기존 라벨)을 반환해 화면이 깨지지 않는다.
 * - 언어 전환 시 I18nProvider가 트리를 다시 마운트하므로, 캐시된 코드의 label도 새 언어로 자동 갱신된다.
 */
export const useCommonCodes = function (groupCode: CommonCodeGroup): UseCommonCodesResult {
  const { mode, status, mustChangePassword } = useAuth();
  const canFetch = mode === "api" && status === "signedIn" && !mustChangePassword;
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<CommonCodeGroupData | null>(() => (canFetch ? getCachedCommonCodes(groupCode) : null));
  const [loading, setLoading] = useState<boolean>(() => canFetch && !getCachedCommonCodes(groupCode));

  useEffect(() => {
    return subscribeCodeCache((changedGroup) => {
      if (!changedGroup || changedGroup === groupCode) {
        setRevision((value) => value + 1);
      }
    });
  }, [groupCode]);

  useEffect(() => {
    if (!canFetch) {
      setData(null);
      setLoading(false);
      return undefined;
    }
    const cached = getCachedCommonCodes(groupCode);
    if (cached) {
      setData(cached);
      setLoading(false);
      return undefined;
    }
    let active = true;
    setLoading(true);
    loadCommonCodes({ groupCode }).then((result) => {
      if (!active) return;
      if (result.ok === true) {
        setData(result.data);
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [canFetch, groupCode, revision]);

  const effective = data ?? fallbackCommonCodes(groupCode);
  const codes = useMemo(() => resolveCodeList(groupCode, effective.codes), [groupCode, effective.codes]);

  const labelOf = useMemo(() => {
    const byCode = new Map(codes.map((item) => [item.code, item.label]));
    return (code: string, fallback?: string) =>
      byCode.get(code) ?? resolveCommonCodeLabel({ groupCode, code, fallback });
  }, [codes, groupCode]);

  return {
    codes,
    labelOf,
    source: data ? "server" : "fallback",
    loading,
  };
};
