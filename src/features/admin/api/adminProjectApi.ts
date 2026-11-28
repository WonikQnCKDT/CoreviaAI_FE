import { apiRequest, type ApiResult } from "@/shared/api/client";

/**
 * 시스템 관리자 PM 재지정 API (03. 프로젝트 API, FR-PRJ-04 · 요구사항 명세서 3.1 예외).
 * 활성 PM이 하나도 남지 않은 프로젝트에만 새 PM을 배치한다. 관리자는 프로젝트 데이터를 볼 수 없어
 * 조회 API 없이 프로젝트 코드와 새 PM 사용자 ID만 보내고, 응답도 재지정 후 PM 목록만 받는다.
 * 남아 있던 비활성 PM은 서버가 멤버에서 뺀다.
 */

/* ===== 서버 DTO (BE ReassignPmRequest·ProjectPmResponse) ===== */

interface ProjectPmDto {
  projectId: number;
  projectCode: string;
  pms: { id: number; name: string | null }[] | null;
}

/* ===== 화면 domain model ===== */

export interface ReassignedProjectPm {
  projectId: number;
  projectCode: string;
  pms: { id: number; name: string }[];
}

/** 프로젝트 코드 규칙(BE CreateProjectRequest.CODE_PATTERN): 영문·숫자로 시작하는 영문·숫자·하이픈 2~20자 */
export const ADMIN_PROJECT_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]{1,19}$/;

/** 서버와 같이 앞뒤 공백을 지우고 대문자로 바꾼다(CreateProjectRequest.normalizeCode). */
export const normalizeProjectCode = (code: string) => code.trim().toUpperCase();

const toReassigned = ({ projectId, projectCode, pms }: ProjectPmDto): ReassignedProjectPm => ({
  projectId,
  projectCode,
  pms: (pms ?? []).map(({ id, name }) => ({ id, name: name ?? "" })),
});

/** PUT /api/admin/projects/pm — 활성 PM이 남아 있거나 없는 코드면 409(PM_REASSIGN_NOT_ALLOWED, 두 경우를 구분하지 않는다) */
export const reassignProjectPm = async function ({
  projectCode,
  newPmUserId,
  signal,
}: {
  projectCode: string;
  newPmUserId: number;
  signal?: AbortSignal;
}): Promise<ApiResult<ReassignedProjectPm>> {
  const result = await apiRequest<ProjectPmDto>({
    method: "PUT",
    path: "/admin/projects/pm",
    body: { projectCode: normalizeProjectCode(projectCode), newPmUserId },
    signal,
  });
  return result.ok === true ? { ok: true, data: toReassigned(result.data) } : result;
};
