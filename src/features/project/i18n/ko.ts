import type { ApiFailure } from "@/shared/api/client";
import type { ProjectActor } from "@/features/project/api/projectApi";
import { AUTH_TEXT } from "@/features/auth/i18n/ko";
import { ROLE_LABEL } from "@/utils/ui";

export const PROJECT_ACTOR_LABEL: Record<ProjectActor, string> = {
  ...ROLE_LABEL,
  deptStaff: "부서 담당자",
  customerLiaison: "고객 대응 담당",
};

export function projectApiError(failure: ApiFailure): string {
  if (failure.kind === "http" && failure.message) return failure.message;
  if (failure.kind === "timeout") return AUTH_TEXT.timeout;
  if (failure.kind === "network") return AUTH_TEXT.network;
  return AUTH_TEXT.unknown;
}

export const UNSAVED_PROJECT_MESSAGE = "이 화면에서 나가면 작성 중인 프로젝트 정보가 저장되지 않습니다.";
