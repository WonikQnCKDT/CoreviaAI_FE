import type { Journal } from "@/types";

export const journals: Journal[] = [
  {
    id: "j1",
    date: "2026-11-06",
    userId: "u1",
    content:
      "통합검색 API 2차 리뷰 진행. 검색 인덱스 필드가 기획서와 불일치하는 부분을 확인해 개발팀과 재설계 범위를 합의했습니다. 권한 체계 설계서는 보안팀 검토 의견 3건을 반영 중입니다.",
    taskId: "t1212",
    progress: 40,
    hours: 5,
    createdAt: "2026-11-06T09:20:00.000Z",
  },
  {
    id: "j2",
    date: "2026-11-05",
    userId: "u1",
    content:
      "권한 체계 설계 초안 작성. 전사 공개와 부서 공개 기준이 모호한 케이스 4건을 정리해 보안팀에 질의했습니다.",
    taskId: "t1122",
    progress: 45,
    hours: 4,
    createdAt: "2026-11-05T10:10:00.000Z",
  },
  {
    id: "j3",
    date: "2026-11-04",
    userId: "u1",
    content:
      "설비 점검 이력 시스템 현장 인터뷰 결과 정리. 3개 라인 중 2개 라인 인터뷰 완료, 야간조 인터뷰는 11/12로 일정 조정했습니다.",
    taskId: "t302",
    progress: 25,
    hours: 3,
    createdAt: "2026-11-04T08:40:00.000Z",
  },
  {
    id: "j4",
    date: "2026-11-03",
    userId: "u1",
    content:
      "11월 오픈 일정 리스크 점검. 개발 인력이 통합검색 API에 집중되어 관리자 콘솔 착수가 지연될 가능성이 있어 인력 재배치안을 검토했습니다.",
    taskId: "t141",
    progress: 10,
    hours: 2,
    createdAt: "2026-11-03T09:05:00.000Z",
  },
  {
    id: "j5",
    date: "2026-11-02",
    userId: "u1",
    content:
      "임직원 교육 이수 관리 프로젝트 주간 점검. 조직도 연계 방식에 대한 인사팀 의견을 반영해 권한 설계 범위를 조정했습니다.",
    taskId: "t513",
    progress: 30,
    hours: 3,
    createdAt: "2026-11-02T09:30:00.000Z",
  },
  {
    id: "j6",
    date: "2026-10-31",
    userId: "u1",
    content: "10월 마감 회고. 설계 단계 지연 원인 2건(권한 정책 변경, 리뷰 일정 미확정)을 정리하고 11월 개선안을 작성했습니다.",
    taskId: "t1122",
    progress: 30,
    hours: 2,
    createdAt: "2026-10-31T08:15:00.000Z",
  },
];

export default journals;