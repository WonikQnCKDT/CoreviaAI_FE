# 백엔드에 필요한 API (FE 요청)

> 상태: Draft · 작성: FE · 기준: BE `develop` (50f96d2), Confluence 03. 프로젝트 (API) v9
> FE가 화면을 실제 데이터로 연결하려면 필요하지만 지금 BE에 없는 API를 정리한다. 이 문서는 요청서이며 계약이 아니다.

## 1. 일반 사용자용 부서 목록

| 항목 | 내용 |
| --- | --- |
| 필요한 화면 | 프로젝트 생성 › 주관 부서 (FR-PRJ-01 ①, 0~N개 선택) |
| 왜 필요한가 | 생성 API(`POST /api/projects`)는 `departmentIds`를 받지만, USER가 부서 ID를 알 방법이 없다. 부서 목록은 `GET /api/admin/departments`(SYSTEM_ADMIN 전용)뿐이고, 시스템 관리자는 프로젝트 API를 쓸 수 없다. 내 계정 조회(`GET /api/auth/me`)에도 소속 부서가 없다. |
| 지금 FE 동작 | 주관 부서를 비운 채 만든다(선택 항목). 화면에 "부서 조회 API가 없어 부서 없이 만듭니다"를 표시한다. |
| 바라는 형태(제안) | `GET /api/departments?status=ACTIVE` — 로그인 사용자 전원, 활성 부서의 `id·parentId·name`만. 커서 또는 전체 목록 |
| 함께 쓰일 곳 | 프로젝트 설정 변경(FR-PRJ-14)의 주관 부서, 프로젝트 목록의 부서 필터(`departmentId`) |

## 2. 일반 사용자용 사용자 검색

| 항목 | 내용 |
| --- | --- |
| 필요한 화면 | 프로젝트 생성 › 멤버 초대·게이트 승인자 (FR-PRJ-01 ⑤⑥), 멤버·설정 › 멤버 초대 (FR-PRJ-04, `POST /api/projects/{id}/members`) |
| 왜 필요한가 | 초대 API는 `userId`를 받지만, PM이 초대할 사용자를 찾을 API가 없다. 사용자 목록은 `GET /api/admin/users`(SYSTEM_ADMIN 전용)뿐이다. 게이트 승인자는 초대한 멤버 중에서 고르므로 이것도 함께 막힌다. |
| 지금 FE 동작 | 생성 시 멤버·승인자를 비운 채 만든다(선택 항목). 멤버·설정의 초대 버튼은 비활성으로 두고 "사용자 검색 API가 없어 초대할 수 없습니다"를 표시한다. |
| 바라는 형태(제안) | `GET /api/users/search?keyword=&size=` — 로그인 USER, **초대할 수 있는 사용자(활성 일반 사용자)만**, `id·name·departmentName·jobTitle` 정도만(아이디·이메일·역할 등은 빼서 노출 최소화). 키워드 최소 길이·결과 수 상한 권장 |
| 보안 메모 | 전 직원 디렉터리를 일반 사용자에게 여는 결정이라, 노출 필드와 조회 범위(같은 회사 전원/부서 한정)를 BE에서 정해 주세요. |

## 3. (참고) 지금 FE가 서버와 연결하지 않은 변경

| 화면 | 이유 | 관련 |
| --- | --- | --- |
| 멤버·설정 › PM 변경·위임 | 위임 API(`pm-delegation`)가 없어졌고, PM 추가·해제는 멤버 역할 변경(`PATCH .../members/{userId}/role`)으로 한다. 화면을 역할 변경 방식으로 바꾸는 일은 복수 PM 작업과 겹쳐 남겨 둠 | SCRUM-172 |
| 멤버·설정 › 게이트 승인자 지정 | 승인자 변경 API가 아직 없음 | FR-PRJ-05, SCRUM-133 |

api 모드에서는 위 두 변경이 서버에 반영되지 않으므로 비활성으로 두고 이유를 표시한다(브라우저 안에서만 바뀌는 가짜 성공을 막기 위해).

## 4. (검토 요청) 오류 응답의 오류 코드

| 항목 | 내용 |
| --- | --- |
| 관찰한 사실 | BE 오류 응답은 `{ success, response, error: { message, status } }`만 준다(`ApiResponse.ApiError`, `SecurityErrorResponseWriter`). `JsonAuthenticationEntryPoint` 주석과 공통 규약 3절 표는 "FE는 EXPIRED_TOKEN이면 refresh"라고 하지만 응답에 코드가 없어 FE는 EXPIRED_TOKEN·UNAUTHORIZED·INVALID_TOKEN·SESSION_EXPIRED(모두 401)와 PASSWORD_CHANGE_REQUIRED·ACCOUNT_DISABLED·PROJECT_PM_ONLY(모두 403)를 구분할 수 없다. |
| 지금 FE 동작 | 401이면 재발급을 한 번 시도해 그 결과(성공/거절/판정 불가)로 판단한다. 403이면 `GET /api/auth/me`의 `mustChangePassword`로 비밀번호 변경 강제 여부를 확인한다. 메시지 문구로는 분기하지 않는다. |
| 영향 | 만료가 아닌 401(로그인 안 함 등)에도 재발급 요청이 한 번 더 간다. 403마다 계정 조회가 한 번 더 간다. 같은 status 안의 여러 오류(예: 비밀번호 변경의 400 세 가지)는 입력칸을 고르지 못하고 서버 메시지를 폼 오류로 보인다. |
| 제안 | `error`에 `code`(ErrorCode 이름)를 추가하면 FE가 추가 요청 없이 정확히 분기할 수 있다. 추가하지 않기로 하면 공통 규약 3절 표의 "ErrorCode" 열이 문서 분류일 뿐이라는 점을 명시해 주세요. |
