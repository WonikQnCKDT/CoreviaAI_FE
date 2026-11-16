import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useDemoStore } from "@/stores/DemoStore";
import ProgressBar from "@/components/ui/ProgressBar";
import Avatar from "@/components/ui/Avatar";
import { Badge, HealthBadge, PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import InfoTip from "@/components/ui/InfoTip";
import { addDays, ddayLabel, diffDays, formatDate, formatShort, TODAY } from "@/utils/date";
import { STAGES, STAGE_LABEL, riskLevel } from "@/utils/ui";
import { isLateTask, isMissingTask, leafTasks, projectProgress, stageProgress } from "@/features/task/utils/taskTree";

export default function ProjectOverviewPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { projects, tasks, issues, users, openTask } = useDemoStore();
  const [codeCopied, setCodeCopied] = useState(false);

  const project = projects.find((p) => p.id === projectId);

  const derived = useMemo(() => {
    if (!project) {
      return {
        projectTasks: [],
        progress: 0,
        late: [],
        missing: [],
        openIssues: [],
        trend: [],
        workload: [],
        topShare: 0,
      };
    }
    const projectTasks = tasks.filter((t) => t.projectId === project.id);
    const leaves = leafTasks(projectTasks);
    const late = leaves.filter((t) => isLateTask(t, TODAY));
    const missing = leaves.filter((t) => isMissingTask(t, TODAY));
    const openIssues = issues.filter((i) => i.projectId === project.id && i.status !== "closed");

    const buckets = [3, 2, 1, 0].map((offset) => {
      const start = addDays(TODAY, -7 * (offset + 1));
      const end = addDays(TODAY, -7 * offset);
      const count = issues.filter(
        (i) => i.projectId === project.id && i.createdAt >= start && i.createdAt < end,
      ).length;
      const label = offset === 0 ? "이번 주" : `${offset + 1}주 전`;
      return { label, count };
    });

    const assigneeMap = new Map<string, number>();
    leaves
      .filter((t) => t.status !== "done")
      .forEach((t) => {
        const key = t.assigneeId || "none";
        assigneeMap.set(key, (assigneeMap.get(key) || 0) + 1);
      });
    const totalOpen = Array.from(assigneeMap.values()).reduce((a, b) => a + b, 0);
    const workload = Array.from(assigneeMap.entries())
      .map(([userId, count]) => ({
        userId,
        name: users.find((u) => u.id === userId)?.name || "미지정",
        count,
        share: totalOpen ? Math.round((count / totalOpen) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    return {
      projectTasks,
      progress: projectProgress(tasks, project.id),
      late,
      missing,
      openIssues,
      trend: buckets,
      workload,
      topShare: workload[0]?.share || 0,
    };
  }, [project, tasks, issues, users]);

  if (!project) return null;

  const pm = users.find((u) => u.id === project.pmId);
  const maxTrend = Math.max(1, ...derived.trend.map((t) => t.count));
  const risk = riskLevel(project.riskScore);
  const wipExceeded = (["todo", "progress", "review"] as const).filter((key) => {
    const count = derived.projectTasks.filter((t) => t.status === key).length;
    return count > project.kanbanWip[key];
  });

  const evidence = [
    { label: "지연 작업", value: `${derived.late.length}건`, ok: derived.late.length === 0 },
    { label: "누락 의심 업무", value: `${derived.missing.length}건`, ok: derived.missing.length === 0 },
    { label: "미해결 이슈", value: `${derived.openIssues.length}건`, ok: derived.openIssues.length === 0 },
    { label: "WIP 한도 초과 컬럼", value: `${wipExceeded.length}개`, ok: wipExceeded.length === 0 },
    { label: "최대 담당자 업무 비중", value: `${derived.topShare}%`, ok: derived.topShare <= 40 },
  ];

  const copyProjectCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCodeCopied(true);
      window.setTimeout(() => setCodeCopied(false), 1600);
    } catch {
      setCodeCopied(false);
    }
  };

  const metaItems = [
    { label: "수행 방식", node: <span className="font-medium text-foreground-900">폭포수 · 5단계</span> },
    { label: "주관 부서", node: <span className="font-medium text-foreground-900">{project.dept}</span> },
    {
      label: "PM",
      node: (
        <span className="flex items-center gap-1.5 font-medium text-foreground-900">
          <Avatar name={pm?.name || "?"} size="xs" />
          {pm?.name || "미지정"}
        </span>
      ),
    },
    {
      label: "기간",
      node: (
        <span className="font-medium text-foreground-900">
          {formatDate(project.startDate)} ~ {formatDate(project.endDate)}
        </span>
      ),
    },
    {
      label: "참여 인원",
      node: (
        <span className="flex items-center gap-1.5 font-medium text-foreground-900">
          {project.members.length}명
          <span className="flex -space-x-1">
            {project.members.slice(0, 4).map((member) => {
              const user = users.find((u) => u.id === member.userId);
              return <Avatar key={member.userId} name={user?.name || "?"} size="xs" className="ring-2 ring-background-50" />;
            })}
          </span>
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/70 px-3.5 py-2.5">
        <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded bg-amber-100 text-amber-700">
          <i className="ri-pushpin-2-line text-[12px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11.5px] font-semibold text-amber-900">고정 공지</p>
          <p className="mt-0.5 text-[11.5px] leading-5 text-amber-800">{project.notice}</p>
        </div>
      </div>

      <section className="card px-4 py-3.5 md:px-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="flex items-center gap-1 rounded border border-background-200 bg-background-100 px-1.5 py-[1px]">
            <i className="ri-price-tag-3-line text-[11px] text-foreground-400" aria-hidden="true" />
            <span className="font-mono text-[11px] text-foreground-600">{project.code}</span>
            <button
              type="button"
              onClick={() => copyProjectCode(project.code)}
              aria-label="식별 코드 복사"
              title={codeCopied ? "복사되었습니다" : "식별 코드 복사"}
              className="flex h-4 w-4 cursor-pointer items-center justify-center rounded text-foreground-400 hover:text-primary-600"
            >
              <i className={codeCopied ? "ri-check-line text-[11px] text-emerald-600" : "ri-file-copy-line text-[11px]"} aria-hidden="true" />
            </button>
          </span>
          <HealthBadge health={project.status} />
          <Badge className="border-background-300 bg-background-100 text-foreground-600">폭포수</Badge>
          {project.visibility === "members" && (
            <Badge className="border-background-300 bg-background-100 text-foreground-600">멤버 전용</Badge>
          )}
          <span className="ml-auto text-[10.5px] text-foreground-500">
            기준일 {formatDate(TODAY)}
          </span>
        </div>

        <p className="mt-2 w-full min-w-0 whitespace-normal text-[12.5px] leading-6 text-foreground-700 [overflow-wrap:anywhere] [word-break:keep-all]">
          {project.description}
        </p>

        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-background-200 pt-3 text-[12px] sm:grid-cols-3 lg:grid-cols-5">
          {metaItems.map((item) => (
            <div key={item.label} className="min-w-0">
              <dt className="text-[10.5px] text-foreground-500">{item.label}</dt>
              <dd className="mt-0.5 truncate">{item.node}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-3.5 border-t border-background-200 pt-3">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1 text-[11.5px] text-foreground-600">
              전체 진척률
              <InfoTip
                label="전체 진척률 계산 기준"
                text="최하위 업무의 진척률을 예상 작업량으로 가중 평균한 값입니다. 자동 계산되며 직접 수정할 수 없습니다."
              />
            </span>
            <span className="text-[16px] font-semibold tabular-nums leading-none text-primary-700">{derived.progress}%</span>
          </div>
          <ProgressBar value={derived.progress} size="md" color="bg-primary-500" className="mt-2" />
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground-950">
            단계별 진척률
            <InfoTip
              label="단계별 진척률 계산 기준"
              text="단계 안 최하위 업무의 진척률을 예상 작업량으로 가중 평균합니다. 카드를 누르면 WBS에서 해당 단계를 펼쳐 보여 줍니다."
            />
          </h3>
          <Link to={`/projects/${project.id}/wbs`} className="text-[11.5px] font-medium text-primary-600 hover:text-primary-700">
            WBS에서 자세히 보기 <i className="ri-arrow-right-s-line" />
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {STAGES.map((stage, index) => {
            const value = stageProgress(tasks, project.id, stage.key);
            const milestone = project.milestones.find((m) => m.stage === stage.key);
            const isCurrent = project.stage === stage.key;
            const isDone = value >= 100;
            return (
              <Link
                key={stage.key}
                to={`/projects/${project.id}/wbs?stage=${stage.key}`}
                title={`${stage.label} 단계 WBS 열기`}
                className={`card px-3 py-2.5 transition hover:border-primary-300 ${
                  isCurrent ? "border-primary-300 bg-primary-50/50" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9.5px] font-semibold ${
                        isDone
                          ? "bg-emerald-500 text-background-50"
                          : isCurrent
                            ? "bg-primary-500 text-background-50"
                            : "bg-background-200 text-foreground-500"
                      }`}
                    >
                      {isDone ? <i className="ri-check-line" /> : index + 1}
                    </span>
                    <span className={`truncate text-[12px] font-medium ${isCurrent ? "text-primary-800" : "text-foreground-900"}`}>
                      {stage.label}
                    </span>
                  </span>
                  <span className="shrink-0 text-[12px] font-semibold tabular-nums text-foreground-800">{value}%</span>
                </div>
                <ProgressBar
                  value={value}
                  color={isDone ? "bg-emerald-500" : "bg-primary-500"}
                  className="mt-2"
                />
                <div className="mt-1.5 flex items-center justify-between gap-1 text-[10px] text-foreground-500">
                  <span className="truncate">
                    {milestone ? (
                      <>
                        <i className="ri-flag-2-line mr-0.5 text-amber-500" />
                        {milestone.name}
                      </>
                    ) : (
                      "마일스톤 미등록"
                    )}
                  </span>
                  <span className={`shrink-0 whitespace-nowrap ${isCurrent ? "font-medium text-primary-700" : ""}`}>
                    {isCurrent ? "현재 단계" : milestone ? ddayLabel(milestone.date) : formatShort(project.startDate)}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <section className="card">
          <div className="border-b border-background-200 px-4 py-3">
            <h3 className="text-[13.5px] font-semibold text-foreground-950">리스크 점수와 근거</h3>
            <p className="mt-0.5 text-[11px] text-foreground-500">지표를 누르면 관련 화면으로 이동합니다.</p>
          </div>
          <div className="px-4 py-3">
            <div
              className={`rounded-lg border px-3.5 py-3 ${
                risk === "danger"
                  ? "border-rose-200 bg-rose-50"
                  : risk === "caution"
                    ? "border-amber-200 bg-amber-50"
                    : "border-emerald-200 bg-emerald-50"
              }`}
            >
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[11px] font-medium text-foreground-600">종합 리스크</p>
                  <p className="mt-0.5 flex items-baseline gap-1">
                    <span className="text-[26px] font-semibold leading-none text-foreground-950">{project.riskScore}</span>
                    <span className="text-[12px] text-foreground-600">/ 100</span>
                  </p>
                </div>
                <HealthBadge health={project.status} />
              </div>
              <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-background-300">
                <div
                  className={`h-1.5 rounded-full ${risk === "danger" ? "bg-rose-500" : risk === "caution" ? "bg-amber-500" : "bg-emerald-500"}`}
                  style={{ width: `${project.riskScore}%` }}
                />
              </div>
            </div>
            <ul className="mt-3 space-y-1.5">
              {evidence.map((item) => (
                <li key={item.label}>
                  <button
                    type="button"
                    onClick={() => navigate(`/projects/${project.id}/risk`)}
                    className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-background-200 bg-background-50 px-2.5 py-2 text-left hover:border-primary-300"
                  >
                    <span className="flex items-center gap-1.5 text-[11.5px] text-foreground-700">
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${item.ok ? "bg-emerald-500" : "bg-rose-500"}`} />
                      {item.label}
                    </span>
                    <span className="flex shrink-0 items-center gap-1 text-[11.5px] font-semibold text-foreground-900">
                      {item.value}
                      <i className="ri-arrow-right-s-line text-foreground-400" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-2.5 text-[10.5px] leading-4 text-foreground-500">
              AI 분석 결과가 아닌 규칙 기반 데모 점수입니다. 실제 분석 엔진은 연결되어 있지 않습니다.
            </p>
          </div>
        </section>

        <section className="card">
          <div className="flex items-center justify-between border-b border-background-200 px-4 py-3">
            <h3 className="flex items-center gap-1.5 text-[13.5px] font-semibold text-foreground-950">
              지연 작업
              <span className="text-[11px] font-normal text-foreground-500">{derived.late.length}건</span>
            </h3>
            <Link to={`/projects/${project.id}/wbs`} className="text-[11.5px] font-medium text-primary-600 hover:text-primary-700">
              전체 보기
            </Link>
          </div>
          {derived.late.length === 0 ? (
            <p className="px-4 py-10 text-center text-[12px] text-foreground-500">지연된 작업이 없습니다.</p>
          ) : (
            <ul className="divide-y divide-background-200">
              {derived.late.slice(0, 5).map((task) => {
                const assignee = users.find((u) => u.id === task.assigneeId);
                return (
                  <li key={task.id}>
                    <button
                      type="button"
                      onClick={() => openTask(task.id)}
                      className="flex w-full cursor-pointer items-start gap-2.5 px-4 py-2.5 text-left hover:bg-background-100"
                    >
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-rose-50 text-[10px] text-rose-600">
                        <i className="ri-alarm-warning-line" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] font-medium text-foreground-900">{task.name}</span>
                        <span className="mt-0.5 block text-[10.5px] text-foreground-500">
                          {STAGE_LABEL[task.stage || "analysis"]} ·{" "}
                          <span className="font-medium text-rose-600">{Math.abs(diffDays(TODAY, task.endDate))}일 경과</span>
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        {assignee && <Avatar name={assignee.name} size="xs" />}
                        <StatusBadge status={task.status} />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="card">
          <div className="flex items-center justify-between border-b border-background-200 px-4 py-3">
            <h3 className="flex items-center gap-1.5 text-[13.5px] font-semibold text-foreground-950">
              누락 의심 업무
              <span className="text-[11px] font-normal text-foreground-500">{derived.missing.length}건</span>
            </h3>
            <Link to={`/projects/${project.id}/missing`} className="text-[11.5px] font-medium text-primary-600 hover:text-primary-700">
              원인별 보기
            </Link>
          </div>
          {derived.missing.length === 0 ? (
            <p className="px-4 py-10 text-center text-[12px] text-foreground-500">누락이 의심되는 업무가 없습니다.</p>
          ) : (
            <ul className="divide-y divide-background-200">
              {derived.missing.slice(0, 5).map((task) => (
                <li key={task.id}>
                  <button
                    type="button"
                    onClick={() => openTask(task.id)}
                    className="flex w-full cursor-pointer items-start gap-2.5 px-4 py-2.5 text-left hover:bg-background-100"
                  >
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-50 text-[10px] text-amber-600">
                      <i className="ri-question-mark" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-medium text-foreground-900">{task.name}</span>
                      <span className="mt-0.5 block truncate text-[10.5px] text-foreground-500">
                        {task.assigneeId ? "시작일 경과 · 진척 0%" : "담당자 미지정"} · {formatShort(task.endDate)} 마감
                      </span>
                    </span>
                    <PriorityBadge priority={task.priority} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="card px-4 py-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[13.5px] font-semibold text-foreground-950">이슈 추이</h3>
            <span className="text-[11px] text-foreground-500">최근 4주 등록 건수</span>
          </div>
          <div className="mt-4 flex items-end justify-between gap-3 px-1">
            {derived.trend.map((bucket) => (
              <div key={bucket.label} className="flex flex-1 flex-col items-center gap-1.5">
                <span className="text-[11.5px] font-semibold tabular-nums text-foreground-800">{bucket.count}</span>
                <div className="flex h-[104px] w-full items-end">
                  <div
                    className={`w-full rounded-t-md ${bucket.count > 0 ? "bg-primary-400" : "bg-background-200"}`}
                    style={{ height: `${Math.max((bucket.count / maxTrend) * 100, 4)}%` }}
                  />
                </div>
                <span className="text-[10.5px] text-foreground-500">{bucket.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-background-200 pt-2.5 text-[11px] text-foreground-600">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary-400" /> 등록 이슈
            </span>
            <button
              type="button"
              className="ml-auto cursor-pointer font-medium text-primary-600 hover:text-primary-700"
              onClick={() => navigate(`/projects/${project.id}/issues`)}
            >
              이슈·결함 화면 <i className="ri-arrow-right-s-line" />
            </button>
          </div>
        </section>

        <section className="card px-4 py-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[13.5px] font-semibold text-foreground-950">인력 편중</h3>
            <span className="text-[11px] text-foreground-500">미완료 최하위 업무 기준</span>
          </div>
          <ul className="mt-3 space-y-2">
            {derived.workload.length === 0 && <li className="text-[12px] text-foreground-500">배정된 미완료 업무가 없습니다.</li>}
            {derived.workload.slice(0, 5).map((item) => (
              <li key={item.userId} className="flex items-center gap-2.5">
                <Avatar name={item.name} size="xs" />
                <span className="w-[52px] shrink-0 truncate text-[11.5px] text-foreground-800">{item.name}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-background-300">
                  <div
                    className={`h-1.5 rounded-full ${item.share > 40 ? "bg-amber-500" : "bg-primary-400"}`}
                    style={{ width: `${Math.min(item.share, 100)}%` }}
                  />
                </div>
                <span className="w-[68px] shrink-0 text-right text-[11px] tabular-nums text-foreground-600">
                  {item.count}건 · {item.share}%
                </span>
              </li>
            ))}
          </ul>
          {derived.topShare > 40 && (
            <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] leading-4 text-amber-800">
              특정 담당자에게 업무가 집중되어 있습니다. WBS에서 담당자를 재분배해 보세요.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}