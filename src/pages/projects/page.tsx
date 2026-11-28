import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useDemoStore } from "@/stores/DemoStore";
import { Badge } from "@/components/ui/Badge";
import RiskScoreBadge from "@/components/ui/RiskScoreBadge";
import ProgressBar from "@/components/ui/ProgressBar";
import EmptyState from "@/components/ui/EmptyState";
import Avatar from "@/components/ui/Avatar";
import StatCard from "@/components/ui/StatCard";
import { formatDate, TODAY, today } from "@/utils/date";
import { HEALTH_LABEL, STAGE_LABEL, riskLevel } from "@/utils/ui";
import { displayProjectProgress } from "@/features/task/utils/taskTree";
import { canCreateProject, isSystemAdmin } from "@/utils/permission";
import { PROJECT_TEXT, useServerProjectList } from "@/features/project/hooks/useServerProjects";
import type { Health } from "@/types";
import { BUTTON_TEXT } from "@/shared/i18n/catalog/button";
import { PROJECT_SORT_LABEL } from "@/shared/i18n/catalog/status";
import { PROJECT_FOCUS_LABEL } from "@/shared/i18n/catalog/status";
import { METHODOLOGY_LABEL } from "@/shared/i18n/catalog/status";
import type { ProjectCreatedState } from "@/features/project/components/create/ServerProjectCreateWizard";
import { PROJECT_CREATE_TEXT, PROJECT_LIST_TEXT } from "@/features/project/i18n/ko";
import { COMMON_UI_TEXT } from "@/shared/i18n/catalog/common";
import { VISIBILITY_LABEL } from "@/shared/i18n/catalog/status";
import { formatLabel } from "@/shared/i18n/store";
import { useCommonCodes } from "@/shared/codes/useCommonCodes";
import { RISK_LEVEL_TO_HEALTH } from "@/shared/codes/codeStore";

type SortKey = "risk" | "progressDesc" | "progressAsc" | "endDate" | "name";
type FocusKey = "all" | "ongoing" | "late" | "done";

const FOCUS_LABEL: Record<FocusKey, string> = PROJECT_FOCUS_LABEL;

function readFocus(value: string | null): FocusKey {
  return value === "ongoing" || value === "late" || value === "done" ? value : "all";
}

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "risk", get label() { return PROJECT_SORT_LABEL.risk; } },
  { key: "endDate", get label() { return PROJECT_SORT_LABEL.endDate; } },
  { key: "progressDesc", get label() { return PROJECT_SORT_LABEL.progressDesc; } },
  { key: "progressAsc", get label() { return PROJECT_SORT_LABEL.progressAsc; } },
  { key: "name", get label() { return PROJECT_SORT_LABEL.name; } },
];

export default function ProjectsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { projects: allProjects, tasks, users, currentUser } = useDemoStore();
  // api 모드 생성 화면이 서버 생성 성공 뒤에만 넘겨 주는 안내. 이 화면은 들어올 때 서버 목록을 다시 받는다.
  const created = (location.state as Partial<ProjectCreatedState> | null)?.projectCreated ?? null;
  const dismissCreated = () => navigate(location.pathname + location.search, { replace: true, state: null });
  // api 모드: 서버 목록(GET /api/projects)을 받아 화면 프로젝트로 연결하고, 서버 프로젝트만 보여준다.
  const { isApi, state: listState, reload: reloadList } = useServerProjectList();
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
  const baseToday = isApi ? today() : TODAY;
  const projects = useMemo(
    () => (isApi ? allProjects.filter((project) => project.serverId !== undefined) : allProjects),
    [isApi, allProjects],
  );
  const allowCreate = canCreateProject(currentUser);
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [focus, setFocus] = useState<FocusKey>(() => readFocus(searchParams.get("focus")));
  const [status, setStatus] = useState<"all" | Health>("all");
  const [dept, setDept] = useState("all");
  const [pm, setPm] = useState("all");
  const [risk, setRisk] = useState<"all" | Health>("all");
  const [sort, setSort] = useState<SortKey>("risk");

  const depts = Array.from(new Set(projects.map((p) => p.dept)));
  const pmList = users.filter((u) => projects.some((p) => p.pmId === u.id));

  const rows = useMemo(() => {
    const filtered = projects.filter((project) => {
      const keyword = search.trim().toLowerCase();
      const matchesKeyword =
        !keyword ||
        project.name.toLowerCase().includes(keyword) ||
        project.code.toLowerCase().includes(keyword) ||
        project.dept.toLowerCase().includes(keyword);
      const matchesStatus = status === "all" || project.status === status;
      const matchesDept = dept === "all" || project.dept === dept;
      const matchesPm = pm === "all" || project.pmId === pm;
      const matchesRisk = risk === "all" || riskLevel(project.riskScore) === risk;
      const late = project.status !== "done" && project.endDate < baseToday;
      const matchesFocus =
        focus === "all" ||
        (focus === "done" && project.status === "done") ||
        (focus === "late" && late) ||
        (focus === "ongoing" && project.status !== "done" && !late);
      return matchesKeyword && matchesStatus && matchesDept && matchesPm && matchesRisk && matchesFocus;
    });

    const withProgress = filtered.map((project) => ({
      project,
      progress: displayProjectProgress(tasks, project),
      pmUser: users.find((u) => u.id === project.pmId),
    }));

    withProgress.sort((a, b) => {
      if (sort === "risk") return b.project.riskScore - a.project.riskScore;
      // 진척률을 아직 모르는 서버 프로젝트(null)는 어느 정렬에서든 뒤로 보낸다
      if ((sort === "progressDesc" || sort === "progressAsc") && (a.progress === null || b.progress === null)) {
        return a.progress === null ? (b.progress === null ? 0 : 1) : -1;
      }
      if (sort === "progressDesc") return (b.progress ?? 0) - (a.progress ?? 0);
      if (sort === "progressAsc") return (a.progress ?? 0) - (b.progress ?? 0);
      if (sort === "endDate") return a.project.endDate < b.project.endDate ? -1 : 1;
      return a.project.name.localeCompare(b.project.name, "ko");
    });
    return withProgress;
  }, [projects, tasks, users, search, status, dept, pm, risk, focus, sort, baseToday]);

  const counts = useMemo(() => {
    const done = projects.filter((p) => p.status === "done").length;
    const late = projects.filter((p) => p.status !== "done" && p.endDate < baseToday).length;
    return {
      total: projects.length,
      ongoing: projects.length - done - late,
      late,
      done,
    };
  }, [projects, baseToday]);

  const resetFilters = () => {
    setSearch("");
    setStatus("all");
    setDept("all");
    setPm("all");
    setRisk("all");
    setSort("risk");
    setFocus("all");
  };

  return (
    <div className="space-y-4">
      {created && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-[12px] text-emerald-800"
        >
          <span>
            <i className="ri-checkbox-circle-line mr-1" aria-hidden="true" />
            {formatLabel(PROJECT_CREATE_TEXT.created, { name: created.name })}
          </span>
          <span className="flex items-center gap-3">
            <Link to={`/projects/${created.id}`} className="font-medium underline underline-offset-2">
              {PROJECT_CREATE_TEXT.openCreated}
            </Link>
            <button type="button" className="underline underline-offset-2" onClick={dismissCreated}>
              {BUTTON_TEXT.close}
            </button>
          </span>
        </div>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[12px] text-foreground-500">
            {formatLabel(isApi ? PROJECT_LIST_TEXT.visibleCountApi : PROJECT_LIST_TEXT.visibleCountDemo, {
              count: projects.length,
            })}{" "}
            · {PROJECT_LIST_TEXT.progressFormulaNote}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-outline" onClick={resetFilters}>
            <i className="ri-refresh-line" />
            {BUTTON_TEXT.resetFilters}
          </button>
          {allowCreate ? (
            <button type="button" className="btn-primary" onClick={() => navigate("/projects/new")}>
              <i className="ri-add-line" />
              {BUTTON_TEXT.createProject}
            </button>
          ) : (
            <button type="button" className="btn-outline" disabled title={BUTTON_TEXT.hintCreateProjectUserOnly}>
              <i className="ri-lock-line" />
              {BUTTON_TEXT.noCreatePermission}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {([
          { key: "all", label: PROJECT_FOCUS_LABEL.all, value: counts.total, hint: PROJECT_LIST_TEXT.hintAll, tone: "default" },
          { key: "ongoing", label: PROJECT_FOCUS_LABEL.ongoing, value: counts.ongoing, hint: PROJECT_LIST_TEXT.hintOngoing, tone: "primary" },
          { key: "late", label: PROJECT_FOCUS_LABEL.late, value: counts.late, hint: PROJECT_LIST_TEXT.hintLate, tone: "danger" },
          { key: "done", label: PROJECT_FOCUS_LABEL.done, value: counts.done, hint: PROJECT_LIST_TEXT.hintDone, tone: "success" },
        ] as { key: FocusKey; label: string; value: number; hint: string; tone: "default" | "primary" | "danger" | "success" }[]).map((card) => (
          <div key={card.key} className={`rounded-xl ${focus === card.key ? "ring-2 ring-primary-300" : ""}`}>
            <StatCard
              label={card.label}
              value={card.value}
              unit={COMMON_UI_TEXT.countUnit}
              hint={card.hint}
              tone={card.tone}
              onClick={() => setFocus(card.key)}
            />
          </div>
        ))}
      </div>
      {focus !== "all" && (
        <p className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-foreground-600">
          <i className="ri-filter-3-line" />
          <span className="rounded-full border border-primary-200 bg-primary-50 px-2 py-[2px] text-[10.5px] font-medium text-primary-700">
            {FOCUS_LABEL[focus]}
          </span>
          {PROJECT_LIST_TEXT.focusAppliedSuffix}
          <button
            type="button"
            onClick={() => setFocus("all")}
            className="cursor-pointer font-medium text-primary-600 hover:text-primary-700"
          >
            {BUTTON_TEXT.release}
          </button>
        </p>
      )}

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-background-200 px-4 py-3">
          <div className="relative min-w-[220px] flex-1">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-foreground-400" />
            <input
              className="field pl-8 text-[12.5px]"
              placeholder={PROJECT_LIST_TEXT.searchPlaceholder}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <select className="field w-auto min-w-[104px] text-[12.5px]" value={status} onChange={(e) => setStatus(e.target.value as "all" | Health)}>
            <option value="all">{PROJECT_LIST_TEXT.allStatuses}</option>
            {statusOptions.map(({ key, label }) => (
              <option key={key} value={key}>
                {label}
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
            <option value="all">{PROJECT_LIST_TEXT.allRisks}</option>
            {riskOptions.map(({ key, label }) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <select className="field w-auto min-w-[130px] text-[12.5px]" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            {SORT_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {listState.phase === "loading" ? (
          <p role="status" className="px-4 py-12 text-center text-sm text-foreground-500">
            {PROJECT_TEXT.loading}
          </p>
        ) : listState.phase === "error" ? (
          <div role="alert" className="px-4 py-12 text-center">
            <p className="text-sm font-medium text-foreground-900">{PROJECT_TEXT.loadListFailed}</p>
            <p className="mt-1 text-xs text-foreground-600">{listState.message}</p>
            <button type="button" className="btn-outline mt-3" onClick={reloadList}>
              {PROJECT_TEXT.retry}
            </button>
          </div>
        ) : projects.length === 0 ? (
          <EmptyState
            icon="ri-folder-open-line"
            title={PROJECT_LIST_TEXT.emptyTitle}
            description={
              isSystemAdmin(currentUser)
                ? PROJECT_LIST_TEXT.emptyAdminDescription
                : PROJECT_LIST_TEXT.emptyUserDescription
            }
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon="ri-search-eye-line"
            title={PROJECT_LIST_TEXT.noMatchTitle}
            description={PROJECT_LIST_TEXT.noMatchDescription}
            action={
              <button type="button" className="btn-outline" onClick={resetFilters}>
                {BUTTON_TEXT.resetFilters}
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1020px] border-collapse">
              <thead>
                <tr>
                  <th className="th">{PROJECT_LIST_TEXT.colNameCode}</th>
                  <th className="th w-[116px]">{PROJECT_LIST_TEXT.colDepartment}</th>
                  <th className="th w-[102px]">{PROJECT_LIST_TEXT.colPm}</th>
                  <th className="th w-[92px]">{PROJECT_LIST_TEXT.colMethodology}</th>
                  <th className="th w-[82px]">{PROJECT_LIST_TEXT.colStage}</th>
                  <th className="th w-[184px]">{PROJECT_LIST_TEXT.colPeriod}</th>
                  <th className="th w-[152px]">{PROJECT_LIST_TEXT.colProgress}</th>
                  <th className="th w-[88px]">{PROJECT_LIST_TEXT.colStatus}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ project, progress, pmUser }) => (
                  <tr
                    key={project.id}
                    onClick={() => navigate(`/projects/${project.id}`)}
                    className="cursor-pointer border-b border-background-200 last:border-0 hover:bg-background-100"
                  >
                    <td className="td">
                      <p className="font-medium text-foreground-950">{project.name}</p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-foreground-500">
                        <span className="font-mono">{project.code}</span>
                        {project.visibility === "members" && (
                          <Badge className="border-background-300 bg-background-100 text-foreground-500">{VISIBILITY_LABEL.members}</Badge>
                        )}
                      </p>
                    </td>
                    <td className="td text-[12px]">{project.dept}</td>
                    <td className="td">
                      <span className="flex items-center gap-1.5">
                        <Avatar name={pmUser?.name || "?"} size="xs" />
                        <span className="text-[12px]">{pmUser?.name}</span>
                      </span>
                    </td>
                    <td className="td text-[12px]">{METHODOLOGY_LABEL[project.method]}</td>
                    <td className="td">
                      {project.serverId !== undefined && !project.serverStageKnown ? (
                        // 목록 API에는 단계 정보가 없어, 상세에서 단계를 받기 전에는 표시하지 않는다.
                        <span className="text-[12px] text-foreground-400" title={PROJECT_LIST_TEXT.stageUnknownHint}>
                          -
                        </span>
                      ) : (
                        <Badge className="border-primary-200 bg-primary-50 text-primary-700">{STAGE_LABEL[project.stage]}</Badge>
                      )}
                    </td>
                    <td className="td text-[11.5px] text-foreground-600">
                      {formatDate(project.startDate)} ~ {formatDate(project.endDate)}
                    </td>
                    <td className="td">
                      <ProgressBar value={progress} showLabel />
                    </td>
                    <td className="td">
                      <RiskScoreBadge score={project.riskScore} health={project.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-background-200 bg-background-100 px-4 py-2.5 text-[11.5px] text-foreground-500">
          <span>
            {formatLabel(PROJECT_LIST_TEXT.footerCount, { total: projects.length, shown: rows.length })}
          </span>
          <span>{PROJECT_LIST_TEXT.footerRowHint}</span>
        </div>
      </section>
    </div>
  );
}