# FE 다국어 라벨 키 목록

> 자동 생성 문서입니다. 직접 고치지 말고 FE에서 `UPDATE_LABEL_DOC=1 npm test`로 다시 만드세요.
> 원본: `src/**/i18n/` 의 `defineLabels`·`defineLabelMap` 정의 (Confluence 02-4. 다국어 라벨, FR-ADM-06)

## 사용 방법 (BE 담당자)

- 아래 **등록 필요** 표의 키를 `i18n_labels`에 시드하거나 관리 화면(시스템 관리 › 다국어 라벨)에서 등록합니다.
- `text_ko`는 표의 한국어 기본 문구를 그대로 쓰면 화면이 지금과 같게 보입니다. `text_en`·`text_zh_tw`는 번역이 준비되면 채웁니다(비우면 한국어로 표시).
- 등록하지 않은 키도 FE는 한국어 기본 문구로 표시하므로 화면이 깨지지 않습니다.
- `{name}`처럼 중괄호로 감싼 부분은 FE가 값을 넣는 자리입니다. 번역문에도 같은 이름으로 남겨 주세요.

## 등록 필요 (577개)

| 라벨 키 | 한국어 기본 문구 | 구분 |
| --- | --- | --- |
| `admin.activateConfirmBody` | 활성화하면 다시 로그인할 수 있습니다. | admin |
| `admin.activateConfirmTitle` | 계정 활성화 | admin |
| `admin.addChildDepartment` | 하위 부서 추가 | admin |
| `admin.addDepartment` | 부서 추가 | admin |
| `admin.addUser` | 사용자 추가 | admin |
| `admin.allDepartments` | 부서 전체 | admin |
| `admin.allRoles` | 시스템 역할 전체 | admin |
| `admin.allStatuses` | 상태 전체 | admin |
| `admin.cancel` | 취소 | admin |
| `admin.close` | 닫기 | admin |
| `admin.code.description` | 상태값을 코드로 관리합니다. 관리자는 그룹 안 표시 순서만 바꿀 수 있습니다. | admin.code |
| `admin.code.displayText` | 표시 문구 | admin.code |
| `admin.code.emptyCodes` | 이 그룹에는 코드가 없습니다 | admin.code |
| `admin.code.emptyGroups` | 등록된 코드 그룹이 없습니다 | admin.code |
| `admin.code.emptyGroupsHint` | 코드 그룹은 서버 마이그레이션으로만 추가됩니다. | admin.code |
| `admin.code.fixedNote` | 코드 값·라벨 키·사용 여부는 바꿀 수 없습니다(서버 마이그레이션으로만 변경). 표시 텍스트는 다국어 라벨에서 라벨 키로 관리합니다. 정렬 순서를 바꾸면 감사 로그에 기록됩니다. | admin.code |
| `admin.code.groupsLabel` | 코드 그룹 | admin.code |
| `admin.code.inUse` | 사용 | admin.code |
| `admin.code.lastWriteWins` | 다른 관리자가 같은 코드의 순서를 동시에 바꾸면 나중에 저장한 값이 남습니다. | admin.code |
| `admin.code.loadCodesFailed` | 코드를 불러오지 못했습니다 | admin.code |
| `admin.code.loadGroupsFailed` | 코드 그룹을 불러오지 못했습니다 | admin.code |
| `admin.code.notInUse` | 사용 안 함 | admin.code |
| `admin.code.selectGroup` | 왼쪽에서 코드 그룹을 고르세요 | admin.code |
| `admin.code.sortOrderRange` | 정렬 순서는 0 이상 9999 이하의 정수로 입력해 주세요. | admin.code |
| `admin.code.sortOrderRequired` | 정렬 순서를 입력해 주세요. | admin.code |
| `admin.code.title` | 공통 코드 | admin.code |
| `admin.createdThenReset` | 계정을 만들었습니다. 비밀번호가 없어 아직 로그인할 수 없으니 이어서 임시 비밀번호를 발급해 주세요. | admin |
| `admin.deactivateConfirmBody` | 비활성화하면 대상 사용자의 모든 세션이 즉시 종료되고 이후 로그인할 수 없습니다. | admin |
| `admin.deactivateConfirmTitle` | 계정 비활성화 | admin |
| `admin.departmentNameRequired` | 부서 이름을 입력해 주세요. | admin |
| `admin.departmentNameTooLong` | 부서 이름은 50자 이하로 입력해 주세요. | admin |
| `admin.departmentRequired` | 시스템 관리자가 아니면 부서를 선택해야 합니다. | admin |
| `admin.departmentsDescription` | 부서를 트리로 관리합니다. 부서는 삭제하지 않고 비활성화합니다. | admin |
| `admin.departmentsTitle` | 부서 | admin |
| `admin.editDepartment` | 부서 수정 | admin |
| `admin.editUser` | 사용자 정보 수정 | admin |
| `admin.emptyDepartments` | 등록된 부서가 없습니다 | admin |
| `admin.emptyDepartmentsHint` | 첫 부서를 추가해 조직을 구성해 주세요. | admin |
| `admin.emptyHistory` | 변경 이력이 없습니다 | admin |
| `admin.emptyUsers` | 조건에 맞는 사용자가 없습니다 | admin |
| `admin.emptyUsersHint` | 검색어나 필터를 바꿔 다시 시도해 주세요. | admin |
| `admin.error.concurrentModification` | 다른 관리자가 먼저 변경했습니다. 최신 내용을 불러왔으니 확인 후 다시 시도해 주세요. | admin.error |
| `admin.error.sessionRevokeFailed` | 변경은 저장됐지만 대상 사용자의 세션을 끊지 못했습니다. 다시 시도하면 세션 종료를 다시 요청합니다. | admin.error |
| `admin.errorLog.anonymous` | 로그인 전 | admin.errorLog |
| `admin.errorLog.apiPath` | API 경로 | admin.errorLog |
| `admin.errorLog.apiPathHint` | 앞부분 일치, 대소문자 구분 | admin.errorLog |
| `admin.errorLog.apiPathTooLong` | API 경로는 300자 이하로 입력해 주세요. | admin.errorLog |
| `admin.errorLog.description` | 서버에서 처리하지 못한 예외를 최신순으로 봅니다. 기록은 고칠 수 없고 1년 보관합니다. | admin.errorLog |
| `admin.errorLog.detailTitle` | 에러 로그 상세 | admin.errorLog |
| `admin.errorLog.empty` | 조건에 맞는 에러 로그가 없습니다 | admin.errorLog |
| `admin.errorLog.emptyHint` | 기간이나 조건을 바꿔 다시 조회해 보세요. | admin.errorLog |
| `admin.errorLog.errorType` | 예외 유형 | admin.errorLog |
| `admin.errorLog.errorTypeHint` | 클래스 전체 이름과 정확히 일치 | admin.errorLog |
| `admin.errorLog.errorTypeTooLong` | 예외 유형은 200자 이하로 입력해 주세요. | admin.errorLog |
| `admin.errorLog.filterTitle` | 조회 조건 | admin.errorLog |
| `admin.errorLog.fromDate` | 시작일 | admin.errorLog |
| `admin.errorLog.invalidDate` | 날짜를 YYYY-MM-DD 형식으로 입력해 주세요. | admin.errorLog |
| `admin.errorLog.invalidPeriod` | 시작일은 종료일보다 늦을 수 없습니다. | admin.errorLog |
| `admin.errorLog.loadFailed` | 에러 로그를 불러오지 못했습니다 | admin.errorLog |
| `admin.errorLog.maskedNote` | 메시지와 스택 트레이스의 비밀번호·토큰·이메일·전화번호 같은 값은 서버가 저장 전에 \*\*\*\* 로 가렸습니다. 요청 본문·헤더는 저장하지 않습니다. | admin.errorLog |
| `admin.errorLog.message` | 메시지 | admin.errorLog |
| `admin.errorLog.noMessage` | 메시지 없음 | admin.errorLog |
| `admin.errorLog.noStackTrace` | 스택 트레이스가 없습니다 | admin.errorLog |
| `admin.errorLog.notFound` | 에러 로그를 찾을 수 없습니다. 목록을 새로 불러와 주세요. | admin.errorLog |
| `admin.errorLog.occurredAt` | 발생 시각 | admin.errorLog |
| `admin.errorLog.openDetail` | 상세 보기 | admin.errorLog |
| `admin.errorLog.periodNote` | 기간은 이 브라우저의 시간대 기준으로, 종료일 하루를 포함해 조회합니다. | admin.errorLog |
| `admin.errorLog.request` | 요청 | admin.errorLog |
| `admin.errorLog.search` | 조회 | admin.errorLog |
| `admin.errorLog.stackTrace` | 스택 트레이스 | admin.errorLog |
| `admin.errorLog.title` | 에러 로그 | admin.errorLog |
| `admin.errorLog.toDate` | 종료일 | admin.errorLog |
| `admin.errorLog.user` | 사용자 | admin.errorLog |
| `admin.errorLog.userIdFallback` | 사용자 #{id} | admin.errorLog |
| `admin.history` | 변경 이력 | admin |
| `admin.history.action.PASSWORD_RESET` | 비밀번호 초기화 | admin.history.action |
| `admin.history.action.PROJECT_CREATION_GRANTED` | 프로젝트 생성 권한 부여 (폐지된 기능) | admin.history.action |
| `admin.history.action.PROJECT_CREATION_REVOKED` | 프로젝트 생성 권한 회수 (폐지된 기능) | admin.history.action |
| `admin.history.action.USER_ACTIVATED` | 활성화 | admin.history.action |
| `admin.history.action.USER_CREATED` | 계정 생성 | admin.history.action |
| `admin.history.action.USER_DEACTIVATED` | 비활성화 | admin.history.action |
| `admin.history.action.USER_PROFILE_CHANGED` | 정보 수정 | admin.history.action |
| `admin.history.action.USER_ROLE_CHANGED` | 시스템 역할 변경 | admin.history.action |
| `admin.history.field.canCreateProject` | 프로젝트 생성 권한 | admin.history.field |
| `admin.history.field.departmentId` | 부서 | admin.history.field |
| `admin.history.field.departmentName` | 부서 | admin.history.field |
| `admin.history.field.jobTitle` | 직무 | admin.history.field |
| `admin.history.field.loginId` | 아이디 | admin.history.field |
| `admin.history.field.name` | 이름 | admin.history.field |
| `admin.history.field.status` | 상태 | admin.history.field |
| `admin.history.field.systemRole` | 시스템 역할 | admin.history.field |
| `admin.jobTitleTooLong` | 직무는 50자 이하로 입력해 주세요. | admin |
| `admin.label.add` | 라벨 등록 | admin.label |
| `admin.label.applyNow` | 지금 화면에 적용 | admin.label |
| `admin.label.concurrentModification` | 다른 관리자가 먼저 수정했습니다. 최신 문구를 불러왔으니 확인 후 다시 저장해 주세요. | admin.label |
| `admin.label.created` | {key} 라벨을 등록했습니다. | admin.label |
| `admin.label.description` | 화면 문구를 언어별로 관리합니다. 라벨 키는 바꾸거나 지울 수 없고, 문구만 고칩니다. | admin.label |
| `admin.label.edit` | 문구 수정 | admin.label |
| `admin.label.empty` | 조건에 맞는 라벨이 없습니다 | admin.label |
| `admin.label.emptyHint` | 검색어나 누락 필터를 바꿔 보세요. | admin.label |
| `admin.label.emptyMeansMissing` | 영어·번체 중국어를 비우면 번역 누락으로 저장되고 화면에는 한국어로 표시됩니다. | admin.label |
| `admin.label.key` | 라벨 키 | admin.label |
| `admin.label.keyFixed` | 라벨 키는 바꿀 수 없습니다. | admin.label |
| `admin.label.keyFormat` | 라벨 키는 영문자로 시작하고 점(.)으로 구분한 영문·숫자·밑줄·하이픈 100자 이하로 입력해 주세요. | admin.label |
| `admin.label.keyRequired` | 라벨 키를 입력해 주세요. | admin.label |
| `admin.label.loadFailed` | 라벨을 불러오지 못했습니다 | admin.label |
| `admin.label.missing` | 번역 누락 | admin.label |
| `admin.label.missingAll` | 번역 누락 필터 없음 | admin.label |
| `admin.label.missingEn` | 영어 번역 누락 | admin.label |
| `admin.label.missingFilter` | 번역 누락 필터 | admin.label |
| `admin.label.missingZhTw` | 번체 중국어 번역 누락 | admin.label |
| `admin.label.saved` | {key} 라벨을 저장했습니다. 다른 사용자 화면에는 다음에 문구를 불러올 때 반영됩니다. | admin.label |
| `admin.label.searchPlaceholder` | 라벨 키 또는 한국어 문구 검색 | admin.label |
| `admin.label.textControlCharacter` | 문구에는 줄바꿈·탭 같은 제어 문자를 넣을 수 없습니다. | admin.label |
| `admin.label.textEn` | 영어 | admin.label |
| `admin.label.textKo` | 한국어 | admin.label |
| `admin.label.textKoRequired` | 한국어 문구를 입력해 주세요. | admin.label |
| `admin.label.textOnlyNote` | 문구는 HTML로 해석하지 않고 글자 그대로 표시합니다. 변경 이력은 감사 로그에 남습니다. | admin.label |
| `admin.label.textTooLong` | 문구는 500자 이하로 입력해 주세요. | admin.label |
| `admin.label.textZhTw` | 번체 중국어 | admin.label |
| `admin.label.title` | 다국어 라벨 | admin.label |
| `admin.label.updatedAt` | 수정일 | admin.label |
| `admin.loadDepartmentsFailed` | 부서 목록을 불러오지 못했습니다 | admin |
| `admin.loadHistoryFailed` | 변경 이력을 불러오지 못했습니다 | admin |
| `admin.loading` | 불러오는 중입니다 | admin |
| `admin.loadingMore` | 더 불러오는 중 | admin |
| `admin.loadMore` | 더 보기 | admin |
| `admin.loadUsersFailed` | 사용자 목록을 불러오지 못했습니다 | admin |
| `admin.loginIdFormat` | 아이디는 50자 이하의 영문·숫자·마침표(.)·밑줄(_)·하이픈(-)만 쓸 수 있습니다. | admin |
| `admin.loginIdRequired` | 아이디를 입력해 주세요. | admin |
| `admin.nameRequired` | 이름을 입력해 주세요. | admin |
| `admin.nameTooLong` | 이름은 50자 이하로 입력해 주세요. | admin |
| `admin.neverLoggedIn` | 로그인 기록 없음 | admin |
| `admin.none` | 없음 | admin |
| `admin.notice.codeSortOrderChanged` | {code} 코드의 정렬 순서를 {sortOrder}(으)로 바꿨습니다. | admin.notice |
| `admin.notice.departmentCreated` | {name} 부서를 추가했습니다. | admin.notice |
| `admin.notice.departmentSaved` | {name} 부서를 저장했습니다. | admin.notice |
| `admin.notice.departmentStatusChanged` | {name} 부서를 {status} 상태로 바꿨습니다. | admin.notice |
| `admin.notice.userRoleChanged` | {name} 사용자의 역할을 {role}(으)로 바꿨습니다. 대상 사용자는 다시 로그인해야 합니다. | admin.notice |
| `admin.notice.userSaved` | {name} 사용자 정보를 저장했습니다. | admin.notice |
| `admin.notice.userStatusChanged` | {name} 계정을 {status} 상태로 바꿨습니다. | admin.notice |
| `admin.ownAccountLocked` | 본인 계정의 역할과 상태는 바꿀 수 없습니다. | admin |
| `admin.resetFilters` | 필터 초기화 | admin |
| `admin.retry` | 다시 시도 | admin |
| `admin.roleChangeConfirmBody` | 역할을 바꾸면 대상 사용자의 모든 세션이 즉시 종료되어 다시 로그인해야 합니다. | admin |
| `admin.roleChangeConfirmTitle` | 시스템 역할 변경 | admin |
| `admin.save` | 저장 | admin |
| `admin.saving` | 저장 중 | admin |
| `admin.searchPlaceholder` | 아이디 또는 이름 검색 | admin |
| `admin.self` | 나 | admin |
| `admin.serverAppliedNote` | 변경 사항은 서버에 바로 반영되고 감사 로그에 기록됩니다. | admin |
| `admin.showInactive` | 비활성 부서 보기 | admin |
| `admin.topLevel` | 최상위 | admin |
| `admin.usersDescription` | 계정·부서·직무·시스템 역할을 관리합니다. 사용자는 삭제하지 않고 비활성화합니다. | admin |
| `admin.usersTitle` | 사용자 | admin |
| `auth.accountDisabled` | 비활성화된 계정입니다. 시스템 관리자에게 문의해 주세요. | auth |
| `auth.accountLocked` | 비밀번호를 5회 연속 잘못 입력해 계정이 잠겼습니다. 시스템 관리자에게 비밀번호 초기화를 요청해 주세요. | auth |
| `auth.accountNotFound` | 계정 정보를 찾을 수 없습니다. 시스템 관리자에게 문의해 주세요. | auth |
| `auth.checkingSession` | 로그인 상태를 확인하는 중입니다 | auth |
| `auth.currentPasswordMismatch` | 현재 비밀번호가 일치하지 않습니다. | auth |
| `auth.forcedChangeDescription` | 임시 비밀번호로 로그인했습니다. 비밀번호를 변경해야 다른 기능을 사용할 수 있습니다. | auth |
| `auth.forcedChangeTitle` | 비밀번호 변경 필요 | auth |
| `auth.goToLogin` | 로그인 화면으로 | auth |
| `auth.invalidCredentials` | 아이디 또는 비밀번호가 올바르지 않습니다. | auth |
| `auth.loginIdRequired` | 아이디를 입력해 주세요. | auth |
| `auth.loginIdTooLong` | 아이디는 50자 이하로 입력해 주세요. | auth |
| `auth.network` | 서버에 연결하지 못했습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요. | auth |
| `auth.newPasswordInvalid` | 새 비밀번호가 비밀번호 규칙에 맞지 않습니다. | auth |
| `auth.passwordChangedNote` | 보안을 위해 모든 기기에서 로그아웃되었습니다. 새 비밀번호로 다시 로그인해 주세요. | auth |
| `auth.passwordChangedTitle` | 비밀번호가 변경되었습니다. | auth |
| `auth.passwordRequired` | 비밀번호를 입력해 주세요. | auth |
| `auth.passwordTooLong` | 비밀번호는 128자 이하로 입력해 주세요. | auth |
| `auth.resetDemoOnly` | 데모 모드에서는 실제 비밀번호를 변경하지 않습니다. | auth |
| `auth.resetForbidden` | 시스템 관리자만 비밀번호를 초기화할 수 있습니다. | auth |
| `auth.resetUserIdInvalid` | 서버 사용자 ID는 1 이상의 숫자로 입력해 주세요. | auth |
| `auth.resetUserNotFound` | 대상 사용자를 찾을 수 없습니다. 서버 사용자 ID를 확인해 주세요. | auth |
| `auth.retry` | 다시 시도 | auth |
| `auth.sameAsCurrent` | 현재 비밀번호와 다른 비밀번호를 입력해 주세요. | auth |
| `auth.serviceUnavailable` | 로그인 서버에 일시적인 문제가 있습니다. 잠시 후 다시 시도해 주세요. | auth |
| `auth.timeout` | 서버 응답이 늦어 요청을 중단했습니다. 다시 시도해 주세요. | auth |
| `auth.unknown` | 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요. | auth |
| `auth.unreachableBody` | 로그인 상태를 확인할 수 없습니다. 네트워크와 서버 상태를 확인한 뒤 다시 시도해 주세요. | auth |
| `auth.unreachableTitle` | 서버에 연결하지 못했습니다 | auth |
| `button.acknowledged` | 확인했습니다 | button |
| `button.activate` | 활성화 | button |
| `button.add` | 추가 | button |
| `button.addComment` | 코멘트 등록 | button |
| `button.addItem` | 항목 추가 | button |
| `button.addPersonalSchedule` | 개인 일정 추가 | button |
| `button.addSubtask` | 하위작업 추가 | button |
| `button.addTask` | 업무 추가 | button |
| `button.addTerm` | 용어 등록 | button |
| `button.addTodo` | 할 일 추가 | button |
| `button.addUser` | 사용자 추가 | button |
| `button.addWork` | 작업 추가 | button |
| `button.advanceStage` | 다음 단계로 전환 | button |
| `button.aiOrganize` | AI 정리 | button |
| `button.aiSummary` | AI 요약 | button |
| `button.allowMove` | 이동 허용 | button |
| `button.applyAll` | 전체 적용 | button |
| `button.applyDraft` | 초안 반영 | button |
| `button.approve` | 승인 | button |
| `button.approverLaterHint` | 생성 후 멤버·설정에서 단계별로 지정할 수 있습니다. | button |
| `button.approveSelectedAddWbs` | 선택 항목 승인 · WBS 등록 | button |
| `button.approveSelectedCreateTasks` | 선택 항목 승인 · 업무 생성 | button |
| `button.approveWithEdit` | 수정 후 승인 | button |
| `button.calendarHelp` | 캘린더 사용 방법 | button |
| `button.cancel` | 취소 | button |
| `button.cancelInvite` | 초대 해제 | button |
| `button.categoryNotice` | 공지 | button |
| `button.categoryShare` | 자료 공유 | button |
| `button.change` | 변경 | button |
| `button.changePassword` | 비밀번호 변경 | button |
| `button.changing` | 변경 중 | button |
| `button.chatHistory` | 대화 기록 | button |
| `button.clearAll` | 전체 해제 | button |
| `button.clearDraft` | 초안 비우기 | button |
| `button.clearFilter` | 필터 해제 | button |
| `button.close` | 닫기 | button |
| `button.closeChatHistory` | 대화 기록 닫기 | button |
| `button.closeMenu` | 메뉴 닫기 | button |
| `button.closeNotice` | 안내 닫기 | button |
| `button.closeNotifications` | 알림 닫기 | button |
| `button.closeSummary` | 요약 닫기 | button |
| `button.closeTaskDetail` | 업무 상세 닫기 | button |
| `button.closeUserMenu` | 사용자 메뉴 닫기 | button |
| `button.collapse` | 접기 | button |
| `button.collapseAll` | 전체 접기 | button |
| `button.collapseChatHistory` | 대화 기록 접기 | button |
| `button.collapseMenu` | 메뉴 접기 | button |
| `button.collapseStage` | 단계 접기 | button |
| `button.collapseSubtasks` | 하위작업 접기 | button |
| `button.completeLinkedTask` | 연결 업무 완료 처리 | button |
| `button.copied` | 복사됨 | button |
| `button.copiedDone` | 복사되었습니다 | button |
| `button.copy` | 복사 | button |
| `button.copyProjectCode` | 식별 코드 복사 | button |
| `button.createIssue` | 이슈 등록 | button |
| `button.createProject` | 프로젝트 생성 | button |
| `button.deactivate` | 비활성화 | button |
| `button.delegatePm` | PM 위임 | button |
| `button.delete` | 삭제 | button |
| `button.deleteSchedule` | 일정 삭제 | button |
| `button.deleteTask` | 업무 삭제 | button |
| `button.draft` | 작성중 | button |
| `button.edit` | 수정 | button |
| `button.executeDelegation` | 위임 실행 | button |
| `button.expand` | 펼치기 | button |
| `button.expandAll` | 전체 펼치기 | button |
| `button.expandChatHistory` | 대화 기록 펼치기 | button |
| `button.expandMenu` | 메뉴 펼치기 | button |
| `button.filterAll` | 전체 | button |
| `button.generateDraft` | 초안 생성 | button |
| `button.generateWeeklyReportDraft` | AI 주간 리포트 초안 생성 | button |
| `button.goBack` | 뒤로 가기 | button |
| `button.help` | 도움말 | button |
| `button.hide` | 숨기기 | button |
| `button.hidePassword` | 비밀번호 숨기기 | button |
| `button.hintActivateParentFirst` | 상위 부서를 먼저 활성화해야 합니다. | button |
| `button.hintAddScheduleAtTime` | 클릭하면 이 시간에 일정을 추가합니다 | button |
| `button.hintAddScheduleOnDate` | 클릭하면 이 날짜로 일정을 추가합니다 | button |
| `button.hintAllowToolbarMove` | 툴바 이동을 허용합니다 | button |
| `button.hintCalendarMonth` | 날짜 칸을 클릭하면 그 날짜로 일정이 열립니다. 날짜 숫자를 누르면 일간 보기로 이동합니다. | button |
| `button.hintCalendarTime` | 빈 시간대를 클릭하면 그 날짜·시간으로 일정이 열립니다. 등록된 일정을 누르면 수정할 수 있습니다. | button |
| `button.hintChildDepartmentBlocked` | 비활성 부서에는 하위 부서를 만들 수 없습니다. | button |
| `button.hintClickToChangeStatus` | 클릭하면 상태가 변경됩니다 | button |
| `button.hintCreateProjectUserOnly` | 프로젝트는 일반 사용자만 만들 수 있습니다 | button |
| `button.hintGoBack` | 이전 화면으로 | button |
| `button.hintPinToolbar` | 툴바를 상단에 다시 고정합니다 | button |
| `button.hintResetToolbar` | 툴바 위치를 기본 위치로 되돌립니다 | button |
| `button.hintSetWipLimit` | 컬럼별 WIP 한도 설정 | button |
| `button.hintWipPmOnly` | PM만 WIP 한도를 설정할 수 있습니다 | button |
| `button.history` | 이력 | button |
| `button.indent` | 하위작업으로 들여쓰기 | button |
| `button.inUse` | 사용 중 | button |
| `button.invite` | 초대 | button |
| `button.keepWriting` | 계속 작성 | button |
| `button.later` | 나중에 | button |
| `button.leave` | 나가기 | button |
| `button.logout` | 로그아웃 | button |
| `button.markAllRead` | 모두 읽음 | button |
| `button.markDone` | 완료 처리 | button |
| `button.meetingList` | 회의 목록 | button |
| `button.moveDown` | 아래로 이동 | button |
| `button.moveUp` | 위로 이동 | button |
| `button.newChat` | 새 대화 | button |
| `button.nextPeriod` | 다음 기간 | button |
| `button.nextStep` | 다음 단계 | button |
| `button.no` | 아니요 | button |
| `button.noApprover` | 승인자 미지정 | button |
| `button.noCreatePermission` | 생성 권한 없음 | button |
| `button.notifications` | 알림 | button |
| `button.openChatHistory` | 대화 기록 열기 | button |
| `button.openDayView` | 이 날짜의 일간 보기 | button |
| `button.openIssues` | 이슈·결함 화면 | button |
| `button.openMenu` | 메뉴 열기 | button |
| `button.openSourceJournal` | 원본 일지로 이동 | button |
| `button.outdent` | 상위 레벨로 내어쓰기 | button |
| `button.periodDay` | 일 | button |
| `button.periodWeek` | 주 | button |
| `button.pinTop` | 상단 고정 | button |
| `button.previous` | 이전 | button |
| `button.previousPeriod` | 이전 기간 | button |
| `button.register` | 등록 | button |
| `button.reject` | 거절 | button |
| `button.release` | 해제 | button |
| `button.reopen` | 재오픈 | button |
| `button.required` | 필수 | button |
| `button.reset` | 초기화 | button |
| `button.resetDemoData` | 데모 데이터 초기화 | button |
| `button.resetFilters` | 필터 초기화 | button |
| `button.resetPassword` | 비밀번호 초기화 | button |
| `button.resetPosition` | 위치 초기화 | button |
| `button.resetting` | 초기화 중 | button |
| `button.retry` | 다시 시도 | button |
| `button.retryShort` | 재시도 | button |
| `button.returnForRevision` | 반려 | button |
| `button.revert` | 되돌리기 | button |
| `button.review` | 검수 | button |
| `button.save` | 저장 | button |
| `button.saveChanges` | 수정 저장 | button |
| `button.saveJournal` | 업무일지 저장 | button |
| `button.saveReview` | 검수 저장 | button |
| `button.saveSchedule` | 일정 저장 | button |
| `button.saveSettings` | 설정 저장 | button |
| `button.saveToKb` | KB로 저장 | button |
| `button.selectAll` | 전체 선택 | button |
| `button.sendQuestion` | 질문 전송 | button |
| `button.setPredecessors` | 선행작업 설정 | button |
| `button.setWipLimit` | WIP 한도 설정 | button |
| `button.show` | 표시 | button |
| `button.showPassword` | 비밀번호 표시 | button |
| `button.signIn` | 로그인 | button |
| `button.signingIn` | 로그인 중 | button |
| `button.signingOut` | 로그아웃 중 | button |
| `button.submit` | 제출 | button |
| `button.submitNewVersion` | 새 버전 제출 | button |
| `button.switch` | 전환 | button |
| `button.switchDemoAccount` | 데모 계정 전환 | button |
| `button.taskDetail` | 업무 상세 | button |
| `button.thisDay` | 이번 날 | button |
| `button.thisWeek` | 이번 주 | button |
| `button.today` | 오늘 | button |
| `button.undoDone` | 완료 취소 | button |
| `button.unlockDemoAccount` | 데모 계정 잠금 해제 | button |
| `button.unmarkApproval` | 승인 표시 해제 | button |
| `button.unpin` | 고정 해제 | button |
| `button.viewNotifications` | 알림 보기 | button |
| `button.work` | 작업 | button |
| `button.writeDoc` | 문서 작성 | button |
| `button.writeJournal` | 업무일지 작성 | button |
| `button.writePost` | 글쓰기 | button |
| `button.yes` | 네 | button |
| `i18n.language.changeFailed` | 언어를 바꾸지 못했습니다. 잠시 후 다시 시도해 주세요. | i18n.language |
| `i18n.language.changing` | 언어를 바꾸는 중 | i18n.language |
| `i18n.language.label` | 표시 언어 | i18n.language |
| `i18n.language.savedButNotApplied` | 언어 설정은 저장했지만 문구를 불러오지 못했습니다. 새로고침하면 적용됩니다. | i18n.language |
| `menu.admin` | 시스템 관리 | menu |
| `menu.admin.adminOnly` | 시스템 관리자 | menu.admin |
| `menu.admin.audit` | 보안 · 접속 로그 | menu.admin |
| `menu.admin.codes` | 공통 코드 | menu.admin |
| `menu.admin.departments` | 부서 | menu.admin |
| `menu.admin.errorLogs` | 에러 로그 | menu.admin |
| `menu.admin.hintAudit` | 읽기 전용 감사 로그 | menu.admin |
| `menu.admin.hintCodes` | 정렬 순서 | menu.admin |
| `menu.admin.hintDemoData` | 데모 데이터 | menu.admin |
| `menu.admin.hintDepartments` | 조직 트리 | menu.admin |
| `menu.admin.hintErrorLogs` | 미처리 예외 조회 | menu.admin |
| `menu.admin.hintLabels` | 문구·번역 | menu.admin |
| `menu.admin.hintRisk` | 임계값·가중치·이력 | menu.admin |
| `menu.admin.hintUsers` | 계정·부서·역할 | menu.admin |
| `menu.admin.labels` | 다국어 라벨 | menu.admin |
| `menu.admin.nav` | 시스템 관리 | menu.admin |
| `menu.admin.risk` | AI · 리스크 설정 | menu.admin |
| `menu.admin.users` | 사용자 | menu.admin |
| `menu.admin.usersAndOrg` | 사용자 · 조직 | menu.admin |
| `menu.demoEnvironment` | 데모 환경 | menu |
| `menu.demoSettings` | 데모 설정 | menu |
| `menu.hintResizeMenu` | 드래그해서 메뉴 폭 조절 | menu |
| `menu.home` | CoreviaAI 홈 | menu |
| `menu.knowledge` | 지식 허브 | menu |
| `menu.knowledge.docs` | 지식 문서 | menu.knowledge |
| `menu.knowledge.glossary` | 용어집 | menu.knowledge |
| `menu.knowledge.qa` | AI 질문 | menu.knowledge |
| `menu.knowledge.views` | 지식 허브 보기 | menu.knowledge |
| `menu.mainNav` | 주요 메뉴 | menu |
| `menu.missing.all` | 전체 | menu.missing |
| `menu.missing.meeting` | 회의 액션 미등록 | menu.missing |
| `menu.missing.overdue` | 마감 경과 | menu.missing |
| `menu.missing.stale` | 진척 기록 없음 | menu.missing |
| `menu.missing.unassigned` | 담당자·기한 미지정 | menu.missing |
| `menu.myWork` | 내 업무 | menu |
| `menu.mywork.approval` | 승인 요청 | menu.mywork |
| `menu.mywork.calendar` | 캘린더 | menu.mywork |
| `menu.mywork.journal` | 업무일지 | menu.mywork |
| `menu.mywork.todo` | TODO | menu.mywork |
| `menu.mywork.views` | 내 업무 보기 | menu.mywork |
| `menu.portfolio` | 전체 현황 | menu |
| `menu.project.board` | 게시판 | menu.project |
| `menu.project.collab` | 협업 문서 | menu.project |
| `menu.project.deliverables` | 산출물·검수 | menu.project |
| `menu.project.gantt` | 간트 | menu.project |
| `menu.project.issues` | 이슈·결함 | menu.project |
| `menu.project.kanban` | 칸반 | menu.project |
| `menu.project.meeting` | 회의록 | menu.project |
| `menu.project.missing` | 누락 의심 업무 | menu.project |
| `menu.project.nav` | 프로젝트 메뉴 | menu.project |
| `menu.project.overview` | 개요 | menu.project |
| `menu.project.report` | 주간 리포트 | menu.project |
| `menu.project.risk` | AI 리스크 | menu.project |
| `menu.project.settings` | 멤버·설정 | menu.project |
| `menu.project.wbs` | WBS | menu.project |
| `menu.project.wbsDraft` | AI WBS 초안 | menu.project |
| `menu.project.workPlan` | 업무 계획 | menu.project |
| `menu.project.workPlanViews` | 업무 보기 전환 | menu.project |
| `menu.projectCreate` | 프로젝트 생성 | menu |
| `menu.projects` | 프로젝트 | menu |
| `menu.resizeMenu` | 메뉴 폭 조절 | menu |
| `menu.view.day` | 일 | menu.view |
| `menu.view.month` | 월 | menu.view |
| `menu.view.week` | 주 | menu.view |
| `notification.demoFooter` | 데모 알림 · 예약 실행·실시간 발송 미연결 | notification |
| `notification.empty` | 알림이 없습니다. | notification |
| `notification.emptyHint` | 업무 배정·검수 요청이 생기면 이곳에 표시됩니다. | notification |
| `notification.evidence` | 근거 · {text} | notification |
| `notification.loadFailed` | 알림을 불러오지 못했습니다. | notification |
| `notification.loading` | 알림을 불러오는 중입니다. | notification |
| `notification.meetingSavedToKb` | 회의록을 지식 허브에 저장했습니다. 원본 링크가 유지됩니다. | notification |
| `notification.offline` | 네트워크 연결이 끊겼습니다. 일시적인 통신 오류는 로그아웃 사유가 아니며, 연결이 복구되면 자동으로 다시 확인합니다. | notification |
| `notification.title` | 알림 | notification |
| `notification.type.assign` | 배정 | notification.type |
| `notification.type.deliverable` | 검수 | notification.type |
| `notification.type.due` | 마감 | notification.type |
| `notification.type.mention` | 멘션 | notification.type |
| `notification.type.missing` | 누락 | notification.type |
| `notification.type.risk` | 리스크 | notification.type |
| `notification.type.status` | 상태 | notification.type |
| `notification.typeSuffix` | {type} 알림 | notification |
| `notification.unreadCount` | 읽지 않음 {count}건 | notification |
| `notification.unreadNotice` | 확인하지 않은 알림 {count}건이 있습니다 | notification |
| `project.create.actorsHint` | PM은 필수 액터라 해제할 수 없습니다. | project.create |
| `project.create.actorsRequired` | PM 액터는 반드시 포함되어야 합니다. | project.create |
| `project.create.actorsSection` | 액터 | project.create |
| `project.create.approverSection` | 게이트 승인자 (선택) | project.create |
| `project.create.basicSection` | 기본 정보 | project.create |
| `project.create.blockedTitle` | 다음 필수 항목을 선택할 수 없어 만들 수 없습니다 | project.create |
| `project.create.cancel` | 취소 | project.create |
| `project.create.checkCode` | 중복 확인 | project.create |
| `project.create.checkingCode` | 확인 중 | project.create |
| `project.create.code` | 프로젝트 코드 | project.create |
| `project.create.codeAvailable` | {code}는 사용할 수 있습니다. 최종 판정은 만들 때 한 번 더 합니다. | project.create |
| `project.create.codeFormat` | 프로젝트 코드는 영문·숫자로 시작하는 영문·숫자·하이픈(-) 2~20자로 입력해 주세요. | project.create |
| `project.create.codeHint` | 영문·숫자로 시작하는 영문·숫자·하이픈 2~20자. 대문자로 저장됩니다. | project.create |
| `project.create.codeRequired` | 프로젝트 코드를 입력해 주세요. | project.create |
| `project.create.codeTaken` | {code}는 이미 사용 중입니다. | project.create |
| `project.create.codeTakenGeneric` | 이미 사용 중인 프로젝트 코드입니다. | project.create |
| `project.create.created` | {name} 프로젝트를 만들었습니다. | project.create |
| `project.create.departmentsSection` | 주관 부서 (선택) | project.create |
| `project.create.description` | 입력한 내용으로 서버에 프로젝트를 만듭니다. 만든 사람이 첫 PM이 됩니다. | project.create |
| `project.create.endDate` | 종료일 (선택) | project.create |
| `project.create.featuresHint` | 선택한 운영 방식에서 쓸 수 있는 기능만 고를 수 있습니다. | project.create |
| `project.create.featuresSection` | 기능 구성 | project.create |
| `project.create.forbidden` | 이 계정은 프로젝트를 만들 수 없습니다. 활성 일반 사용자만 만들 수 있습니다. | project.create |
| `project.create.loadingOptions` | 생성 선택지를 불러오는 중입니다 | project.create |
| `project.create.membersSection` | 멤버 초대 (선택) | project.create |
| `project.create.methodology` | 운영 방식 | project.create |
| `project.create.name` | 프로젝트명 | project.create |
| `project.create.namePlaceholder` | 예) 사내 업무포털 고도화 | project.create |
| `project.create.nameRequired` | 프로젝트명을 입력해 주세요. | project.create |
| `project.create.nameTooLong` | 프로젝트명은 100자 이하로 입력해 주세요. | project.create |
| `project.create.noDepartmentType` | 부서 유형 — SW 부서 유형이 활성 상태가 아닙니다. | project.create |
| `project.create.noMethodology` | 운영 방식 — 고를 수 있는(활성) 운영 방식이 없습니다. | project.create |
| `project.create.noPmActor` | 액터 — 필수 PM 액터를 고를 수 없습니다. | project.create |
| `project.create.noTemplate` | 템플릿 — 서버가 고를 수 있는 템플릿을 주지 않았습니다. | project.create |
| `project.create.omittedNote` | 선택 항목이라 비운 채로 만들 수 있습니다. | project.create |
| `project.create.openCreated` | 프로젝트 열기 | project.create |
| `project.create.optionsFailed` | 생성 선택지(템플릿·운영 방식·액터·기능)를 불러오지 못했습니다. 필수 항목이라 이 정보 없이는 만들 수 없습니다. | project.create |
| `project.create.periodHint` | 기간은 비워 두고 만든 뒤 입력할 수 있습니다. | project.create |
| `project.create.periodInvalid` | 시작일은 종료일보다 늦을 수 없습니다. | project.create |
| `project.create.pmSection` | PM | project.create |
| `project.create.pmSelf` | {name} (나) — 만든 사람이 첫 PM이 됩니다. | project.create |
| `project.create.startDate` | 시작일 (선택) | project.create |
| `project.create.structureSection` | 템플릿·운영 방식 | project.create |
| `project.create.submit` | 프로젝트 만들기 | project.create |
| `project.create.submitting` | 만드는 중 | project.create |
| `project.create.template` | 템플릿 | project.create |
| `project.create.title` | 새 프로젝트 | project.create |
| `project.create.visibility` | 공개 범위 | project.create |
| `project.directory.approverUnavailable` | 게이트 승인자는 초대한 멤버 중에서 고르므로, 멤버 초대를 할 수 없는 지금은 지정할 수 없습니다. | project.directory |
| `project.directory.departmentsUnavailable` | 주관 부서를 고를 수 있는 부서 조회 API가 아직 없어 부서 없이 만듭니다. 서버에 일반 사용자용 부서 목록 API가 생기면 선택할 수 있습니다. | project.directory |
| `project.directory.usersUnavailable` | 초대할 사용자를 찾는 사용자 검색 API가 아직 없어 멤버 초대를 할 수 없습니다. 서버에 일반 사용자용 사용자 검색 API가 생기면 초대할 수 있습니다. | project.directory |
| `project.feature.board` | 게시판 | project.feature |
| `project.feature.deliverable` | 산출물·게이트 | project.feature |
| `project.feature.file` | 파일 | project.feature |
| `project.feature.git` | Git 연동 | project.feature |
| `project.feature.issue` | 이슈 | project.feature |
| `project.feature.kanban` | 칸반 | project.feature |
| `project.feature.meeting` | 회의록 | project.feature |
| `project.feature.wbs` | WBS·간트 | project.feature |
| `project.settings.approverNotConnected` | 게이트 승인자 변경은 서버 API가 아직 없어 이 화면에서 바꿀 수 없습니다(FR-PRJ-05). | project.settings |
| `project.settings.inviteDisabled` | 초대 기능 사용 불가 | project.settings |
| `project.settings.inviteTitle` | 멤버 초대 | project.settings |
| `project.settings.pmChangeNotConnected` | 서버 프로젝트의 PM 추가·해제는 멤버 역할 변경으로 합니다. 이 화면은 아직 서버와 연결되지 않아 바꿀 수 없습니다(이전 위임 API는 서버에서 없어졌습니다). | project.settings |
| `project.settings.pmOnlyInvite` | 멤버 초대는 프로젝트 PM만 할 수 있습니다. | project.settings |
| `project.settings.serverMembers` | 서버 멤버 목록 기준 | project.settings |
| `project.template.empty` | 빈 템플릿 | project.template |
| `project.template.itProject` | IT 프로젝트 템플릿 | project.template |
| `status.activityIssue.open` | 접수 | status.activityIssue |
| `status.activityIssue.progress` | 처리중 | status.activityIssue |
| `status.activityIssue.resolved` | 해결 | status.activityIssue |
| `status.auditType.ai` | AI 요청 | status.auditType |
| `status.auditType.approval` | 승인 | status.auditType |
| `status.auditType.download` | 다운로드 | status.auditType |
| `status.auditType.login_fail` | 로그인 실패 | status.auditType |
| `status.auditType.login_success` | 로그인 성공 | status.auditType |
| `status.auditType.permission` | 권한·설정 변경 | status.auditType |
| `status.deliverable.approved` | 승인 | status.deliverable |
| `status.deliverable.pending` | 미제출 | status.deliverable |
| `status.deliverable.rejected` | 반려 | status.deliverable |
| `status.deliverable.submitted` | 검수 대기 | status.deliverable |
| `status.health.done` | 완료 | 상태 · 리스크 수준 |
| `status.issue.closed` | 종결 | status.issue |
| `status.issue.confirmed` | 확인 | status.issue |
| `status.issue.fixing` | 조치 | status.issue |
| `status.issue.registered` | 등록 | status.issue |
| `status.issue.verifying` | 검증 | status.issue |
| `status.issueKind.defect` | 결함 | status.issueKind |
| `status.issueKind.issue` | 일반 이슈 | status.issueKind |
| `status.issueKind.request` | 요청 | status.issueKind |
| `status.issueSeverity.critical` | 치명 | status.issueSeverity |
| `status.issueSeverity.high` | 높음 | status.issueSeverity |
| `status.issueSeverity.low` | 낮음 | status.issueSeverity |
| `status.issueSeverity.medium` | 보통 | status.issueSeverity |
| `status.methodology.agile` | 애자일 | status.methodology |
| `status.methodology.none` | 단계 없음 | status.methodology |
| `status.methodology.waterfall` | 폭포수 | status.methodology |
| `status.priority.high` | 높음 | status.priority |
| `status.priority.low` | 낮음 | status.priority |
| `status.priority.normal` | 보통 | status.priority |
| `status.projectFocus.all` | 전체 프로젝트 | status.projectFocus |
| `status.projectFocus.done` | 완료 | status.projectFocus |
| `status.projectFocus.late` | 지연 | status.projectFocus |
| `status.projectFocus.ongoing` | 진행 중 | status.projectFocus |
| `status.projectRole.biz` | 현업 담당자 | status.projectRole |
| `status.projectRole.dev` | 개발자 | status.projectRole |
| `status.projectRole.pm` | PM | status.projectRole |
| `status.projectRole.qa` | QA | status.projectRole |
| `status.projectSort.endDate` | 종료일 임박 순 | status.projectSort |
| `status.projectSort.name` | 프로젝트명 순 | status.projectSort |
| `status.projectSort.progressAsc` | 진척률 낮은 순 | status.projectSort |
| `status.projectSort.progressDesc` | 진척률 높은 순 | status.projectSort |
| `status.projectSort.risk` | 리스크 높은 순 | status.projectSort |
| `status.record.active` | 활성 | status.record |
| `status.record.inactive` | 비활성 | status.record |
| `status.stage.analysis` | 분석 | status.stage |
| `status.stage.deploy` | 이행 | status.stage |
| `status.stage.design` | 설계 | status.stage |
| `status.stage.dev` | 개발 | status.stage |
| `status.stage.test` | 테스트 | status.stage |
| `status.systemRole.admin` | 시스템 관리자 | status.systemRole |
| `status.systemRole.exec` | 경영진 | status.systemRole |
| `status.systemRole.user` | 일반 사용자 | status.systemRole |
| `status.taskFilter.all` | 전체 | status.taskFilter |
| `status.taskFilter.done` | 완료 | status.taskFilter |
| `status.taskFilter.late` | 지연 | status.taskFilter |
| `status.taskFilter.open` | 진행 중 | status.taskFilter |
| `status.taskFilter.soon` | 마감 임박 | status.taskFilter |
| `status.taskFilter.today` | 오늘 | status.taskFilter |
| `status.taskFilterHint.all` | 완료 포함 전체 업무 | status.taskFilterHint |
| `status.taskFilterHint.done` | 완료 처리한 업무 | status.taskFilterHint |
| `status.taskFilterHint.late` | 마감일이 지난 미완료 업무 | status.taskFilterHint |
| `status.taskFilterHint.open` | 완료되지 않은 업무 | status.taskFilterHint |
| `status.taskFilterHint.soon` | 3일 이내 마감 예정 | status.taskFilterHint |
| `status.taskFilterHint.today` | 오늘 마감인 미완료 업무 | status.taskFilterHint |
| `status.visibility.company` | 전사 공개 | status.visibility |
| `status.visibility.department` | 부서 공개 | status.visibility |
| `status.visibility.members` | 멤버 전용 | status.visibility |

## BE에 이미 시드됨 (7개, V9 공통 코드 라벨)

FE가 공통 코드와 같은 값을 표시할 때 이 키를 그대로 씁니다. 등록할 필요가 없습니다.

| 라벨 키 | 한국어 기본 문구 | 구분 |
| --- | --- | --- |
| `code.RISK_LEVEL.CAUTION` | 주의 | 상태 · 리스크 수준 |
| `code.RISK_LEVEL.DANGER` | 위험 | 상태 · 리스크 수준 |
| `code.RISK_LEVEL.NORMAL` | 정상 | 상태 · 리스크 수준 |
| `code.TASK_STATUS.DONE` | 완료 | 상태 · 업무 |
| `code.TASK_STATUS.IN_PROGRESS` | 진행 | 상태 · 업무 |
| `code.TASK_STATUS.REVIEW` | 검토 | 상태 · 업무 |
| `code.TASK_STATUS.TODO` | 대기 | 상태 · 업무 |
