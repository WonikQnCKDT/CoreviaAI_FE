import type { ApiFailure } from "@/shared/api/client";
import { ADMIN_PM_TEXT } from "@/features/admin/i18n/pmReassign";
import { adminErrorMessage } from "@/features/admin/utils/adminFormat";

/**
 * PUT /api/admin/projects/pm 실패 → 화면 문구.
 * - 409는 PM_REASSIGN_NOT_ALLOWED뿐이다. 서버는 없는 코드와 활성 PM이 남은 프로젝트를 일부러 구분하지 않는다
 *   (관리자가 코드를 바꿔 가며 프로젝트 존재를 알아낼 수 없게). 화면도 두 경우를 함께 안내한다.
 * - 400은 입력 형식·초대할 수 없는 사용자·게이트 승인자 등 여럿이라 서버 메시지를 쓴다.
 */
export const interpretReassignPmFailure = (failure: ApiFailure): string =>
  adminErrorMessage(failure, { byStatus: { 409: ADMIN_PM_TEXT.notAllowed } });
