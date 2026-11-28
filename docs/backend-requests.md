# 백엔드에 필요한 API (FE 요청)

> 상태: Draft · 작성: FE · 기준: BE `develop` (50f96d2), Confluence 03. 프로젝트 (API) v9 · 04. WBS·일정 (API) v12 · 05. 업무·보드 (API) v3 · 06. 개인 업무 (API) v3 · 06-2. 개인 일정·업무일지 (API) v6 · 08. 회의록·산출물·게시판·파일 (API) v2 · 12. 알림 (API) v1
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

## 5. (검토 요청) 04. WBS·일정 명세와 BE 구현의 차이

FE는 BE 구현(DTO)을 기준으로 연결했다. 명세를 구현에 맞춰 고쳐 주세요.

| 항목 | 명세(v12) | BE develop 50f96d2 | FE 동작 |
| --- | --- | --- | --- |
| AI 초안 응답 `stages[]` | `stageCode`(WaterfallPhaseType) | `phaseId`·`phaseName`(`ProposedStage`) | `phaseId`를 읽고, 프로젝트에 없는 단계면 첫 단계로 둔다 |
| 단계 저장 | 공통 사항 "단계 미저장(`wbs_tasks.phase_id` 제거)" | 11-23 추가분대로 `phaseId`를 요청·응답·저장 | `phaseId`를 보낸다(하위작업은 보내지 않음, 상위 상속) |
| 트리 항목 필드 | `taskType`·`priority`·`phaseId` 없음 | 응답에 있음 | `phaseId`로 단계별로 묶어 보인다 |

## 6. (참고) WBS 화면에서 아직 서버와 연결하지 않은 기능

| 화면 | 이유 | 관련 |
| --- | --- | --- |
| WBS › 선후행 관계·마일스톤 편집 | BE API(`.../predecessors`, `.../milestones`)는 있으나 04 API 명세 페이지에 계약이 없어 이번 범위에서 뺐다. api 모드 WBS 화면에 "아직 연결하지 않음"을 표시한다 | FR-WBS-03(SCRUM-118)·FR-WBS-04(SCRUM-108) |
| 간트·칸반 | api 모드에서도 데모 업무를 보여 준다(보드 API `.../board`는 FR-TSK-02 범위) | FR-WBS-02·FR-TSK-02 |
| WBS › 드래그 이동 | 위·아래 한 칸 이동 버튼으로 같은 이동 API(`PUT .../position`)를 쓴다. 다른 작업 아래로 옮기기(계층 변경)는 화면에 없다 | FR-WBS-01 |

오류 본문에 code가 없어(4절) 같은 status 안의 여러 오류는 API별로 가장 가능성 높은 뜻으로 안내한다. 예: AI 초안 반영의 404는 `AI_DRAFT_EXPIRED`·`FEATURE_DISABLED`·`PHASES_NOT_AVAILABLE`을 구분하지 못해 "초안 만료, 다시 만들어 주세요"로 안내한다.

## 7. (검토 요청) 05. 업무·보드 명세와 BE 구현의 차이

| 항목 | 명세(v3) | BE develop 50f96d2 | FE 동작 |
| --- | --- | --- | --- |
| 보드 단계 필터 | "범위 밖: 단계 필터(작업과 단계 연결이 없어 구현 불가)" | `GET .../board?phaseId=`를 받고 카드에 `phaseId`가 있음 | 명세에 계약이 없어 쓰지 않는다(담당자 필터만). 계약이 확정되면 연결 |
| 업무 상세 `phaseId` | 필드 목록에 없음 | 응답에 있음 | 쓰지 않는다 |

## 8. (참고) 칸반·업무 상세에서 아직 서버와 연결하지 않은 기능

| 화면 | 이유 | 관련 |
| --- | --- | --- |
| 업무 상세 › 코멘트·멘션 | 05 API에 코멘트 API가 없다(ERD에만 `task_comments`) | FR-TSK-06(SCRUM-144) |
| 칸반 › 같은 컬럼 안 순서 | 명세 범위 밖(종료일·ID 순 고정) | FR-TSK-02 |
| 업무 상세 › 변경 이력 필드 이름 | 이력 before·after 키(`assigneeUserId`, `startDate` 등)를 그대로 보인다. 키별 표시 이름 라벨이 정해지면 바꾼다 | FR-TSK-01 |

## 9. (요청) 내 TODO 배정 업무의 프로젝트 이름

| 항목 | 내용 |
| --- | --- |
| 필요한 화면 | 내 업무 › 할 일 목록 (FR-PSN-01, `GET /api/me/todos`) |
| 왜 필요한가 | 배정 업무(`source=TASK`) 항목에 `projectId`만 있고 프로젝트 이름이 없다. FE는 이미 받아 둔 프로젝트 목록에서 이름을 찾고, 없으면 `#ID`로 보인다 |
| 제안 | `TodoItemResponse`에 `projectName`(TASK만, 나머지 null)을 추가. 업무를 볼 수 있는 사용자에게만 나오는 항목이라 추가 노출은 없다 |

## 10. (참고) 내 업무에서 아직 서버와 연결하지 않은 탭

| 탭 | 이유 | 관련 |
| --- | --- | --- |
| 승인 요청 | 승인 원천(산출물·게이트 승인)이 BE에 없다(06 API "승인된 후속") | FR-PSN-01 후속 |
| 캘린더·업무일지 | 06-2 API로 연결함(11절 참고) | FR-PSN-02(SCRUM-120)·FR-PSN-03(SCRUM-121) |

## 11. (참고) 06-2 개인 일정·업무일지 연결 범위

| 항목 | 상태 | 이유·관련 |
| --- | --- | --- |
| 개인 일정 삭제 | 화면에 없음, 수정 폼에 "삭제 보류" 안내 | 삭제 API 보류 결정(2026-11-23) |
| 캘린더 주·일 보기 | api 모드는 월 보기 + 선택한 날 목록만 | FR-PSN-02 월·주·일 표시는 후속 |
| 마일스톤·회의 일정 통합 | 없음 | 06-2 명세 "별도 범위" |
| 프로젝트 PM의 연결 업무일지 조회(`GET /api/projects/{id}/worklogs`) | 화면 없음 | PM용 화면 위치(프로젝트 메뉴)를 정한 뒤 연결 |
| `GET /api/me/calendar`의 개인 일정 | 쓰지 않음(메모가 없어 `/api/me/events`를 함께 부른다) | 제안: `CalendarItem`에 `memo`를 넣으면 한 번에 받을 수 있다 |

## 12. (참고) 08 회의록·산출물·게시판·파일 연결 범위

| 항목 | 상태 | 이유·관련 |
| --- | --- | --- |
| 회의록 목록·검색·상세·작성·수정·삭제 | api 모드 연결 | FR-DOC-01(SCRUM-122) |
| 회의록 AI 정리·액션아이템 업무 전환 | 데모 화면에만 있음 | 08 명세 "이번 범위가 아님"(FR-DOC-02·03) |
| AI·업무 전환 항목이 있는 회의록 수정·삭제 | 화면에서 막고 이유 표시 | 서버 409 `MEETING_ITEMS_PROTECTED`. 전체 교체 PATCH라 항목을 보존한 채 고칠 방법이 없다 |
| 산출물·게시판·파일 | 연결하지 않음 | 08 API 명세 페이지와 BE develop에 API가 없다. 명세가 나오면 연결 |
| 페이지 제목 | 명세 제목은 "회의록·산출물·게시판·파일"이지만 내용은 회의록 API 5개뿐 | 나머지 API가 별도 페이지로 나뉠 예정인지 확인 요청 |

## 13. (확인 요청) 12 알림 — BE 코드 없이 명세로 연결

| 항목 | 내용 |
| --- | --- |
| 상황 | 12. 알림 (API) v1은 로컬 브랜치 `feature/SCRUM-124-in-app-notification` 기준이고, BE develop(50f96d2)과 원격 저장소에 알림 코드가 없다(2026-11-27 확인). FE는 명세 계약으로 만들었다(사용자 결정) |
| 지금 FE 동작 | 서버가 404면 "알림 서버 준비 중"을 보이고 SSE·주기 조회를 하지 않는다. BE가 합쳐진 뒤 새로 고치면 동작한다 |
| BE 합친 뒤 FE가 다시 볼 것 | 항목 필드 이름(`notificationType`·`messageKey`·`messageParams`·`readAt` 등), `unread-count` 응답 형식(`{unreadCount}`), SSE 이벤트 이름(`ready`·`notification`)과 data 형식, 읽음 응답 형식 |
| 요청 | ① 모두 읽음 API(지금은 항목별 읽음만 있어 FE에 "모두 읽음"이 없다) ② `messageKey`(notification.assigned 등)를 다국어 라벨로 등록할지 결정 — FE는 같은 키로 한국어 기본 문구를 두었다 ③ 리스크 알림의 기여 요인 근거 필드(인수 기준) |
