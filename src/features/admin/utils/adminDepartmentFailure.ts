import type { ApiFailure } from "@/shared/api/client";
import { adminErrorMessage, failureStatus } from "@/features/admin/utils/adminFormat";

/**
 * 부서 관리 API(02-2) 실패를 화면 동작으로 바꾼다.
 * 오류 본문에는 code가 없으므로(API 공통 규약 6절) 같은 API 안에서 HTTP status로 상황을 정한다.
 * 이름 형식은 화면에서 먼저 검사하므로, 서버의 400은 상위 부서 문제(INVALID_DEPARTMENT_PARENT)로 본다.
 */

export interface DepartmentFailureView {
  message: string;
  /** 이름 칸에 붙일 오류인지. 아니면 폼 전체 오류로 보여 준다. */
  nameError: boolean;
  /** 화면의 부서 목록이 낡았을 수 있어 다시 받아야 하는지 */
  stale: boolean;
}

/** POST /api/admin/departments — 409는 DUPLICATE_DEPARTMENT_NAME, 400은 없거나 비활성인 상위 부서 */
export const interpretCreateDepartmentFailure = function (failure: ApiFailure): DepartmentFailureView {
  const status = failureStatus(failure);
  const message = adminErrorMessage(failure);
  if (status === 409) return { message, nameError: true, stale: false };
  return { message, nameError: false, stale: status === 400 };
};

/**
 * PATCH /api/admin/departments/{departmentId}
 * 409는 이름 중복과 동시 수정 두 가지라 status로 구분할 수 없다. 서버 메시지를 폼 오류로 보여 주고 목록을 다시 받는다.
 * 400은 상위 부서 문제, 404는 부서가 사라진 경우다.
 */
export const interpretUpdateDepartmentFailure = function (failure: ApiFailure): DepartmentFailureView {
  const status = failureStatus(failure);
  return { message: adminErrorMessage(failure), nameError: false, stale: status === 400 || status === 404 || status === 409 };
};

/**
 * PATCH /api/admin/departments/{departmentId}/status
 * 400은 상위가 비활성인데 활성화, 404는 없는 부서, 409는 활성 소속 사용자·하위 부서가 남은 경우다.
 * 모두 화면의 상태·인원 정보가 낡았을 수 있어 목록을 다시 받는다.
 */
export const interpretDepartmentStatusFailure = function (failure: ApiFailure): DepartmentFailureView {
  const status = failureStatus(failure);
  return { message: adminErrorMessage(failure), nameError: false, stale: status === 400 || status === 404 || status === 409 };
};
