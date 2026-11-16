import type { RiskSettings, RiskSuggestion } from "@/types";

export const riskSettings: RiskSettings = {
  weights: { schedule: 35, bottleneck: 25, workload: 20, impact: 20 },
  thresholds: { caution: 40, danger: 70 },
  bottleneckWip: 4,
  workloadShare: 40,
};

export const riskSuggestions: RiskSuggestion[] = [
  {
    id: "rs1",
    projectId: "p1",
    taskId: "t1212",
    title: "검색 API 구현 일정 5일 연장",
    reason: "인덱스 재설계로 선행 작업이 지연되어 현재 종료일(11/20) 내 완료가 어렵습니다. 후행 통합 테스트 일정까지 영향을 줄 수 있습니다.",
    changes: [{ field: "endDate", label: "종료일", before: "2026-11-20", after: "2026-11-25" }],
    proposed: { endDate: "2026-11-25" },
    status: "pending",
    createdAt: "2026-11-08T09:10:00.000Z",
  },
  {
    id: "rs2",
    projectId: "p1",
    taskId: "t1231",
    title: "알림 템플릿 정의 담당자 지정",
    reason: "담당자가 지정되지 않아 착수가 지연되고 있습니다. 알림 개발 경험이 있는 윤도현 님을 지정하는 것을 제안합니다.",
    changes: [{ field: "assigneeId", label: "담당자", before: "미지정", after: "윤도현" }],
    proposed: { assigneeId: "u8" },
    status: "pending",
    createdAt: "2026-11-08T09:12:00.000Z",
  },
  {
    id: "rs3",
    projectId: "p1",
    taskId: "t124",
    title: "관리자 콘솔 담당자 재배치",
    reason: "윤도현 님에게 미완료 업무가 집중되어 있습니다. 관리자 콘솔 초기 설계는 박지훈 님이 수행하는 것이 적합합니다.",
    changes: [{ field: "assigneeId", label: "담당자", before: "윤도현", after: "박지훈" }],
    proposed: { assigneeId: "u2" },
    status: "pending",
    createdAt: "2026-11-08T09:15:00.000Z",
  },
  {
    id: "rs4",
    projectId: "p2",
    taskId: "t222",
    title: "권한별 문서 필터 검토 기간 3일 연장",
    reason: "권한 케이스 24종 검증 중 예외 케이스가 추가로 확인되었습니다.",
    changes: [{ field: "endDate", label: "종료일", before: "2026-11-06", after: "2026-11-09" }],
    proposed: { endDate: "2026-11-09" },
    status: "approved",
    createdAt: "2026-11-04T13:00:00.000Z",
    decidedBy: "u9",
    decidedAt: "2026-11-04T14:20:00.000Z",
  },
];

export default riskSuggestions;