# CoreviaAI (기업용 AI 협업관리 웹앱 프로토타입)

## 1. Project Description
- 제품: 사내 IT·DX 조직을 위한 AI 협업관리 웹앱 프론트엔드 프로토타입
- 대상: PM, 개발자, QA, 현업 담당자 (데모 사용자: 김서연 / DX기획팀 PM)
- 핵심 가치: 개인 업무와 프로젝트 업무를 한 곳에서 연결하고, 업무 누락·일정 지연·병목·인력 편중을 조기에 파악
- 범위: 외부 서비스 연동 없이 가상 데이터로 동작. 인증/AI 분석/파일 서버는 실제 연동 아님을 명시
- 데모 변경 사항은 브라우저 저장소에 보관되어 새로고침 후에도 유지되며, 초기화 가능

## 2. Page Structure
- `/` 내 업무 (TODO / 캘린더 / 업무일지)
- `/projects` 프로젝트 목록
- `/projects/new` 프로젝트 생성 (4단계)
- `/projects/:projectId` 프로젝트 상세 — 개요
- `/projects/:projectId/wbs` 업무 계획 · WBS
- `/projects/:projectId/gantt` 업무 계획 · 간트
- `/projects/:projectId/kanban` 업무 계획 · 칸반
- `/projects/:projectId/issues` 이슈·결함 (준비 중)
- `/projects/:projectId/collab` 협업 문서 (준비 중)
- `/projects/:projectId/risk` AI 리스크 (준비 중)
- `/projects/:projectId/report` 주간 리포트 (준비 중)
- `/projects/:projectId/settings` 멤버·설정 (준비 중)
- `/knowledge` 지식 허브
- `/portfolio` 전체 현황 (PM·경영진 전용)
- `/admin` 시스템 관리 (시스템 관리자 전용, 준비 중)

## 3. Core Features
- [x] 공통 레이아웃 (접이식 사이드바 220px/64px, 상단 제목 1회 표시·알림·프로필, 하단 데모 환경 표시)
- [x] 내 업무 TODO (개인 할 일 / 배정 업무 분리, 오늘·마감임박·지연 필터)
- [x] 내 업무 캘린더 (월/주/일, 개인 일정 추가, 프로젝트 색상 구분)
- [x] 내 업무 업무일지 (진척 입력, 연결 업무 완료, 일/주 AI 요약 데모)
- [x] 프로젝트 목록 (검색·필터·정렬·리스크 등급)
- [x] 프로젝트 생성 4단계 (검증, 5단계 WBS 자동 생성)
- [x] 프로젝트 개요 (단계 표시기, 마일스톤, 지연·누락, 이슈 추이, 리스크)
- [x] WBS (3단계 계층, 롤업 계산, 선행작업 순환 차단, 마일스톤 D-day)
- [x] 간트 (조회 전용, 계획/진척, 오늘선, 마일스톤, 일/주/월, 드래그 이동·잠금 도구 모음)
- [x] 전체 현황 (전체/진행 중/지연/완료 지표, 지표→목록 필터, 진척률·마감·리스크 비교)
- [x] 칸반 (드래그 상태 변경, 필터, WIP 한도)
- [x] 공통 업무 상세 패널 (필드 편집, 코멘트·멘션, 변경 이력)
- [x] 준비 중 페이지, 빈·검색없음·로딩·오류·권한없음 상태 디자인

## 4. Data Model Design
프로토타입이므로 서버 DB는 사용하지 않음. 브라우저 저장소(localStorage) 기반 데모 스토어로 관리.

- User: id, name, dept, role(pm/biz/dev/qa), roleLabel, email
- Project: id, name, code, dept, pmId, method, stage, startDate, endDate, status, visibility, actors, members, milestones, notice, riskScore, kanbanWip, colorKey, gateApprovers(단계별 승인자)
- Task: id, projectId(null=개인), parentId, level(2 작업 / 3 하위작업), stage, name, type(task/defect), assigneeId(대표), assigneeIds(공동 담당 전체), startDate, endDate, estimate(인일), progress, status, priority, description, doneCondition, predecessors, order
- Deliverable: 단계별 산출물, gateApproverId(단계 승인자와 동기화), status(미제출/검수 대기/승인/반려)
- GateRecord: 단계 전환 판정 기록(승인/차단, 판정자)
- Journal: id, date, userId, content, taskId, progress, hours
- Schedule: id, userId, title, date, startTime, endTime, type, projectId
- Issue: id, projectId, title, kind, severity, status, assigneeId, createdAt
- Comment / HistoryEntry / Notification

## 5. Backend / Third-party Integration Plan
- Database: 연결하지 않음 — 가상 데이터 + 브라우저 저장소 (요청 범위)
- Shopify / Stripe / Supabase / 파일 서버 / AI API: 연결하지 않음
- AI 요약은 실제 모델 호출이 아니라 규칙 기반 데모 결과임을 화면에 명시

### 인증 · 세션 · 뒤로가기 처리 구조 (구현 범위)
- 세션 만료: 공통 가드가 무활동 만료를 감지하면 안내를 1회만 표시하고 로그인 화면으로 이동. 재로그인 시 권한을 확인해 직전 화면으로 복귀
- 네트워크 오류: 오프라인 상태는 인증 만료와 구분하며 로그아웃 사유로 처리하지 않음(안내 배너만 표시)
- 비밀번호 변경: 입력 검증·표시/숨기기·중복 제출 방지만 구현. 실제 인증 API가 없어 성공으로 표시하지 않음
- 비밀번호 정책(길이·조합·변경 주기)은 서비스 정책 미확정으로 임의 적용하지 않음
- 뒤로가기: 실제 브라우저 방문 이력 기반. 내부 이력이 없으면 상위 목록으로 이동하고, 저장하지 않은 입력이 있을 때만 이탈 확인

### 사용성 개선 (구현 범위)
- 메뉴 명칭: 단일 목록 `내 업무 / 프로젝트 / 지식 허브 / 전체 현황`으로 통일. 라우트(`/portfolio`, `/knowledge`)와 PM·경영진 접근 권한은 유지
- 사이드바: 펼침 220px / 접힘 64px, 접힘 시 아이콘만 표시하고 호버·키보드 포커스에서 이름 안내. 접힘 상태는 사용자가 조절하며 본문 폭이 즉시 반영되고 선택 메뉴·화면 상태는 유지
- 단계 이동: 상단 단계 칩 클릭 시 `WBS?stage=…`로 이동해 해당 단계를 펼치고 고정 헤더에 가리지 않는 위치로 스크롤. 선택 단계 강조, 데이터 순서는 변경하지 않음
- 간트 도구 모음: 기본 상단 잠금, 잠금 해제 시 핸들로 이동(버튼 클릭과 드래그 충돌 없음). 위치·잠금 상태 저장, 화면 크기 변경 시 보정, 위치 초기화, 모바일 접이식

### 화면 정보 밀도 · 탭 기준 (구현 범위)
- 공통 탭(`src/components/ui/TabBar.tsx`): 밑줄형 탭 하나로 통일(내 업무, 지식 허브). 선택 탭만 진한 파란 글자 + 얇은 밑줄, 탭 줄 오른쪽에 화면 단위 액션 배치
- 내 업무: 핵심 요약(KPI) → 탭 → 목록 순서로 배치하고, 필터 의미·색상 기준·진척 반영 안내는 말줄임 없이 도움말 툴팁으로 이동
- 업무 목록 표시 정보: 업무명(우선순위·결함 배지 포함), 프로젝트, 담당자, 마감일, 상태, 진척률. 판단에 쓰이지 않는 설명 문구·필터 배너는 두지 않음
- 글자 크기를 줄이는 대신 열 수와 안내 문구를 줄여 여백을 확보

## 6. Development Phase Plan

### Phase 1: 디자인 시스템·공통 레이아웃·데모 데이터
- Goal: 토큰 기반 스타일, 사이드바/상단바, 공통 업무 상세 패널, 데모 스토어
- Deliverable: 전 화면에서 재사용되는 셸과 데이터 계층

### Phase 2: 내 업무 (TODO / 캘린더 / 업무일지)
- Goal: 개인 업무와 프로젝트 업무 연결, 일정·일지 입력
- Deliverable: 내 업무 3개 탭 동작

### Phase 3: 프로젝트 목록·생성
- Goal: 표 기반 목록, 4단계 생성 마법사와 검증, WBS 자동 생성
- Deliverable: 생성한 프로젝트가 목록/상세에 반영

### Phase 4: 프로젝트 상세 (개요 / WBS / 간트 / 칸반)
- Goal: 동일 업무 데이터 기반 4개 화면과 상호 반영
- Deliverable: 업무 편집·상태 변경이 모든 화면에 반영

### Phase 5: 미구현 메뉴·상태 디자인·마감 점검
- Goal: 준비 중 화면, 권한/빈/오류 상태, 반응형 점검
- Deliverable: 전체 메뉴 탐색 가능한 프로토타입

### 게이트 승인자 · 업무 담당자 분리 (확정 요구사항)
- 승인자는 직무(현업 담당자 등)로 자동 지정하지 않음. 프로젝트 생성 시 또는 생성 후 PM이 멤버 중에서 지정
- 생성 시 멤버·승인자 지정은 선택 사항. 미지정 상태로 생성 가능하며, 생성 시 승인자를 지정하면 모든 게이트에 동일 적용
- 생성 후에는 게이트(분석·설계·개발·테스트·이행)별로 서로 다른 승인자 지정 가능. 현재 PM은 승인자가 될 수 없음
- 게이트별 승인자·승인 상태(미지정/검수 대기/반려/전환 가능/승인 완료)를 `멤버·설정`과 `산출물·검수`에서 확인
- 산출물 제출 시 지정 승인자에게 알림 발송, `내 업무 · 승인 요청` 탭에서 별도 확인. 일반 업무 담당자 목록과 분리
- 승인자 미지정은 자동 승인으로 처리하지 않음. 검수·단계 전환 불가, PM에게 승인자 지정 안내 알림
- 승인자 지정·변경은 현재 PM만 가능하며, 시스템 관리자도 승인자를 임의 대체하지 않음