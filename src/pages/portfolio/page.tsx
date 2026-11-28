import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDemoStore } from "@/stores/DemoStore";
import { Badge, RiskBadge } from "@/components/ui/Badge";
import RiskScoreBadge from "@/components/ui/RiskScoreBadge";
import ProgressBar from "@/components/ui/ProgressBar";
import EmptyState from "@/components/ui/EmptyState";
import StatCard from "@/components/ui/StatCard";
import NoAccess from "@/components/ui/NoAccess";
import Avatar from "@/components/ui/Avatar";
import { formatDate, TODAY, diffDays } from "@/utils/date";
import { HEALTH_LABEL, STAGE_LABEL, riskLevel } from "@/utils/ui";
import { displayProjectProgress } from "@/features/task/utils/taskTree";
import { canViewPortfolio, canViewProject, isExecutive, projectRole } from "@/utils/permission";
import type { Health, Project, StageKey } from "@/types";
import { BUTTON_TEXT } from "@/shared/i18n/catalog/button";
import { COMMON_UI_TEXT } from "@/shared/i18n/catalog/common";
import { PROJECT_FOCUS_LABEL } from "@/shared/i18n/catalog/status";
import { PORTFOLIO_TEXT, PROJECT_LIST_TEXT } from "@/features/project/i18n/ko";
import { formatLabel } from "@/shared/i18n/store";
import { useCommonCodes } from "@/shared/codes/useCommonCodes";
import { RISK_LEVEL_TO_HEALTH } from "@/shared/codes/codeStore";

type FocusKey = "all" | "ongoing" | "late" | "done";

const FOCUS_LABEL: Record<FocusKey, string> = PROJECT_FOCUS_LABEL;

/** 완료되지 않았는데 종료일이 지난 프로젝트. 렌더링 값에 의존하지 않아 컴포넌트 밖에 둔다 */
const isLateProject = (project: Project) => project.status !== "done" && project.endDate < TODAY;

export default function PortfolioPage() {
  const navigate = useNavigate();
  const { currentUser, projects, tasks, users } = useDemoStore();
  const { codes: riskCodes } = useCommonCodes("RISK_LEVEL");
  const riskOptions = useMemo(
    () =>
      riskCodes
        .map((item) => {
          const health = RISK_LEVEL_TO_HEALTH[item.code];
          return health ? { key: health as Health, label: item.label } : null;
        })
        .filter((item): item is { key: Health; label: string } => item !== null),
    [riskCodes],
  );
  const statusOptions = useMemo(
    () => [...riskOptions, { key: "done" as Health, label: HEALTH_LABEL.done }],
    [riskOptions],
  );
  const [status, setStatus] = useState<"all" | Health>("all");
  const [stage, setStage] = useState<"all" | StageKey>("all");
  const [dept, setDept] = useState("all");
  const [pm, setPm] = useState("all");
  const [risk, setRisk] = useState<"all" | Health>("all");
  const [focus, setFocus] = useState<FocusKey>("all");
  const listRef = useRef<HTMLDivElement | null>(null);

  const exec = isExecutive(currentUser);
  const allowed = canViewPortfolio(projects, currentUser);

  const scoped = useMemo(() => {
    if (!allowed) return [];
    return projects.filter((project) => {
      if (!canViewProject(project, currentUser)) return false;
      if (exec) return true;
      return projectRole(project, currentUser.id) === "pm";
    });
  }, [allowed, projects, currentUser, exec]);

  const metrics = useMemo(() => {
    const done = scoped.filter((project) => project.status === "done").length;
    const late = scoped.filter((project) => isLateProject(project)).length;
    return {
      total: scoped.length,
      done,
      late,
      ongoing: scoped.length - done - late,
    };
  }, [scoped]);

  const rows = useMemo(() => {
    return scoped
      .filter((project) => {
        const matchesStatus = status === "all" || project.status === status;
        const matchesStage = stage === "all" || project.stage === stage;
        const matchesDept = dept === "all" || project.dept === dept;
        const matchesPm = pm === "all" || project.pmId === pm;
        const matchesRisk = risk === "all" || riskLevel(project.riskScore) === risk;
        const matchesFocus =
          focus === "all" ||
          (focus === "done" && project.status === "done") ||
          (focus === "late" && isLateProject(project)) ||
          (focus === "ongoing" && project.status !== "done" && !isLateProject(project));
        return matchesStatus && matchesStage && matchesDept && matchesPm && matchesRisk && matchesFocus;
      })
      .map((project) => ({
        project,
        progress: displayProjectProgress(tasks, project),
        pmUser: users.find((u) => u.id === project.pmId),
        level: riskLevel(project.riskScore),
        late: isLateProject(project),
      }))
      .sort((a, b) => {
        if (a.late !== b.late) return a.late ? -1 : 1;
        return b.project.riskScore - a.project.riskScore;
      });
  }, [scoped, status, stage, dept, pm, risk, focus, tasks, users]);

  const gradeCounts = useMemo(() => {
    const base = { danger: 0, caution: 0, normal: 0, done: 0 };
    scoped.forEach((project) => {
      base[riskLevel(project.riskScore)] += 1;
    });
    return base;
  }, [scoped]);

  const deptStats = useMemo(() => {
    const map = new Map<string, { progressTotal: number; progressCount: number; count: number; riskTotal: number; openTasks: number; projects: number }>();
    scoped.forEach((project) => {
      const entry = map.get(project.dept) || { progressTotal: 0, progressCount: 0, count: 0, riskTotal: 0, openTasks: 0, projects: 0 };
      // 진척률을 모르는 서버 프로젝트는 부서 평균에서 뺀다(0%로 넣으면 평균이 내려간다)
      const progress = displayProjectProgress(tasks, project);
      if (progress !== null) {
        entry.progressTotal += progress;
        entry.progressCount += 1;
      }
      entry.riskTotal += project.riskScore;
      entry.count += 1;
      entry.projects += 1;
      entry.openTasks += tasks.filter((t) => t.projectId === project.id && t.status !== "done").length;
      map.set(project.dept, entry);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({
        name,
        progress: value.progressCount > 0 ? Math.round(value.progressTotal / value.progressCount) : null,
        risk: Math.round(value.riskTotal / Math.max(value.count, 1)),
        openTasks: value.openTasks,
        projects: value.projects,
      }))
      .sort((a, b) => b.risk - a.risk);
  }, [scoped, tasks]);

  const depts = Array.from(new Set(scoped.map((p) => p.dept)));
  const pmList = users.filter((u) => scoped.some((p) => p.pmId === u.id));
  const topRisk = useMemo(
    () => [...scoped].sort((a, b) => b.riskScore - a.riskScore).slice(0, 5),
    [scoped],
  );

  if (!allowed) {
    return (
      <NoAccess
        title={PORTFOLIO_TEXT.noAccessTitle}
        description={PORTFOLIO_TEXT.noAccessDescription}
        requiredRole={PORTFOLIO_TEXT.requiredRole}
        action={
          <Link to="/projects" className="btn-outline">
            {COMMON_UI_TEXT.goToProjectsBack}
          </Link>
        }
      />
    );
  }

  const resetFilters = () => {
    setStatus("all");
    setStage("all");
    setDept("all");
    setPm("all");
    setRisk("all");
    setFocus("all");
  };

  const applyFocus = (next: FocusKey) => {
    setFocus(next);
    window.setTimeout(() => {
      listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  };

  const metricCards: { key: FocusKey; label: string; value: number; hint: string; tone: "default" | "primary" | "danger" | "success" }[] = [
    { key: "all", label: PROJECT_FOCUS_LABEL.all, value: metrics.total, hint: PORTFOLIO_TEXT.hintAll, tone: "default" },
    { key: "ongoing", label: PROJECT_FOCUS_LABEL.ongoing, value: metrics.ongoing, hint: PORTFOLIO_TEXT.hintOngoing, tone: "primary" },
    { key: "late", label: PROJECT_FOCUS_LABEL.late, value: metrics.late, hint: PORTFOLIO_TEXT.hintLate, tone: "danger" },
    { key: "done", label: PROJECT_FOCUS_LABEL.done, value: metrics.done, hint: PORTFOLIO_TEXT.hintDone, tone: "success" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-foreground-500">
            <span className="inline-flex items-center gap-1 rounded border border-background-300 bg-background-50 px-1.5 py-[1px] text-[10px] font-medium text-foreground-600">
              <i className="ri-eye-line" /> {PORTFOLIO_TEXT.readOnly}
            </span>
            {exec ? PORTFOLIO_TEXT.scopeExec : PORTFOLIO_TEXT.scopePm} {scoped.length}{COMMON_UI_TEXT.countUnit}
          </p>
          <p className="text-[12px] text-foreground-500">
            {PORTFOLIO_TEXT.summaryDescription}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-outline" onClick={resetFilters}>
            <i className="ri-refresh-line" /> {BUTTON_TEXT.resetFilters}
          </button>
          <Link to="/projects" className="btn-primary">
            <i className="ri-folder-line" /> {COMMON_UI_TEXT.goToProjects}
          </Link>
        </div>
      </div>

      <section aria-label={PORTFOLIO_TEXT.metricsAria}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {metricCards.map((card) => (
            <div key={card.key} className={`rounded-xl ${focus === card.key ? "ring-2 ring-primary-300" : ""}`}>
              <StatCard
                label={card.label}
                value={card.value}
                unit={COMMON_UI_TEXT.countUnit}
                hint={card.hint}
                tone={card.tone}
                onClick={() => applyFocus(card.key)}
              />
            </div>
          ))}
        </div>
        <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-foreground-500">
          <i className="ri-cursor-line" />
          {PORTFOLIO_TEXT.clickMetricHint}
          {focus !== "all" && (
            <button
              type="button"
              onClick={() => setFocus("all")}
              className="ml-1 inline-flex cursor-pointer items-center gap-1 rounded-full border border-primary-200 bg-primary-50 px-2 py-[1px] text-[10.5px] font-medium text-primary-700"
            >
              {formatLabel(PORTFOLIO_TEXT.activeFocusChip, { label: FOCUS_LABEL[focus] })} <i className="ri-close-line text-[11px]" />
            </button>
          )}
        </p>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <section className="card xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-background-200 px-4 py-3">
            <div>
              <h3 className="text-[13.5px] font-semibold text-foreground-950">{PORTFOLIO_TEXT.topRiskTitle}</h3>
              <p className="mt-0.5 text-[11px] text-foreground-500">{PORTFOLIO_TEXT.topRiskDescription}</p>
            </div>
            <Badge className="border-background-300 bg-background-100 text-foreground-600">{PORTFOLIO_TEXT.ruleBasedDemoScore}</Badge>
          </div>
          {topRisk.length === 0 ? (
            <EmptyState icon="ri-inbox-line" title={PORTFOLIO_TEXT.emptyProjectsTitle} description={PORTFOLIO_TEXT.emptyProjectsDescription} />
          ) : (
            <ul className="divide-y divide-background-200">
              {topRisk.map((project, index) => {
                const pmUser = users.find((u) => u.id === project.pmId);
                const progress = displayProjectProgress(tasks, project);
                const late = isLateProject(project);
                return (
                  <li key={project.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(`/projects/${project.id}`)}
                      onKeyDown={(event) => {
                        if (event.target !== event.currentTarget) return;
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          navigate(`/projects/${project.id}`);
                        }
                      }}
                      className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left hover:bg-background-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-300"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-background-100 text-[11px] font-semibold tabular-nums text-foreground-600">
                        {index + 1}
                      </span>
                      <span className="flex h-7 w-[58px] shrink-0 items-center justify-center">
                        <RiskScoreBadge score={project.riskScore} health={project.status} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="min-w-0 truncate text-[12.5px] font-medium text-foreground-950">
                            {project.name}
                          </span>
                          {late && (
                            <span className="shrink-0">
                              <Badge className="border-rose-200 bg-rose-50 text-rose-600">{PORTFOLIO_TEXT.lateBadge}</Badge>
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 flex min-w-0 truncate text-[11px] text-foreground-500">
                          {project.dept} · {PROJECT_LIST_TEXT.colPm} {pmUser?.name} ·{" "}
                          {formatLabel(PORTFOLIO_TEXT.endDateSuffix, { date: formatDate(project.endDate) })}
                        </span>
                      </span>
                      <span className="hidden w-[110px] shrink-0 sm:block">
                        <ProgressBar value={progress} showLabel />
                      </span>
                      <i className="ri-arrow-right-s-line shrink-0 text-foreground-400" />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="card">
          <div className="border-b border-background-200 px-4 py-3">
            <h3 className="text-[13.5px] font-semibold text-foreground-950">{PORTFOLIO_TEXT.deptProgressTitle}</h3>
            <p className="mt-0.5 text-[11px] text-foreground-500">
              {exec ? PORTFOLIO_TEXT.deptScopeExec : PORTFOLIO_TEXT.deptScopePm} · {PORTFOLIO_TEXT.noIndividualMetric}
            </p>
          </div>
          <ul className="space-y-3 px-4 py-3.5">
            {deptStats.length === 0 && <li className="py-6 text-center text-[12px] text-foreground-500">{PORTFOLIO_TEXT.emptyDeptData}</li>}
            {deptStats.map((item) => (
              <li key={item.name}>
                <div className="flex items-center justify-between text-[11.5px]">
                  <span className="font-medium text-foreground-800">{item.name}</span>
                  <span className="text-foreground-600">
                    {formatLabel(PORTFOLIO_TEXT.deptItemCount, { projects: item.projects, openTasks: item.openTasks })}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex-1">
                    <ProgressBar value={item.progress} showLabel />
                  </div>
                  <RiskBadge score={item.risk} />
                </div>
              </li>
            ))}
          </ul>
          <div className="border-t border-background-200 bg-background-100 px-4 py-2.5 text-[10.5px] leading-4 text-foreground-500">
            {PORTFOLIO_TEXT.execPrivacyNote}
          </div>
        </section>
      </div>

      <div ref={listRef} className="scroll-mt-20">
        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-background-200 px-4 py-3">
            <select className="field w-auto min-w-[104px] text-[12.5px]" value={status} onChange={(e) => setStatus(e.target.value as "all" | Health)}>
              <option value="all">{PROJECT_LIST_TEXT.allStatuses}</option>
              {statusOptions.map(({ key, label }) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
            <select className="field w-auto min-w-[104px] text-[12.5px]" value={stage} onChange={(e) => setStage(e.target.value as "all" | StageKey)}>
              <option value="all">{PORTFOLIO_TEXT.allStages}</option>
              {(Object.keys(STAGE_LABEL) as StageKey[]).map((key) => (
                <option key={key} value={key}>
                  {STAGE_LABEL[key]}
                </option>
              ))}
            </select>
            <select className="field w-auto min-w-[116px] text-[12.5px]" value={dept} onChange={(e) => setDept(e.target.value)}>
              <option value="all">{PROJECT_LIST_TEXT.allDepartments}</option>
              {depts.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <select className="field w-auto min-w-[110px] text-[12.5px]" value={pm} onChange={(e) => setPm(e.target.value)}>
              <option value="all">{PROJECT_LIST_TEXT.allPms}</option>
              {pmList.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
            <select className="field w-auto min-w-[112px] text-[12.5px]" value={risk} onChange={(e) => setRisk(e.target.value as "all" | Health)}>
              <option value="all">{PORTFOLIO_TEXT.allGrades}</option>
              {riskOptions.map(({ key, label }) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
            <div className="flex flex-wrap items-center gap-1">
              {riskOptions.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setRisk(risk === key ? "all" : key)}
                  className={`flex cursor-pointer items-center gap-1 rounded-full border px-2 py-[2px] text-[10.5px] font-medium transition ${
                    risk === key
                      ? "border-primary-300 bg-primary-50 text-primary-700"
                      : "border-background-300 bg-background-50 text-foreground-600 hover:bg-background-100"
                  }`}
                >
                  {label} <span className="tabular-nums">{gradeCounts[key]}</span>
                </button>
              ))}
            </div>
            <span className="ml-auto text-[11.5px] text-foreground-500">
              {formatLabel(PORTFOLIO_TEXT.filteredCount, { total: scoped.length, shown: rows.length })}
            </span>
          </div>

          {rows.length === 0 ? (
            <EmptyState
              icon="ri-search-eye-line"
              title={PORTFOLIO_TEXT.noMatchTitle}
              description={PORTFOLIO_TEXT.noMatchDescription}
              action={
                <button type="button" className="btn-outline" onClick={resetFilters}>
                  {BUTTON_TEXT.resetFilters}
                </button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse">
                <thead>
                  <tr>
                    <th className="th">{PROJECT_LIST_TEXT.colNameCode}</th>
                    <th className="th w-[122px]">{PROJECT_LIST_TEXT.colDepartment}</th>
                    <th className="th w-[104px]">{PROJECT_LIST_TEXT.colPm}</th>
                    <th className="th w-[84px]">{PORTFOLIO_TEXT.colStageShort}</th>
                    <th className="th w-[184px]">{PROJECT_LIST_TEXT.colPeriod}</th>
                    <th className="th w-[148px]">{PROJECT_LIST_TEXT.colProgress}</th>
                    <th className="th w-[86px]">{PROJECT_LIST_TEXT.colStatus}</th>
                    <th className="th w-[98px]">{PORTFOLIO_TEXT.colDeadline}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ project, progress, pmUser, late }) => {
                    const dday = diffDays(TODAY, project.endDate);
                    return (
                      <tr
                        key={project.id}
                        onClick={() => navigate(`/projects/${project.id}`)}
                        className="cursor-pointer border-b border-background-200 last:border-0 hover:bg-background-100"
                      >
                        <td className="td">
                          <p className="flex flex-wrap items-center gap-1.5 font-medium text-foreground-950">
                            <span className="truncate">{project.name}</span>
                            {late && <Badge className="border-rose-200 bg-rose-50 text-rose-600">{PORTFOLIO_TEXT.lateBadge}</Badge>}
                          </p>
                          <p className="mt-0.5 font-mono text-[11px] text-foreground-500">{project.code}</p>
                        </td>
                        <td className="td text-[12px]">{project.dept}</td>
                        <td className="td">
                          <span className="flex items-center gap-1.5">
                            <Avatar name={pmUser?.name || "?"} size="xs" />
                            <span className="text-[12px]">{pmUser?.name}</span>
                          </span>
                        </td>
                        <td className="td">
                          <Badge className="border-primary-200 bg-primary-50 text-primary-700">{STAGE_LABEL[project.stage]}</Badge>
                        </td>
                        <td className="td text-[11.5px] text-foreground-600">
                          {formatDate(project.startDate)} ~ {formatDate(project.endDate)}
                        </td>
                        <td className="td">
                          <ProgressBar value={progress} showLabel color={late ? "bg-rose-500" : "bg-primary-500"} />
                        </td>
                        <td className="td">
                          <RiskScoreBadge score={project.riskScore} health={project.status} />
                        </td>
                        <td className="td">
                          <span
                            className={`text-[11.5px] font-medium ${
                              dday < 0 ? "text-rose-600" : dday <= 14 ? "text-amber-600" : "text-foreground-600"
                            }`}
                          >
                            {project.status === "done"
                              ? PORTFOLIO_TEXT.ended
                              : dday < 0
                                ? formatLabel(PORTFOLIO_TEXT.overdueDays, { days: Math.abs(dday) })
                                : `D-${dday}`}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-background-200 bg-background-100 px-4 py-2.5 text-[11px] text-foreground-500">
            <span>{PORTFOLIO_TEXT.footerRowHint}</span>
            <Link
              to={focus === "all" ? "/projects" : `/projects?focus=${focus}`}
              className="flex items-center gap-1 font-medium text-primary-600 hover:text-primary-700"
            >
              <i className="ri-folder-line" /> {PORTFOLIO_TEXT.viewSameInProjects}
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}