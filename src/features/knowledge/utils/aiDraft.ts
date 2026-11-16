import type { Issue, Journal, KnowledgeDoc, Meeting, Project, Task } from "@/types";
import { addDays, diffDays, formatDate, TODAY } from "@/utils/date";
import { isLateTask, leafTasks, projectProgress, stageProgress } from "@/features/task/utils/taskTree";
import { STAGES } from "@/utils/ui";

/* ===== 회의록 AI 정리 (규칙 기반 데모) ===== */
export interface DraftActionItem {
  id: string;
  text: string;
  stage: "analysis" | "design" | "dev" | "test" | "deploy";
  estimate: number;
}

export interface MeetingAiDraft {
  summary: string;
  decisions: string[];
  actionItems: DraftActionItem[];
}

const STAGE_KEYWORDS: { stage: DraftActionItem["stage"]; words: string[] }[] = [
  { stage: "analysis", words: ["요구사항", "분석", "인터뷰", "정의서", "현황"] },
  { stage: "design", words: ["설계", "화면", "ERD", "권한", "모델"] },
  { stage: "dev", words: ["개발", "구현", "API", "연동", "배포"] },
  { stage: "test", words: ["테스트", "검증", "결함", "QA", "시나리오"] },
  { stage: "deploy", words: ["이행", "오픈", "이관", "안정화", "공지"] },
];

export function inferStage(text: string): DraftActionItem["stage"] {
  const found = STAGE_KEYWORDS.find((item) => item.words.some((word) => text.includes(word)));
  return found?.stage || "analysis";
}

export function analyzeMeetingContent(content: string, _meetings?: Meeting[]): MeetingAiDraft {
  const lines = content
    .split(/\n|·|\.\s/)
    .map((line) => line.replace(/^[-*\d.\s]+/, "").trim())
    .filter((line) => line.length > 3);

  const decisions = lines.filter((line) => /결정|합의|확정|승인/.test(line)).slice(0, 4);
  const actionSources = lines.filter((line) => /하기로|필요|예정|진행|요청|조치|준비/.test(line)).slice(0, 5);

  const actionItems: DraftActionItem[] = (actionSources.length > 0 ? actionSources : lines.slice(0, 3)).map(
    (text, index) => ({
      id: `ai-${index + 1}`,
      text: text.length > 70 ? `${text.slice(0, 70)}…` : text,
      stage: inferStage(text),
      estimate: 2,
    }),
  );

  const summary =
    lines.length > 0
      ? `${lines.slice(0, 2).join(" ")}${lines.length > 2 ? " 등 논의 사항을 정리했습니다." : ""}`
      : "입력된 메모가 없습니다. 회의 내용을 작성하면 초안을 만들 수 있습니다.";

  return {
    summary,
    decisions: decisions.length > 0 ? decisions : ["결정 사항을 메모에서 찾지 못했습니다. 직접 입력해 주세요."],
    actionItems,
  };
}

/* ===== AI WBS 초안 (규칙 기반 데모) ===== */
export interface DraftWbsTask {
  id: string;
  stage: DraftActionItem["stage"];
  name: string;
  estimate: number;
  description: string;
  selected: boolean;
}

export interface DraftWbsMilestone {
  id: string;
  stage: DraftActionItem["stage"];
  name: string;
  date: string;
  selected: boolean;
}

const WBS_TEMPLATE: { stage: DraftActionItem["stage"]; items: { name: string; estimate: number; description: string }[] }[] = [
  {
    stage: "analysis",
    items: [
      { name: "현황 분석 및 요구사항 수집", estimate: 5, description: "이해관계자 인터뷰와 현행 프로세스 분석" },
      { name: "요구사항 정의서 작성", estimate: 4, description: "기능·비기능 요구사항 정리 및 합의" },
    ],
  },
  {
    stage: "design",
    items: [
      { name: "화면·UX 설계", estimate: 6, description: "주요 사용자 시나리오 기준 화면 설계" },
      { name: "데이터·권한 모델 설계", estimate: 5, description: "데이터 구조와 접근 권한 정책 정의" },
    ],
  },
  {
    stage: "dev",
    items: [
      { name: "핵심 기능 개발", estimate: 12, description: "요구사항 우선순위 기준 기능 구현" },
      { name: "연계·배치 개발", estimate: 6, description: "외부 시스템 연계 및 데이터 이관 프로그램" },
    ],
  },
  {
    stage: "test",
    items: [
      { name: "통합 테스트 수행", estimate: 7, description: "시나리오 기반 통합 테스트와 결함 조치" },
      { name: "사용자 검수 지원", estimate: 3, description: "현업 검수와 승인 지원" },
    ],
  },
  {
    stage: "deploy",
    items: [
      { name: "이행 계획 수립", estimate: 3, description: "이관·오픈·롤백 계획 정리" },
      { name: "운영 이관 및 안정화", estimate: 5, description: "운영 이관과 오픈 후 모니터링" },
    ],
  },
];

export function buildWbsDraft(project: Project, _purpose: string): { tasks: DraftWbsTask[]; milestones: DraftWbsMilestone[] } {
  const start = project.startDate > TODAY ? project.startDate : addDays(TODAY, 1);
  const end = project.endDate > start ? project.endDate : addDays(start, 90);
  const total = Math.max(diffDays(start, end), 20);
  const segment = Math.floor(total / 5);

  const tasks: DraftWbsTask[] = [];
  const milestones: DraftWbsMilestone[] = [];
  WBS_TEMPLATE.forEach((group, index) => {
    group.items.forEach((item, itemIndex) => {
      tasks.push({
        id: `${group.stage}-${itemIndex}`,
        stage: group.stage,
        name: item.name,
        estimate: item.estimate,
        description: item.description,
        selected: true,
      });
    });
    milestones.push({
      id: `m-${group.stage}`,
      stage: group.stage,
      name: `${STAGES[index].label} 완료`,
      date: addDays(start, Math.min(segment * (index + 1) - 1, total)),
      selected: true,
    });
  });

  return { tasks, milestones };
}

/* ===== 주간 리포트 초안 (규칙 기반 데모) ===== */
export interface WeeklyReportDraft {
  period: { start: string; end: string };
  summary: string;
  progress: number;
  doneThisWeek: Task[];
  progressThisWeek: Task[];
  nextWeek: Task[];
  milestones: { name: string; date: string; stage: string }[];
  issues: Issue[];
  riskScore: number;
  riskEvidence: { label: string; value: string }[];
  requests: string[];
  journalCount: number;
}

export function buildWeeklyReport(
  project: Project,
  allTasks: Task[],
  issues: Issue[],
  journals: Journal[],
  start: string,
  end: string,
): WeeklyReportDraft {
  const tasks = allTasks.filter((t) => t.projectId === project.id);
  const leaves = leafTasks(tasks);
  const doneThisWeek = leaves.filter((t) => t.status === "done" && t.endDate >= start && t.endDate <= end);
  const progressThisWeek = leaves.filter((t) => t.status !== "done" && t.endDate >= start && t.endDate <= end);
  const nextWeek = leaves.filter((t) => t.status !== "done" && t.endDate > end && t.endDate <= addDays(end, 7));
  const projectIssues = issues.filter((i) => i.projectId === project.id && i.status !== "closed");
  const late = leaves.filter((t) => isLateTask(t, TODAY));
  const journalCount = journals.filter((j) => j.date >= start && j.date <= end).length;

  const summary = `${formatDate(start)}~${formatDate(end)} 기간 동안 ${doneThisWeek.length}건의 업무를 완료했고, 전체 진척률은 ${projectProgress(allTasks, project.id)}%입니다. 미해결 이슈 ${projectIssues.length}건과 지연 업무 ${late.length}건을 확인했습니다.`;

  const requests: string[] = [];
  if (late.length > 0) requests.push(`지연 업무 ${late.length}건의 일정 재조정 여부를 검토해 주세요.`);
  if (projectIssues.some((i) => i.severity === "critical" || i.severity === "high")) {
    requests.push("심각도 높은 이슈의 조치 담당자와 기한을 확정해 주세요.");
  }
  if (nextWeek.length === 0) requests.push("차주 계획 업무가 비어 있습니다. WBS 일정을 확인해 주세요.");
  if (requests.length === 0) requests.push("특이 요청 사항이 없습니다.");

  return {
    period: { start, end },
    summary,
    progress: projectProgress(allTasks, project.id),
    doneThisWeek,
    progressThisWeek,
    nextWeek,
    milestones: project.milestones
      .filter((m) => m.date >= start && m.date <= addDays(end, 7))
      .map((m) => ({ name: m.name, date: m.date, stage: m.stage })),
    issues: projectIssues,
    riskScore: project.riskScore,
    riskEvidence: [
      { label: "지연 업무", value: `${late.length}건` },
      { label: "미해결 이슈", value: `${projectIssues.length}건` },
      { label: "테스트 단계 진척", value: `${stageProgress(allTasks, project.id, "test")}%` },
    ],
    requests,
    journalCount,
  };
}

/* ===== 지식사전 AI 질문 (가상 문서 기반 데모) ===== */
export interface KnowledgeAnswer {
  answer: string;
  sources: KnowledgeDoc[];
  noEvidence: boolean;
}

function scoreDoc(doc: KnowledgeDoc, tokens: string[]): number {
  let score = 0;
  tokens.forEach((token) => {
    if (doc.title.includes(token)) score += 4;
    if (doc.tags.some((tag) => tag.includes(token))) score += 3;
    if (doc.body.includes(token)) score += 1;
  });
  return score;
}

export function answerKnowledgeQuestion(question: string, docs: KnowledgeDoc[]): KnowledgeAnswer {
  const tokens = question
    .replace(/[?.,!]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
    .filter((token) => !["무엇", "어떻게", "알려", "관련", "대해", "있나요", "인가요", "해주세요"].includes(token));

  const ranked = docs
    .map((doc) => ({ doc, score: scoreDoc(doc, tokens) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (ranked.length === 0) {
    return {
      answer: "관련 문서 없음 · 현재 조회 가능한 지식 문서에서 근거를 찾지 못했습니다. 다른 용어로 질문하거나 문서를 먼저 등록해 주세요.",
      sources: [],
      noEvidence: true,
    };
  }

  const answer = ranked
    .map((entry) => {
      const firstSentence = entry.doc.body.split(/[.\n]/).map((s) => s.trim()).filter(Boolean)[0] || entry.doc.body;
      return `${entry.doc.title}: ${firstSentence}`;
    })
    .join("\n\n");

  return {
    answer: `조회 가능한 문서 ${ranked.length}건을 근거로 정리했습니다.\n\n${answer}`,
    sources: ranked.map((entry) => entry.doc),
    noEvidence: false,
  };
}

export function defaultReportRange(): { start: string; end: string } {
  return { start: addDays(TODAY, -6), end: TODAY };
}

export function meetingSummaryText(meeting: Meeting): string {
  return meeting.content.split("\n").filter(Boolean).slice(0, 2).join(" ");
}