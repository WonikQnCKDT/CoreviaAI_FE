import type { BoardPost } from "@/types";

export const boardPosts: BoardPost[] = [
  {
    id: "b1",
    projectId: "p1",
    type: "notice",
    title: "11/13(금) 요구사항 변경 협의회 안내",
    body: "11/13(금) 14:00 요구사항 변경 협의회가 진행됩니다. 참석자(PM·현업·개발)는 사전에 검토 의견을 남겨 주세요. 12월 오픈 일정은 고정입니다.",
    authorId: "u1",
    pinned: true,
    attachments: [],
    createdAt: "2026-11-06T09:00:00.000Z",
    updatedAt: "2026-11-06T09:00:00.000Z",
  },
  {
    id: "b2",
    projectId: "p1",
    type: "share",
    title: "통합검색 API 2차 리뷰 결과 공유",
    body: "검색 인덱스 필드 불일치 3건을 정리했습니다. 재설계 범위와 일정은 WBS의 '검색 API 구현' 업무에 반영했습니다. 리뷰 의견은 댓글로 남겨 주세요.",
    authorId: "u2",
    pinned: false,
    attachments: [{ id: "a1", name: "통합검색_API_2차리뷰_정리.docx", size: "128KB", local: true }],
    createdAt: "2026-11-05T15:30:00.000Z",
    updatedAt: "2026-11-05T15:30:00.000Z",
  },
  {
    id: "b3",
    projectId: "p1",
    type: "share",
    title: "디자인 시스템 가이드 v1.2 배포",
    body: "색상·타이포·컴포넌트 규칙을 정리한 디자인 시스템 가이드 v1.2를 배포합니다. 화면 설계 시 반드시 최신 가이드를 확인해 주세요.",
    authorId: "u5",
    pinned: false,
    attachments: [{ id: "a2", name: "디자인시스템_가이드_v1.2.pdf", size: "3.2MB", local: true }],
    createdAt: "2026-11-04T11:10:00.000Z",
    updatedAt: "2026-11-04T11:10:00.000Z",
  },
  {
    id: "b4",
    projectId: "p2",
    type: "notice",
    title: "검색 색인 작업 시간 안내 (11/18)",
    body: "문서 권한 정책 변경으로 11/18(수) 18시부터 2시간 동안 검색 색인 작업이 진행됩니다. 해당 시간에는 검색 결과가 일부 누락될 수 있습니다.",
    authorId: "u9",
    pinned: true,
    attachments: [],
    createdAt: "2026-11-02T10:00:00.000Z",
    updatedAt: "2026-11-02T10:00:00.000Z",
  },
];

export default boardPosts;