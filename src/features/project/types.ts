import type { RoleKey, Visibility } from "@/types";

export interface ProjectFormState {
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  pmId: string;
  dept: string;
  visibility: Visibility;
  actors: RoleKey[];
  members: { userId: string; role: RoleKey }[];
  /** 생성 시 모든 게이트에 적용할 승인자. 지정하지 않아도 생성할 수 있습니다. */
  gateApproverId: string | null;
}

export const TOTAL_STEPS = 5;

export const STEP_META: Record<number, { title: string; desc: string }> = {
  1: { title: "기본 정보", desc: "프로젝트 이름과 기간 등 기본 정보를 입력합니다." },
  2: { title: "운영 방식", desc: "프로젝트를 어떤 방식으로 수행할지 선택합니다." },
  3: { title: "액터 지정", desc: "프로젝트에 참여할 역할을 구성합니다." },
  4: { title: "멤버 초대", desc: "함께 협업할 멤버를 검색해 초대합니다." },
  5: { title: "게이트 승인자 지정", desc: "단계 전환을 승인할 멤버를 지정합니다. 지정하지 않아도 생성할 수 있습니다." },
};

export const DEPARTMENTS = ["DX기획팀", "DX개발팀", "DX품질팀", "인사팀", "품질경영팀", "설비기술팀", "재무팀"];

export const ACTOR_CARDS: { key: RoleKey; title: string; desc: string; required?: boolean }[] = [
  { key: "pm", title: "PM", desc: "일정·리스크·진척을 관리하는 필수 역할", required: true },
  { key: "biz", title: "현업 담당자", desc: "요구사항과 완료 조건을 확인하는 실무 담당" },
  { key: "dev", title: "개발자", desc: "설계·개발·이행을 수행하는 인력" },
  { key: "qa", title: "QA", desc: "테스트 시나리오와 결함을 관리하는 인력" },
];

export const VISIBILITY_CARDS: { key: Visibility; desc: string }[] = [
  { key: "company", desc: "전 직원이 프로젝트 개요를 볼 수 있습니다." },
  { key: "department", desc: "주관 부서와 참여 부서만 볼 수 있습니다." },
  { key: "members", desc: "초대된 멤버만 접근할 수 있습니다." },
];