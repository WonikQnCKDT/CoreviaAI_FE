import type { GlossaryEntry, KnowledgeDoc, KnowledgeQuestion } from "@/types";

export const knowledgeDocs: KnowledgeDoc[] = [
  {
    id: "kd1",
    title: "프로젝트 권한·공개 범위 정책 가이드",
    body:
      "프로젝트 공개 범위는 전사 공개, 부서 공개, 멤버 전용으로 구분합니다. 전사 공개는 모든 임직원이 조회할 수 있고, 부서 공개는 주관 부서와 협업 부서만 조회합니다. 멤버 전용은 프로젝트 멤버로 등록된 사용자만 접근할 수 있습니다.\n권한 변경은 PM이 요청하고 시스템 관리자가 승인합니다. 변경 이력은 최소 3년간 보관합니다. 멤버 전용 프로젝트의 경우 외부 협력사 계정은 초대할 수 없습니다.",
    tags: ["권한", "공개범위", "보안", "프로젝트"],
    dept: "DX기획팀",
    projectId: "p1",
    visibility: "company",
    authorId: "u1",
    createdAt: "2026-09-12",
    updatedAt: "2026-10-24",
    currentVersion: 3,
    versions: [
      { id: "kd1v1", version: 1, title: "권한 정책 초안", body: "전사 공개와 멤버 전용 2단계로 운영합니다.", editedBy: "u1", editedAt: "2026-09-12", note: "최초 작성" },
      { id: "kd1v2", version: 2, title: "프로젝트 권한·공개 범위 정책 가이드", body: "부서 공개 범위를 추가하고 협업 부서 개념을 정의했습니다.", editedBy: "u1", editedAt: "2026-10-02", note: "부서 공개 추가" },
      { id: "kd1v3", version: 3, title: "프로젝트 권한·공개 범위 정책 가이드", body: "보안팀 검토 의견을 반영해 변경 이력 보관 기간을 명시했습니다.", editedBy: "u1", editedAt: "2026-10-24", note: "보안팀 의견 반영" },
    ],
    sourceType: null,
    sourceId: null,
  },
  {
    id: "kd2",
    title: "통합검색 인덱스 설계 기준",
    body:
      "통합검색 인덱스는 업무, 문서, 프로젝트를 단일 색인으로 구성합니다. 형태소 분석기는 nori를 사용하고, 검색 필드는 제목·본문·태그·작성자로 구성합니다.\n권한 필터는 검색 질의 단계에서 적용해야 하며, 결과 후처리로 권한을 제거하면 누락이 발생할 수 있습니다. 응답 목표 시간은 300ms 이내입니다.",
    tags: ["검색", "인덱스", "API", "개발"],
    dept: "DX개발팀",
    projectId: "p1",
    visibility: "department",
    authorId: "u2",
    createdAt: "2026-10-20",
    updatedAt: "2026-11-05",
    currentVersion: 2,
    versions: [
      { id: "kd2v1", version: 1, title: "검색 인덱스 설계 메모", body: "nori 형태소 분석기와 색인 필드를 정의했습니다.", editedBy: "u2", editedAt: "2026-10-20", note: "최초 작성" },
      { id: "kd2v2", version: 2, title: "통합검색 인덱스 설계 기준", body: "권한 필터 적용 시점과 응답 목표 시간을 추가했습니다.", editedBy: "u2", editedAt: "2026-11-05", note: "권한 필터 기준 추가" },
    ],
    sourceType: null,
    sourceId: null,
  },
  {
    id: "kd3",
    title: "결함 재현 절차 작성 가이드",
    body:
      "결함을 등록할 때는 재현 절차를 번호 순서로 작성하고, 발생 환경(브라우저·OS·네트워크)을 함께 기록합니다. 재현율과 발생 빈도도 함께 남기면 조치 우선순위 판단에 도움이 됩니다.\n검증 단계에서는 재현 절차의 각 단계를 그대로 수행하고, 재현되지 않을 경우 사용한 데이터와 계정을 명시합니다.",
    tags: ["결함", "QA", "재현절차", "품질"],
    dept: "DX품질팀",
    projectId: null,
    visibility: "company",
    authorId: "u3",
    createdAt: "2026-08-18",
    updatedAt: "2026-09-30",
    currentVersion: 1,
    versions: [
      { id: "kd3v1", version: 1, title: "결함 재현 절차 작성 가이드", body: "재현 절차와 환경 기록 기준을 정리했습니다.", editedBy: "u3", editedAt: "2026-08-18", note: "최초 작성" },
    ],
    sourceType: null,
    sourceId: null,
  },
  {
    id: "kd4",
    title: "설비 점검 주기와 누락 알림 기준",
    body:
      "생산 설비는 일간 점검과 주간 정밀 점검으로 구분합니다. 일간 점검 누락 시 2시간 후 담당자에게 1차 알림, 24시간 후 설비기술팀장에게 2차 알림을 발송합니다.\n점검 이력은 최소 5년 보관하며, 이력 수정은 팀장 승인 후 가능합니다.",
    tags: ["설비", "점검", "알림", "현장"],
    dept: "설비기술팀",
    projectId: "p3",
    visibility: "members",
    authorId: "u10",
    createdAt: "2026-10-12",
    updatedAt: "2026-10-12",
    currentVersion: 1,
    versions: [
      { id: "kd4v1", version: 1, title: "설비 점검 주기와 누락 알림 기준", body: "점검 주기와 알림 정책을 정리했습니다.", editedBy: "u10", editedAt: "2026-10-12", note: "최초 작성" },
    ],
    sourceType: null,
    sourceId: null,
  },
  {
    id: "kd5",
    title: "품질 문서 개정 이력 관리 규칙",
    body:
      "품질 문서는 개정 시 버전을 0.1 단위로 올리고 개정 사유를 반드시 기록합니다. 승인되지 않은 개정본은 검색 결과에 노출하지 않습니다.\n권한별 문서 필터는 부서와 직급을 기준으로 적용하며, 필터 결과 누락 여부를 월 1회 점검합니다.",
    tags: ["품질문서", "개정", "권한", "검색"],
    dept: "품질경영팀",
    projectId: "p2",
    visibility: "department",
    authorId: "u7",
    createdAt: "2026-07-22",
    updatedAt: "2026-10-28",
    currentVersion: 2,
    versions: [
      { id: "kd5v1", version: 1, title: "품질 문서 개정 이력 관리 규칙", body: "개정 버전 표기 규칙을 정리했습니다.", editedBy: "u7", editedAt: "2026-07-22", note: "최초 작성" },
      { id: "kd5v2", version: 2, title: "품질 문서 개정 이력 관리 규칙", body: "승인되지 않은 개정본 노출 금지와 권한 필터 점검 주기를 추가했습니다.", editedBy: "u7", editedAt: "2026-10-28", note: "권한 필터 점검 추가" },
    ],
    sourceType: null,
    sourceId: null,
  },
  {
    id: "kd6",
    title: "[결함 종결] 와이어프레임-디자인 가이드 불일치 조치 노트",
    body:
      "디자인 가이드 v1.2 기준으로 버튼 간격과 타이포 규칙을 재적용했습니다. 화면 설계서 v2.0에 반영되었으며, 재검증 결과 불일치 항목이 없음을 확인했습니다.\n재발 방지를 위해 화면 설계 착수 전 디자인 가이드 버전을 회의록에 명시합니다.",
    tags: ["디자인", "결함", "가이드", "재발방지"],
    dept: "DX품질팀",
    projectId: "p1",
    visibility: "company",
    authorId: "u3",
    createdAt: "2026-10-24",
    updatedAt: "2026-10-24",
    currentVersion: 1,
    versions: [
      { id: "kd6v1", version: 1, title: "[결함 종결] 와이어프레임-디자인 가이드 불일치 조치 노트", body: "결함 조치 및 재검증 결과를 정리했습니다.", editedBy: "u3", editedAt: "2026-10-24", note: "결함 종결 시 저장" },
    ],
    sourceType: "issue",
    sourceId: "i7",
  },
];

export const glossary: GlossaryEntry[] = [
  {
    id: "gl1",
    term: "WBS",
    definition: "Work Breakdown Structure. 프로젝트 범위를 단계·작업·하위작업으로 분해한 업무 분류 체계입니다.",
    synonyms: ["작업분류체계", "업무분해구조"],
    relatedDocIds: ["kd2"],
    updatedBy: "u1",
    updatedAt: "2026-09-01",
    history: [],
  },
  {
    id: "gl2",
    term: "게이트 검수",
    definition: "단계 전환 전에 필수 산출물이 모두 승인되었는지 확인하는 공식 검수 절차입니다. 승인되지 않으면 다음 단계로 전환할 수 없습니다.",
    synonyms: ["단계 게이트", "Gate Review"],
    relatedDocIds: ["kd1"],
    updatedBy: "u3",
    updatedAt: "2026-09-15",
    history: [],
  },
  {
    id: "gl3",
    term: "인일",
    definition:
      "한 사람이 하루 동안 수행할 수 있는 작업량을 나타내는 공수 단위입니다. 1인일은 1명이 하루 동안 수행하는 작업량이며, 예를 들어 3인일은 1명 기준 3일 분량입니다. 여러 명이 나누어 수행하면 달력상 소요기간은 짧아질 수 있으므로 일정 기간과는 구분해서 봅니다. 화면에서는 '예상 작업량'으로 표시하며, 진척률 가중 계산에 사용합니다.",
    synonyms: ["Man-Day", "MD"],
    relatedDocIds: [],
    updatedBy: "u1",
    updatedAt: "2026-08-20",
    history: [],
  },
  {
    id: "gl4",
    term: "RBAC",
    definition: "Role-Based Access Control. 사용자의 역할을 기준으로 접근 권한을 부여하는 방식입니다.",
    synonyms: ["역할기반접근제어"],
    relatedDocIds: ["kd1", "kd5"],
    updatedBy: "u2",
    updatedAt: "2026-10-06",
    history: [],
  },
];

export const knowledgeQuestions: KnowledgeQuestion[] = [
  {
    id: "kq1",
    question: "멤버 전용 프로젝트는 외부 협력사도 초대할 수 있나요?",
    answer:
      "AI 초안입니다. 조회 가능한 문서 1건을 근거로 정리했습니다.\n\n프로젝트 권한·공개 범위 정책 가이드: 멤버 전용 프로젝트의 경우 외부 협력사 계정은 초대할 수 없습니다.",
    sourceDocIds: ["kd1"],
    askedBy: "u1",
    createdAt: "2026-11-07T10:20:00.000Z",
  },
];

export default knowledgeDocs;