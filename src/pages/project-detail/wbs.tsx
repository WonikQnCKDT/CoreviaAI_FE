import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useDemoStore } from "@/stores/DemoStore";
import AssigneeStack from "@/components/ui/AssigneeStack";
import { assigneeIdsOf } from "@/utils/assignee";
import ProgressBar from "@/components/ui/ProgressBar";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import InfoTip from "@/components/ui/InfoTip";
import { EFFORT_TOOLTIP, effortDetailText, effortUnitText } from "@/features/task/utils/effort";
import EmptyState from "@/components/ui/EmptyState";
import TaskFormModal from "@/features/task/components/TaskFormModal";
import PredecessorModal from "@/features/task/components/PredecessorModal";
import WorkPlanTabs from "@/features/task/components/WorkPlanTabs";
import { ddayLabel, diffDays, formatShort, TODAY } from "@/utils/date";import { STAGES, STAGE_LABEL } from "@/utils/ui";
import { childrenOf, isLateTask, isMissingTask, rollupMap } from "@/features/task/utils/taskTree";
import type { StageKey, Task } from "@/types";
import { BUTTON_TEXT } from "@/shared/i18n/catalog/button";

interface FormContext {
  stage: StageKey;
  parentId: string | null;
  parentName?: string;
}

export default function WbsPage() {
  const { projectId } = useParams();
  const { projects, tasks, users, openTask, moveTask, setTaskStatus } = useDemoStore();
  const project = projects.find((p) => p.id === projectId);

  const [collapsedStages, setCollapsedStages] = useState<StageKey[]>([]);
  const [collapsedParents, setCollapsedParents] = useState<string[]>([]);
  const [formContext, setFormContext] = useState<FormContext | null>(null);
  const [predTaskId, setPredTaskId] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const stageParam = searchParams.get("stage");
  const focusStage = STAGES.some((s) => s.key === stageParam) ? (stageParam as StageKey) : null;
  const stageRowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  const projectTasks = useMemo(() => tasks.filter((t) => t.projectId === projectId), [tasks, projectId]);
  const rollup = useMemo(() => rollupMap(projectTasks), [projectTasks]);

  // 상단 단계를 눌러 들어오면 해당 단계를 펼치고 제목이 보이는 위치로 이동합니다.
  // 업무 순서·데이터는 변경하지 않습니다.
  useEffect(() => {
    if (!focusStage) return;
    setCollapsedStages((prev) => (prev.includes(focusStage) ? prev.filter((s) => s !== focusStage) : prev));
    const timer = window.setTimeout(() => {
      const element = stageRowRefs.current[focusStage];
      if (!element) return;
      const top = element.getBoundingClientRect().top + window.scrollY - 104;
      window.scrollTo({ top: Math.max(top, 0), behavior: "smooth" });
    }, 140);
    return () => window.clearTimeout(timer);
  }, [focusStage]);

  if (!project) return null;

  const toggleStage = (stage: StageKey) => {
    setCollapsedStages((prev) => (prev.includes(stage) ? prev.filter((s) => s !== stage) : [...prev, stage]));
  };

  const toggleParent = (id: string) => {
    setCollapsedParents((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  };

  const stageSummary = (stage: StageKey) => {
    const stageTasks = projectTasks.filter((t) => t.stage === stage && t.level === 2);
    const estimate = stageTasks.reduce((sum, t) => sum + (rollup[t.id]?.estimate || 0), 0);
    const dated = stageTasks.map((t) => rollup[t.id]).filter(Boolean);
    const start = dated.reduce((min, cur) => (cur.startDate < min ? cur.startDate : min), dated[0]?.startDate || project.startDate);
    const end = dated.reduce((max, cur) => (cur.endDate > max ? cur.endDate : max), dated[0]?.endDate || project.endDate);
    const progress = estimate > 0
      ? Math.round(stageTasks.reduce((sum, t) => sum + (rollup[t.id]?.progress || 0) * (rollup[t.id]?.estimate || 0), 0) / estimate)
      : 0;
    return { stageTasks, estimate, start, end, progress };
  };

  const totalEstimate = STAGES.reduce((sum, stage) => sum + stageSummary(stage.key).estimate, 0);
  const lateCount = projectTasks.filter((t) => isLateTask(t, TODAY)).length;
  const missingCount = projectTasks.filter((t) => isMissingTask(t, TODAY)).length;

  const handleStatusChange = (task: Task) => {
    setTaskStatus(task.id, task.status === "done" ? "progress" : "done");
  };

  const renderTaskRow = (task: Task) => {
    const rollupValue = rollup[task.id];
    const children = childrenOf(projectTasks, task.id);
    const parent = task.parentId ? projectTasks.find((t) => t.id === task.parentId) : null;
    const siblings = projectTasks
      .filter((t) => t.projectId === task.projectId && t.stage === task.stage && t.parentId === task.parentId && t.level === task.level)
      .sort((a, b) => a.order - b.order);
    const index = siblings.findIndex((t) => t.id === task.id);
    const late = isLateTask(task, TODAY);
    const isCollapsed = collapsedParents.includes(task.id);

    return (
      <tr
        key={task.id}
        onClick={() => openTask(task.id)}
        className={`group cursor-pointer border-b border-background-200 hover:bg-background-100 ${late ? "bg-rose-50/40" : ""}`}
      >
        <td className="td">
          <div className={`flex items-start gap-1.5 ${task.level === 3 ? "pl-9" : "pl-2"}`}>
            {task.level === 2 && children.length > 0 ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleParent(task.id);
                }}
                aria-label={BUTTON_TEXT.collapseSubtasks}
                className="mt-0.5 flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded text-foreground-500 hover:bg-background-200"
              >
                <i className={isCollapsed ? "ri-arrow-right-s-line text-[13px]" : "ri-arrow-down-s-line text-[13px]"} />
              </button>
            ) : (
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center text-foreground-300">
                <i className={task.level === 3 ? "ri-corner-down-right-line text-[11px]" : "ri-node-tree text-[11px]"} />
              </span>
            )}
            <div
              className="min-w-0"
              title={`${parent ? `상위 · ${parent.name}` : STAGE_LABEL[task.stage || "analysis"]} · ${task.level === 2 ? "작업" : "하위작업"}${
                rollupValue && task.level === 2 && children.length > 0 ? " · 기간·진척률 자동 계산" : ""
              }`}
            >
              <p className="flex flex-wrap items-center gap-1.5">
                <span className={`text-[12.5px] ${task.level === 2 ? "font-medium text-foreground-950" : "text-foreground-800"}`}>
                  {task.name}
                </span>
                {task.type === "defect" && <Badge className="border-rose-200 bg-rose-50 text-rose-700">결함</Badge>}
                {late && <Badge className="border-rose-200 bg-rose-50 text-rose-600">지연</Badge>}
                {isMissingTask(task, TODAY) && (
                  <Badge className="border-amber-200 bg-amber-50 text-amber-700">누락 의심</Badge>
                )}
              </p>
            </div>
          </div>
        </td>
        <td className="td whitespace-nowrap">
          <AssigneeStack userIds={assigneeIdsOf(task)} users={users} max={2} />
        </td>
        <td className="td whitespace-nowrap text-[11.5px] text-foreground-600">
          {formatShort(rollupValue?.startDate)}
        </td>
        <td className={`td whitespace-nowrap text-[11.5px] ${late ? "font-medium text-rose-600" : "text-foreground-600"}`}>
          {formatShort(rollupValue?.endDate)}
        </td>
        <td
          className="td whitespace-nowrap text-right text-[11.5px] tabular-nums text-foreground-700"
          title={effortDetailText(rollupValue?.estimate ?? task.estimate)}
        >
          {effortUnitText(rollupValue?.estimate ?? task.estimate)}
        </td>
        <td className="td">
          <ProgressBar
            value={rollupValue?.progress ?? task.progress}
            showLabel
            color={task.status === "done" ? "bg-emerald-500" : late ? "bg-rose-500" : "bg-primary-500"}
          />
        </td>
        <td className="td">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleStatusChange(task);
            }}
            title={BUTTON_TEXT.hintClickToChangeStatus}
            className="cursor-pointer"
          >
            <StatusBadge status={task.status} />
          </button>
        </td>
        <td className="td">
          <div className="flex flex-wrap items-center gap-1">
            {task.predecessors.length === 0 ? (
              <span className="text-[11px] text-foreground-400">없음</span>
            ) : (
              <span className="truncate text-[11px] text-foreground-600" title={task.predecessors.map((id) => projectTasks.find((t) => t.id === id)?.name).join(", ")}>
                {projectTasks.find((t) => t.id === task.predecessors[0])?.name || "연결"}
                {task.predecessors.length > 1 ? ` 외 ${task.predecessors.length - 1}` : ""}
              </span>
            )}
          </div>
        </td>
        <td className="td">
          <div className="flex items-center justify-end gap-0.5 opacity-60 transition group-hover:opacity-100">
            <button
              type="button"
              title={BUTTON_TEXT.moveUp}
              disabled={index <= 0}
              onClick={(e) => {
                e.stopPropagation();
                moveTask(task.id, "up");
              }}
              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-foreground-500 hover:bg-background-200 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <i className="ri-arrow-up-s-line text-[13px]" />
            </button>
            <button
              type="button"
              title={BUTTON_TEXT.moveDown}
              disabled={index < 0 || index >= siblings.length - 1}
              onClick={(e) => {
                e.stopPropagation();
                moveTask(task.id, "down");
              }}
              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-foreground-500 hover:bg-background-200 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <i className="ri-arrow-down-s-line text-[13px]" />
            </button>
            <button
              type="button"
              title={BUTTON_TEXT.indent}
              disabled={task.level !== 2 || index <= 0}
              onClick={(e) => {
                e.stopPropagation();
                moveTask(task.id, "indent");
              }}
              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-foreground-500 hover:bg-background-200 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <i className="ri-indent-increase text-[13px]" />
            </button>
            <button
              type="button"
              title={BUTTON_TEXT.outdent}
              disabled={task.level !== 3}
              onClick={(e) => {
                e.stopPropagation();
                moveTask(task.id, "outdent");
              }}
              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-foreground-500 hover:bg-background-200 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <i className="ri-indent-decrease text-[13px]" />
            </button>
            <button
              type="button"
              title={BUTTON_TEXT.setPredecessors}
              onClick={(e) => {
                e.stopPropagation();
                setPredTaskId(task.id);
              }}
              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-foreground-500 hover:bg-background-200"
            >
              <i className="ri-link-m text-[13px]" />
            </button>
            {task.level === 2 && (
              <button
                type="button"
                title={BUTTON_TEXT.addSubtask}
                onClick={(e) => {
                  e.stopPropagation();
                  setFormContext({ stage: task.stage || "analysis", parentId: task.id, parentName: task.name });
                }}
                className="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-primary-600 hover:bg-primary-50"
              >
                <i className="ri-add-line text-[14px]" />
              </button>
            )}
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <WorkPlanTabs projectId={project.id} active="wbs" />
        <div className="flex flex-wrap items-center gap-1.5">
          <Link to={`/projects/${project.id}/wbs/draft`} className="btn-outline py-1.5 text-[12px]">
            <i className="ri-sparkling-2-line" /> AI WBS 초안
          </Link>
          <button
            type="button"
            className="btn-primary py-1.5 text-[12px]"
            onClick={() => setFormContext({ stage: project.stage, parentId: null })}
          >
            <i className="ri-add-line" /> {BUTTON_TEXT.addWork}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex items-stretch gap-2">
          <div
            className="flex h-11 min-w-[116px] items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-3"
            title="종료일이 지났는데 완료되지 않은 업무 수"
          >
            <span className="flex items-center gap-1.5 whitespace-nowrap text-[11.5px] font-medium text-rose-700">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                <i className="ri-alarm-warning-line text-[10px]" aria-hidden="true" />
              </span>
              지연
            </span>
            <span className="flex items-baseline gap-0.5 text-rose-700">
              <span className="text-[18px] font-bold leading-none tabular-nums">{lateCount}</span>
              <span className="text-[10.5px] font-semibold leading-none">건</span>
            </span>
          </div>
          <Link
            to={`/projects/${project.id}/missing`}
            className="flex h-11 min-w-[132px] items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 transition hover:border-amber-300 hover:bg-amber-100/70"
            title="담당자 미지정 또는 시작일이 지났는데 진척이 없는 업무 수"
          >
            <span className="flex items-center gap-1.5 whitespace-nowrap text-[11.5px] font-medium text-amber-800">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <i className="ri-question-mark text-[10px]" aria-hidden="true" />
              </span>
              누락 의심
            </span>
            <span className="flex items-baseline gap-0.5 text-amber-800">
              <span className="text-[18px] font-bold leading-none tabular-nums">{missingCount}</span>
              <span className="text-[10.5px] font-semibold leading-none">건</span>
            </span>
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] text-foreground-500">
          <span className="whitespace-nowrap">
            업무 <span className="font-medium tabular-nums text-foreground-700">{projectTasks.length}</span>
          </span>
          <span aria-hidden="true" className="h-3 w-px bg-background-300" />
          <span className="flex items-center gap-1 whitespace-nowrap">
            총 예상 작업량 <span className="tabular-nums text-foreground-700">{effortUnitText(totalEstimate)}</span>
            <InfoTip
              label="WBS 자동 계산 안내"
              text={`${effortDetailText(totalEstimate)} · ${EFFORT_TOOLTIP} 상위 업무의 기간은 하위 작업에서, 진척률은 예상 작업량 가중으로 자동 계산됩니다. 3단계(단계 > 작업 > 하위작업) 구조이며 완료 → 시작 의존관계만 지원합니다.`}
            />
          </span>
        </div>
        <div className="ml-auto flex items-center gap-0.5">
          <button
            type="button"
            title={BUTTON_TEXT.collapseAll}
            aria-label={BUTTON_TEXT.collapseAll}
            onClick={() => setCollapsedParents(projectTasks.filter((t) => t.level === 2).map((t) => t.id))}
            className="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-foreground-500 hover:bg-background-200 hover:text-foreground-900"
          >
            <i className="ri-collapse-vertical-line text-[14px]" aria-hidden="true" />
          </button>
          <button
            type="button"
            title={BUTTON_TEXT.expandAll}
            aria-label={BUTTON_TEXT.expandAll}
            onClick={() => {
              setCollapsedParents([]);
              setCollapsedStages([]);
            }}
            className="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-foreground-500 hover:bg-background-200 hover:text-foreground-900"
          >
            <i className="ri-expand-vertical-line text-[14px]" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-background-300 bg-background-50">
        <table className="w-full min-w-[1080px] border-collapse">
          <thead>
            <tr>
              <th className="th min-w-[270px]">업무명</th>
              <th className="th w-[150px]">담당자</th>
              <th className="th w-[80px]">시작일</th>
              <th className="th w-[80px]">종료일</th>
              <th className="th w-[100px] text-right">
                <span className="inline-flex items-center gap-1">
                  예상 작업량
                  <InfoTip label="예상 작업량 설명" text={EFFORT_TOOLTIP} />
                </span>
              </th>
              <th className="th w-[132px]">진척률</th>
              <th className="th w-[76px]">상태</th>
              <th className="th w-[120px]">선행작업</th>
              <th className="th w-[148px] text-right">관리</th>
            </tr>
          </thead>
          <tbody>
            {projectTasks.length === 0 && (
              <tr>
                <td colSpan={9}>
                  <EmptyState
                    icon="ri-node-tree"
                    title="등록된 업무가 없습니다"
                    description="작업을 추가하면 단계별 계층 구조로 관리할 수 있습니다."
                    action={
                      <button type="button" className="btn-outline" onClick={() => setFormContext({ stage: project.stage, parentId: null })}>
                        <i className="ri-add-line" /> {BUTTON_TEXT.addWork}
                      </button>
                    }
                  />
                </td>
              </tr>
            )}
            {STAGES.map((stage) => {
              const summary = stageSummary(stage.key);
              const milestone = project.milestones.find((m) => m.stage === stage.key);
              const isCollapsed = collapsedStages.includes(stage.key);
              const isCurrent = project.stage === stage.key;
              return (
                <Fragment key={stage.key}>
                  <tr
                    id={`stage-${stage.key}`}
                    ref={(element) => {
                      stageRowRefs.current[stage.key] = element;
                    }}
                    className={`scroll-mt-24 border-b border-background-300 ${
                      focusStage === stage.key || isCurrent ? "bg-primary-50" : "bg-background-100"
                    }`}
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleStage(stage.key)}
                          className="flex h-5 w-5 cursor-pointer items-center justify-center rounded text-foreground-600 hover:bg-background-200"
                          aria-label={BUTTON_TEXT.collapseStage}
                        >
                          <i className={isCollapsed ? "ri-arrow-right-s-line" : "ri-arrow-down-s-line"} />
                        </button>
                        <span className={`flex h-5 w-5 items-center justify-center rounded text-[10px] font-semibold ${isCurrent ? "bg-primary-500 text-background-50" : "bg-background-300 text-foreground-700"}`}>
                          {STAGES.findIndex((s) => s.key === stage.key) + 1}
                        </span>
                        <span className={`text-[12.5px] font-semibold ${isCurrent ? "text-primary-800" : "text-foreground-900"}`}>
                          {stage.label}
                        </span>
                        <span className="text-[10.5px] text-foreground-500">({summary.stageTasks.length})</span>
                        {isCurrent && <Badge className="border-primary-200 bg-background-50 text-primary-700">현재 단계</Badge>}
                        {focusStage === stage.key && (
                          <Badge className="border-primary-300 bg-background-50 text-primary-700">선택한 단계</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-[11px] text-foreground-500">-</td>
                    <td className="px-3 py-2.5 text-[11px] text-foreground-600">{summary.stageTasks.length ? formatShort(summary.start) : "-"}</td>
                    <td className="px-3 py-2.5 text-[11px] text-foreground-600">{summary.stageTasks.length ? formatShort(summary.end) : "-"}</td>
                    <td
                      className="px-3 py-2.5 text-right text-[11px] tabular-nums text-foreground-600"
                      title={effortDetailText(summary.estimate)}
                    >
                      {effortUnitText(summary.estimate)}
                    </td>
                    <td className="px-3 py-2.5">
                      <ProgressBar value={summary.progress} showLabel color={summary.progress >= 100 ? "bg-emerald-500" : "bg-primary-500"} />
                    </td>
                    <td className="px-3 py-2.5">
                      {summary.stageTasks.length > 0 && summary.progress >= 100 ? (
                        <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">완료</Badge>
                      ) : summary.stageTasks.length > 0 ? (
                        <Badge className="border-primary-200 bg-primary-50 text-primary-700">진행</Badge>
                      ) : (
                        <Badge className="border-background-300 bg-background-50 text-foreground-500">대기</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2.5" />
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => setFormContext({ stage: stage.key, parentId: null })}
                          className="flex h-6 items-center gap-1 rounded px-1.5 text-[10.5px] font-medium text-primary-600 hover:bg-primary-50"
                        >
                          <i className="ri-add-line" /> {BUTTON_TEXT.work}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {!isCollapsed && (
                    <>
                      {summary.stageTasks.map((task) => (
                        <Fragment key={task.id}>
                          {renderTaskRow(task)}
                          {!collapsedParents.includes(task.id) &&
                            childrenOf(projectTasks, task.id)
                              .slice()
                              .sort((a, b) => a.order - b.order)
                              .map((child) => renderTaskRow(child))}
                        </Fragment>
                      ))}
                      {milestone && (
                        <tr key={`ms-${milestone.id}`} className="border-b border-background-200 bg-amber-50/40">
                          <td className="px-3 py-2" colSpan={2}>
                            <div className="flex items-center gap-2 pl-8">
                              <i className="ri-flag-2-line text-[12px] text-amber-600" />
                              <span className="text-[11.5px] font-medium text-amber-900">마일스톤 · {milestone.name}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-[11px] text-foreground-500">-</td>
                          <td className="px-3 py-2 text-[11px] font-medium text-amber-800">{formatShort(milestone.date)}</td>
                          <td className="px-3 py-2 text-right text-[11px] text-foreground-500">-</td>
                          <td className="px-3 py-2" />
                          <td className="px-3 py-2">
                            <Badge className={diffDays(TODAY, milestone.date) < 0 ? "border-background-300 bg-background-50 text-foreground-500" : "border-amber-200 bg-background-50 text-amber-700"}>
                              {ddayLabel(milestone.date)}
                            </Badge>
                          </td>
                          <td className="px-3 py-2" />
                          <td className="px-3 py-2" />
                        </tr>
                      )}
                    </>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {formContext && (
        <TaskFormModal
          open={Boolean(formContext)}
          onClose={() => setFormContext(null)}
          projectId={project.id}
          stage={formContext.stage}
          parentId={formContext.parentId}
          parentName={formContext.parentName}
        />
      )}
      {predTaskId && (
        <PredecessorModal open={Boolean(predTaskId)} taskId={predTaskId} onClose={() => setPredTaskId(null)} />
      )}
    </div>
  );
}