import type { Comment } from "@/types";

export const comments: Comment[] = [
  {
    id: "c1",
    taskId: "t1122",
    userId: "u2",
    content: "권한 매트릭스에서 부서 공개 범위가 프로젝트 공개 범위보다 우선하는지 확인 부탁드립니다.",
    createdAt: "2026-11-05T10:24:00.000Z",
  },
  {
    id: "c2",
    taskId: "t1122",
    userId: "u1",
    content: "@박지훈 프로젝트 공개 범위를 우선 적용하는 것으로 정리했습니다. 11/9까지 보안팀 검토 의견 반영하겠습니다.",
    createdAt: "2026-11-05T11:02:00.000Z",
  },
  {
    id: "c3",
    taskId: "t1122",
    userId: "u5",
    content: "설계 확정되면 화면 권한 처리도 같이 반영해야 해서 확정 시점 공유 부탁드립니다.",
    createdAt: "2026-11-06T01:15:00.000Z",
  },
  {
    id: "c4",
    taskId: "t125",
    userId: "u5",
    content: "재현 경로 확인했습니다. 멤버 전용 프로젝트에서 권한 캐시가 갱신되지 않는 문제로 보입니다.",
    createdAt: "2026-11-06T06:40:00.000Z",
  },
  {
    id: "c5",
    taskId: "t123",
    userId: "u1",
    content: "@윤도현 알림 템플릿 담당자가 아직 지정되지 않았습니다. 11/10까지 지정 부탁드립니다.",
    createdAt: "2026-11-07T02:10:00.000Z",
  },
  {
    id: "c6",
    taskId: "t302",
    userId: "u10",
    content: "야간조 인터뷰는 11/12 15시로 조정했습니다. 현장 출입증은 제가 준비하겠습니다.",
    createdAt: "2026-11-04T05:30:00.000Z",
  },
];

export default comments;