import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useDemoStore } from "@/stores/DemoStore";
import { Badge } from "@/components/ui/Badge";
import Avatar from "@/components/ui/Avatar";
import EmptyState from "@/components/ui/EmptyState";
import { collectMissing, MISSING_LABEL, type MissingType } from "@/utils/business";
import { formatDate, TODAY } from "@/utils/date";
import { STAGE_LABEL } from "@/utils/ui";
import { BUTTON_TEXT } from "@/shared/i18n/catalog/button";
import { MISSING_TAB_TEXT } from "@/shared/i18n/catalog/menu";

const TABS: { key: "all" | MissingType; label: string; icon: string }[] = [
  { key: "all", icon: "ri-list-check", get label() { return MISSING_TAB_TEXT.all; } },
  { key: "meeting", icon: "ri-file-text-line", get label() { return MISSING_TAB_TEXT.meeting; } },
  { key: "unassigned", icon: "ri-user-unfollow-line", get label() { return MISSING_TAB_TEXT.unassigned; } },
  { key: "overdue", icon: "ri-alarm-warning-line", get label() { return MISSING_TAB_TEXT.overdue; } },
  { key: "stale", icon: "ri-time-line", get label() { return MISSING_TAB_TEXT.stale; } },
];

export default function MissingPage() {
  const { projectId } = useParams();
  const { projects, tasks, meetings, journals, users, currentUser, openTask } = useDemoStore();
  const project = projects.find((p) => p.id === projectId);
  const isPm = project?.pmId === currentUser.id;
  const [tab, setTab] = useState<"all" | MissingType>("all");

  const items = useMemo(() => {
    if (!project) return [];
    return collectMissing(project, tasks, meetings, journals, currentUser, Boolean(isPm));
  }, [project, tasks, meetings, journals, currentUser, isPm]);

  if (!project) return null;

  const counts = {
    all: items.length,
    meeting: items.filter((i) => i.type === "meeting").length,
    unassigned: items.filter((i) => i.type === "unassigned").length,
    overdue: items.filter((i) => i.type === "overdue").length,
    stale: items.filter((i) => i.type === "stale").length,
  };
  const filtered = tab === "all" ? items : items.filter((i) => i.type === tab);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div>
          <h3 className="text-[14px] font-semibold text-foreground-950">누락 의심 업무</h3>
          <p className="mt-0.5 text-[11.5px] text-foreground-500">
            {isPm ? "PM은 프로젝트 전체 항목을 조회합니다." : "멤버는 본인에게 배정된 항목만 조회합니다."} 기준일 {formatDate(TODAY)}
          </p>
        </div>
        <Badge className={isPm ? "border-primary-200 bg-primary-50 text-primary-700" : "border-background-300 bg-background-100 text-foreground-600"}>
          <i className="ri-shield-user-line" /> {isPm ? "PM 전체 조회" : "본인 항목만"}
        </Badge>
      </div>

      <div className="card flex flex-wrap items-center gap-1 p-1">
        {TABS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => setTab(entry.key)}
            className={`flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[11.5px] font-medium transition ${
              tab === entry.key
                ? "bg-primary-500 text-background-50 shadow-sm"
                : "text-foreground-600 hover:bg-background-100"
            }`}
          >
            <i className={entry.icon} />
            {entry.label}
            <span className={`rounded-full px-1.5 text-[10px] tabular-nums ${tab === entry.key ? "bg-background-50/25 text-background-50" : "bg-background-200 text-foreground-600"}`}>
              {counts[entry.key]}
            </span>
          </button>
        ))}
      </div>

      <section className="card overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            icon="ri-checkbox-circle-line"
            title="누락 의심 항목이 없습니다"
            description={tab === "all" ? "현재 기준으로 확인된 누락 의심 업무가 없습니다." : "선택한 사유에 해당하는 항목이 없습니다."}
          />
        ) : (
          <ul className="divide-y divide-background-200">
            {filtered.map((item) => {
              const assignee = users.find((u) => u.id === item.assigneeId);
              return (
                <li key={item.key} className="flex flex-wrap items-start gap-2.5 px-4 py-3">
                  <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] ${
                    item.type === "overdue" ? "bg-rose-50 text-rose-600" : item.type === "unassigned" ? "bg-amber-50 text-amber-600" : item.type === "stale" ? "bg-primary-50 text-primary-600" : "bg-background-100 text-foreground-500"
                  }`}>
                    <i className={TABS.find((t) => t.key === item.type)?.icon || "ri-question-line"} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[12.5px] font-medium text-foreground-900">{item.title}</span>
                      <Badge className="border-background-300 bg-background-100 text-foreground-600">{MISSING_LABEL[item.type]}</Badge>
                      {item.stage && <span className="text-[10.5px] text-foreground-500">{STAGE_LABEL[item.stage as keyof typeof STAGE_LABEL]}</span>}
                    </div>
                    <p className="mt-0.5 text-[11px] text-foreground-600">{item.reason}</p>
                    <p className="text-[10.5px] text-foreground-500">{item.detail}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[10.5px] text-foreground-500">
                      <span className="flex items-center gap-1">
                        {assignee ? <Avatar name={assignee.name} size="xs" /> : <i className="ri-user-unfollow-line" />}
                        {assignee?.name || "담당자 미지정"}
                      </span>
                      <span>기한 {formatDate(item.dueDate)}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {item.taskId && (
                      <>
                        <button
                          type="button"
                          className="btn-outline py-1.5 text-[11px]"
                          onClick={() => openTask(item.taskId!)}
                        >
                          <i className="ri-side-bar-line" /> {BUTTON_TEXT.taskDetail}
                        </button>
                        <Link to={`/projects/${project.id}/wbs`} className="btn-ghost py-1.5 text-[11px]">
                          <i className="ri-node-tree" /> WBS
                        </Link>
                      </>
                    )}
                    {item.meetingId && (
                      <Link to={`/projects/${project.id}/collab/meeting?meeting=${item.meetingId}`} className="btn-outline py-1.5 text-[11px]">
                        <i className="ri-file-text-line" /> 회의록 원본
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="rounded-lg border border-background-200 bg-background-50 px-3 py-2 text-[10.5px] leading-4 text-foreground-500">
        ‘진척 기록 없음’은 진행 중 업무 중 기본 3영업일 동안 진척률 변경이나 업무일지 기록이 없는 경우를 의미합니다. 공휴일은 반영하지 않는 데모 규칙입니다.
      </p>
    </div>
  );
}