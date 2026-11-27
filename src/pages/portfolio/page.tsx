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
import { projectProgress } from "@/features/task/utils/taskTree";
import { canViewPortfolio, canViewProject, isExecutive, projectRole } from "@/utils/permission";
import type { Health, Project, StageKey } from "@/types";
import { BUTTON_TEXT } from "@/shared/i18n/catalog/button";
import { PROJECT_FOCUS_LABEL } from "@/shared/i18n/catalog/status";

type FocusKey = "all" | "ongoing" | "late" | "done";

const FOCUS_LABEL: Record<FocusKey, string> = PROJECT_FOCUS_LABEL;

/** 완료되지 않았는데 종료일이 지난 프로젝트. 렌더링 값에 의존하지 않아 컴포넌트 밖에 둔다 */
const isLateProject = (project: Project) => project.status !== "done" && project.endDate < TODAY;

export default function PortfolioPage() {
  const navigate = useNavigate();
  const { currentUser, projects, tasks, users } = useDemoStore();
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
        progress: projectProgress(tasks, project.id),
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
    const map = new Map<string, { progressTotal: number; count: number; riskTotal: number; openTasks: number; projects: number }>();
    scoped.forEach((project) => {
      const entry = map.get(project.dept) || { progressTotal: 0, count: 0, riskTotal: 0, openTasks: 0, projects: 0 };
      const progress = projectProgress(tasks, project.id);
      entry.progressTotal += progress;
      entry.riskTotal += project.riskScore;
      entry.count += 1;
      entry.projects += 1;
      entry.openTasks += tasks.filter((t) => t.projectId === project.id && t.status !== "done").length;
      map.set(project.dept, entry);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({
        name,
        progress: Math.round(value.progressTotal / Math.max(value.count, 1)),
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
        title="전체 현황은 PM과 경영진만 볼 수 있습니다"
        description="현재 계정에는 전체 현황 열람 권한이 없습니다. 프로젝트 PM 또는 시스템 관리자에게 권한을 요청해 주세요."
        requiredRole="프로젝트 PM 또는 경영진"
        action={
          <Link to="/projects" className="btn-outline">
            프로젝트 목록으로
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
    { key: "all", label: "전체 프로젝트", value: metrics.total, hint: "조회 범위 기준", tone: "default" },
    { key: "ongoing", label: "진행 중", value: metrics.ongoing, hint: "완료 전 · 마감일 이내", tone: "primary" },
    { key: "late", label: "지연", value: metrics.late, hint: "완료 전 · 마감일 경과", tone: "danger" },
    { key: "done", label: "완료", value: metrics.done, hint: "이행까지 종료", tone: "success" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-foreground-500">
            <span className="inline-flex items-center gap-1 rounded border border-background-300 bg-background-50 px-1.5 py-[1px] text-[10px] font-medium text-foreground-600">
              <i className="ri-eye-line" /> 읽기 전용
            </span>
            {exec ? "경영진 · 소속 부서 범위" : "PM · 참여 프로젝트"} {scoped.length}건
          </p>
          <p className="text-[12px] text-foreground-500">
            여러 프로젝트의 진척률·마감일·지연·리스크를 한 화면에서 비교합니다. 개인별 성과 비교는 제공하지 않습니다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-outline" onClick={resetFilters}>
            <i className="ri-refresh-line" /> {BUTTON_TEXT.resetFilters}
          </button>
          <Link to="/projects" className="btn-primary">
            <i className="ri-folder-line" /> 프로젝트 목록
          </Link>
        </div>
      </div>

      <section aria-label="프로젝트 요약 지표">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {metricCards.map((card) => (
            <div key={card.key} className={`rounded-xl ${focus === card.key ? "ring-2 ring-primary-300" : ""}`}>
              <StatCard
                label={card.label}
                value={card.value}
                unit="건"
                hint={card.hint}
                tone={card.tone}
                onClick={() => applyFocus(card.key)}
              />
            </div>
          ))}
        </div>
        <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-foreground-500">
          <i className="ri-cursor-line" />
          지표를 누르면 아래 프로젝트 목록에 해당 조건이 적용됩니다.
          {focus !== "all" && (
            <button
              type="button"
              onClick={() => setFocus("all")}
              className="ml-1 inline-flex cursor-pointer items-center gap-1 rounded-full border border-primary-200 bg-primary-50 px-2 py-[1px] text-[10.5px] font-medium text-primary-700"
            >
              현재 지표 · {FOCUS_LABEL[focus]} <i className="ri-close-line text-[11px]" />
            </button>
          )}
        </p>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <section className="card xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-background-200 px-4 py-3">
            <div>
              <h3 className="text-[13.5px] font-semibold text-foreground-950">위험 프로젝트 상위 5개</h3>
              <p className="mt-0.5 text-[11px] text-foreground-500">리스크 점수 기준 내림차순입니다.</p>
            </div>
            <Badge className="border-background-300 bg-background-100 text-foreground-600">규칙 기반 데모 점수</Badge>
          </div>
          {topRisk.length === 0 ? (
            <EmptyState icon="ri-inbox-line" title="표시할 프로젝트가 없습니다" description="조회 범위에 프로젝트가 없습니다." />
          ) : (
            <ul className="divide-y divide-background-200">
              {topRisk.map((project, index) => {
                const pmUser = users.find((u) => u.id === project.pmId);
                const progress = projectProgress(tasks, project.id);
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
                              <Badge className="border-rose-200 bg-rose-50 text-rose-600">지연</Badge>
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 flex min-w-0 truncate text-[11px] text-foreground-500">
                          {project.dept} · PM {pmUser?.name} · {formatDate(project.endDate)} 종료
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
            <h3 className="text-[13.5px] font-semibold text-foreground-950">부서별 진척률</h3>
            <p className="mt-0.5 text-[11px] text-foreground-500">
              {exec ? "소속 범위 부서 단위 집계" : "프로젝트 주관 부서 단위 집계"} · 개인별 지표 없음
            </p>
          </div>
          <ul className="space-y-3 px-4 py-3.5">
            {deptStats.length === 0 && <li className="py-6 text-center text-[12px] text-foreground-500">부서 데이터가 없습니다.</li>}
            {deptStats.map((item) => (
              <li key={item.name}>
                <div className="flex items-center justify-between text-[11.5px]">
                  <span className="font-medium text-foreground-800">{item.name}</span>
                  <span className="text-foreground-600">
                    {item.projects}개 · 미완료 {item.openTasks}건
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
            경영진에게는 개인 업무량·개인 지연 이력·개인 순위를 표시하지 않습니다.
          </div>
        </section>
      </div>

      <div ref={listRef} className="scroll-mt-20">
        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-background-200 px-4 py-3">
            <select className="field w-auto min-w-[104px] text-[12.5px]" value={status} onChange={(e) => setStatus(e.target.value as "all" | Health)}>
              <option value="all">상태 전체</option>
              {(["normal", "caution", "danger", "done"] as Health[]).map((key) => (
                <option key={key} value={key}>
                  {HEALTH_LABEL[key]}
                </option>
              ))}
            </select>
            <select className="field w-auto min-w-[104px] text-[12.5px]" value={stage} onChange={(e) => setStage(e.target.value as "all" | StageKey)}>
              <option value="all">단계 전체</option>
              {(Object.keys(STAGE_LABEL) as StageKey[]).map((key) => (
                <option key={key} value={key}>
                  {STAGE_LABEL[key]}
                </option>
              ))}
            </select>
            <select className="field w-auto min-w-[116px] text-[12.5px]" value={dept} onChange={(e) => setDept(e.target.value)}>
              <option value="all">부서 전체</option>
              {depts.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <select className="field w-auto min-w-[110px] text-[12.5px]" value={pm} onChange={(e) => setPm(e.target.value)}>
              <option value="all">PM 전체</option>
              {pmList.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
            <select className="field w-auto min-w-[112px] text-[12.5px]" value={risk} onChange={(e) => setRisk(e.target.value as "all" | Health)}>
              <option value="all">등급 전체</option>
              {(["danger", "caution", "normal"] as Health[]).map((key) => (
                <option key={key} value={key}>
                  {HEALTH_LABEL[key]}
                </option>
              ))}
            </select>
            <div className="flex flex-wrap items-center gap-1">
              {(["danger", "caution", "normal"] as Health[]).map((key) => (
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
                  {HEALTH_LABEL[key]} <span className="tabular-nums">{gradeCounts[key]}</span>
                </button>
              ))}
            </div>
            <span className="ml-auto text-[11.5px] text-foreground-500">
              {scoped.length}건 중 {rows.length}건 표시
            </span>
          </div>

          {rows.length === 0 ? (
            <EmptyState
              icon="ri-search-eye-line"
              title="조건에 맞는 프로젝트가 없습니다"
              description="상태·단계·부서·PM·등급 필터를 변경해 다시 확인해 주세요."
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
                    <th className="th">프로젝트명 · 코드</th>
                    <th className="th w-[122px]">주관 부서</th>
                    <th className="th w-[104px]">PM</th>
                    <th className="th w-[84px]">단계</th>
                    <th className="th w-[184px]">기간</th>
                    <th className="th w-[148px]">진척률</th>
                    <th className="th w-[86px]">상태</th>
                    <th className="th w-[98px]">마감</th>
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
                            {late && <Badge className="border-rose-200 bg-rose-50 text-rose-600">지연</Badge>}
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
                            {project.status === "done" ? "종료" : dday < 0 ? `${Math.abs(dday)}일 경과` : `D-${dday}`}
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
            <span>행을 클릭하면 해당 프로젝트 상세로 이동합니다.</span>
            <Link
              to={focus === "all" ? "/projects" : `/projects?focus=${focus}`}
              className="flex items-center gap-1 font-medium text-primary-600 hover:text-primary-700"
            >
              <i className="ri-folder-line" /> 프로젝트 목록에서 같은 조건으로 보기
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}