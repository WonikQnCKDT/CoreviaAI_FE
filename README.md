# CoreviaAI_FE

사내 구성원이 개인 업무와 프로젝트를 관리하는 CoreviaAI 프런트엔드. React 19, TypeScript, Vite, React Router, Tailwind CSS 사용.

## 폴더 구조

- [`src/app/`](src/app/) — 앱 시작점, 전체 라우팅, 프로젝트 모듈 조립
  - [`router/`](src/app/router/) — 로그인·프로젝트·관리자 화면의 라우트 선언
  - [`projectModules/`](src/app/projectModules/) — 내장 화면과 부서 모듈 등록, 프로젝트 메뉴·경로 해석, 공통 데이터 연결
- [`src/core/projectModules/`](src/core/projectModules/) — 부서 모듈이 사용하는 공통 계약과 등록 규칙. 중복 모듈 ID와 경로 검증
- `src/extensions/<모듈명>/` — 새 부서 기능을 추가할 위치. 예를 들어 품질 검토 기능은 `src/extensions/quality/`에 배치
- [`src/pages/`](src/pages/) — URL에 대응하는 화면. 프로젝트 개요와 멤버·설정 등 개별 화면 구성
- [`src/layouts/`](src/layouts/) — 사이드바·상단바를 포함한 공통 레이아웃과 로그인 상태에 따른 화면 진입 처리
- [`src/features/`](src/features/) — 인증, 프로젝트, 업무, 리스크, 알림 등 기능별 API·컴포넌트·훅·업무 규칙
- [`src/shared/api/`](src/shared/api/) — 공통 HTTP 요청, 오류·타임아웃·취소 처리, 인증 쿠키를 이용한 세션 갱신
- [`src/stores/`](src/stores/) · [`src/mocks/`](src/mocks/) — 기존 화면의 공유 상태와 데모 초기 데이터
- [`src/components/ui/`](src/components/ui/) · [`src/styles/tokens/`](src/styles/tokens/) — 공통 UI와 색상·크기·타이포그래피 토큰
- [`tests/unit/`](tests/unit/) · [`tests/integration/`](tests/integration/) — 등록 규칙·입력 검증, API 계약·모듈 라우팅·의존성 경계 테스트

## 프로젝트 화면의 데이터 흐름

- 프로젝트 상세 화면 진입 → 상세 정보 로드 → 부서 유형·운영 방식·액터로 적용 모듈 결정
- [`projectModules.ts`](src/app/projectModules/projectModules.ts)의 등록 결과 → 프로젝트 메뉴와 라우트에 공통 적용
- [`projectCore.ts`](src/app/projectModules/projectCore.ts)의 어댑터 → 현재 프로젝트의 데이터만 [`ProjectModuleProps`](src/core/projectModules/contracts.ts)로 전달
  - 업무 목록 — `core.work.list()`
  - 리스크 점수 — `core.risk.readScore()`
  - 알림 목록 — `core.notifications.list()`
- API 응답은 기능별 API에서 화면 모델로 변환. 접근 권한은 서버에서 검증
- 데모 모드에서는 어댑터가 데모 상태에서 현재 프로젝트의 데이터만 반환. API 프로젝트에 업무·리스크·알림 공급자가 연결되기 전에는 확장 모듈에 빈 목록과 `null` 점수를 전달

## 부서 모듈 추가 예시

1. `src/extensions/quality/` 아래에 품질 검토 화면과 `DepartmentProjectModule` 선언 작성
2. `supports`에서 제조 프로젝트 등 적용 조건을 지정하고, `pages`에 `quality/review`와 화면 컴포넌트 선언. 첫 페이지가 메뉴의 진입점
3. [`projectModules.ts`](src/app/projectModules/projectModules.ts)에 한 번 등록. 적용 대상 프로젝트의 메뉴와 `/projects/:projectId/quality/review` 경로에서 같은 화면 사용
4. 확장 화면은 공통 계약으로 데이터를 읽음. `src/extensions/`에서 `DemoStore`, 목업, 앱 내부 API를 직접 가져오는 import는 [ESLint](eslint.config.ts)가 차단

- 품질 검토는 등록 방식을 설명하기 위한 예시. 모듈 장착과 데이터 공급자 교체는 [통합 테스트](tests/integration/projectModules.test.mjs)로 검증
- 실제 QMS·MES 연동과 웹훅 수신은 서버 연동 범위. 설계 배경과 적용 범위는 [프로젝트 화면 확장 경계 ADR](docs/adr/0001-project-extension-boundary.md) 참고

## 로컬 실행 및 검증

- 개발 환경 — CI와 같은 Node.js 24 및 npm 사용. 의존성은 `package-lock.json` 기준으로 설치
- 설치·실행 — `npm ci` → `npm run dev` → 브라우저에서 개발 서버 접속. 기본 포트는 `3000`
- 데모 모드 — 기본값 `VITE_AUTH_MODE=demo`. 백엔드 없이 데모 데이터로 실행
- API 모드 — [`.env.example`](.env.example)을 로컬 `.env`로 복사하고 `VITE_AUTH_MODE=api` 설정. 개발 프록시 사용 시 `VITE_API_URL=/api` 유지 후 `VITE_API_PROXY_TARGET`에 테스트 백엔드 주소 지정
- 환경 설정 — 로컬 `.env`는 커밋 금지. 브라우저에 전달되는 `VITE_*`에 비밀번호나 토큰 저장 금지
- 검증 — `npm test`, `npm run type-check`, `npm run lint`, `npm run build`. 각 명령의 종료 코드 `0`이 성공
- 빌드 결과 — `dist/`. 로컬 미리 보기는 `npm run preview`. PR 검증 단계는 [DevelopCI](.github/workflows/DevelopCI.yml) 참고
