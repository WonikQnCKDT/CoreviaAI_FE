import { useEffect, useMemo, useRef, useState } from "react";
import TodoTab from "@/features/mywork/components/TodoTab";
import ApprovalTab from "@/features/mywork/components/ApprovalTab";
import CalendarTab from "@/features/mywork/components/CalendarTab";
import JournalTab from "@/features/mywork/components/JournalTab";
import AddTaskModal from "@/features/mywork/components/AddTaskModal";
import KpiCard from "@/features/mywork/components/KpiCard";
import TabBar from "@/components/ui/TabBar";
import { useDemoStore } from "@/stores/DemoStore";
import { useAuth } from "@/features/auth/authContext";
import ServerMyWorkPage from "@/features/mywork/components/ServerMyWorkPage";
import { diffDays, TODAY } from "@/utils/date";
import { isAssignedTo } from "@/utils/assignee";
import { approvalRequestsForUser } from "@/features/gate/utils/gate";
import { loadTaskFilter, saveTaskFilter, type TaskFilter } from "@/features/mywork/utils/filters";
import { useScrollMemory } from "@/hooks/useScrollMemory";
import { BUTTON_TEXT } from "@/shared/i18n/catalog/button";
import { MYWORK_TAB_TEXT } from "@/shared/i18n/catalog/menu";

type TabKey = "todo" | "approval" | "calendar" | "journal";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "todo", icon: "ri-checkbox-multiple-line", get label() { return MYWORK_TAB_TEXT.todo; } },
  { key: "approval", icon: "ri-shield-check-line", get label() { return MYWORK_TAB_TEXT.approval; } },
  { key: "calendar", icon: "ri-calendar-line", get label() { return MYWORK_TAB_TEXT.calendar; } },
  { key: "journal", icon: "ri-file-text-line", get label() { return MYWORK_TAB_TEXT.journal; } },
];

const TAB_STORAGE_KEY = "corevia-mywork-tab";

function loadTab(): TabKey {
  try {
    const raw = sessionStorage.getItem(TAB_STORAGE_KEY);
    if (raw === "todo" || raw === "approval" || raw === "calendar" || raw === "journal") return raw;
  } catch {
    // 저장된 탭을 읽지 못하면 TODO로 시작합니다.
  }
  return "todo";
}

function saveTab(tab: TabKey) {
  try {
    sessionStorage.setItem(TAB_STORAGE_KEY, tab);
  } catch {
    // 무시
  }
}

function DemoMyWorkPage() {
  const { tasks, projects, deliverables, currentUser } = useDemoStore();
  const [tab, setTab] = useState<TabKey>(loadTab);
  const [addOpen, setAddOpen] = useState(false);
  const [journalRequest, setJournalRequest] = useState(0);
  const [filter, setFilter] = useState<TaskFilter>(loadTaskFilter);
  const listRef = useRef<HTMLDivElement | null>(null);
  // 탭·필터·스크롤 위치를 기억해 다른 화면에서 돌아왔을 때 그대로 복원합니다.
  useScrollMemory("/");

  useEffect(() => {
    saveTaskFilter(filter);
  }, [filter]);

  useEffect(() => {
    saveTab(tab);
  }, [tab]);

  const myTasks = useMemo(() => tasks.filter((t) => isAssignedTo(t, currentUser.id)), [tasks, currentUser.id]);
  const approvalRequests = useMemo(
    () => approvalRequestsForUser(projects, deliverables, currentUser.id),
    [projects, deliverables, currentUser.id],
  );

  const stats = useMemo(() => {
    const today = myTasks.filter((t) => t.endDate === TODAY && t.status !== "done").length;
    const soon = myTasks.filter((t) => {
      const dday = diffDays(TODAY, t.endDate);
      return dday > 0 && dday <= 3 && t.status !== "done";
    }).length;
    const late = myTasks.filter((t) => t.endDate < TODAY && t.status !== "done").length;
    const open = myTasks.filter((t) => t.status !== "done").length;
    const done = myTasks.filter((t) => t.status === "done").length;
    return { today, soon, late, open, done };
  }, [myTasks]);

  const applyFilter = (next: TaskFilter) => {
    setFilter(next);
    setTab("todo");
    window.requestAnimationFrame(() => {
      listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const tabItems = TABS.map((item) => ({
    key: item.key,
    label: item.label,
    icon: item.icon,
    count: item.key === "todo" ? stats.open : item.key === "approval" ? approvalRequests.length : undefined,
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          icon="ri-calendar-check-line"
          label="오늘 할 일"
          value={stats.today}
          hint="오늘 마감인 미완료 업무입니다. 선택하면 해당 업무만 표시합니다."
          tone="warning"
          active={filter === "today"}
          onClick={() => applyFilter("today")}
        />
        <KpiCard
          icon="ri-time-line"
          label="마감 임박"
          value={stats.soon}
          hint="1~3일 안에 마감되는 미완료 업무입니다. 선택하면 해당 업무만 표시합니다."
          tone="primary"
          active={filter === "soon"}
          onClick={() => applyFilter("soon")}
        />
        <KpiCard
          icon="ri-alarm-warning-line"
          label="지연 업무"
          value={stats.late}
          hint="마감일이 지난 미완료 업무입니다. 선택하면 해당 업무만 표시합니다."
          tone="danger"
          active={filter === "late"}
          onClick={() => applyFilter("late")}
        />
        <KpiCard
          icon="ri-checkbox-circle-line"
          label="완료 업무"
          value={stats.done}
          hint="완료 처리한 업무입니다. 선택하면 완료 업무만 표시합니다."
          tone="success"
          active={filter === "done"}
          onClick={() => applyFilter("done")}
        />
      </div>

      <TabBar
        items={tabItems}
        activeKey={tab}
        onChange={(key) => setTab(key as TabKey)}
        ariaLabel={MYWORK_TAB_TEXT.views}
        meta={
          <>
            <button
              type="button"
              className="btn-outline whitespace-nowrap"
              onClick={() => {
                setTab("journal");
                setJournalRequest((prev) => prev + 1);
              }}
            >
              <i className="ri-edit-2-line" />
              {BUTTON_TEXT.writeJournal}
            </button>
            <button type="button" className="btn-primary whitespace-nowrap" onClick={() => setAddOpen(true)}>
              <i className="ri-add-line" />
              {BUTTON_TEXT.addTodo}
            </button>
          </>
        }
      />

      <div ref={listRef} className="scroll-mt-20">
        {tab === "todo" && <TodoTab onAddTask={() => setAddOpen(true)} filter={filter} onFilterChange={setFilter} />}
        {tab === "approval" && <ApprovalTab />}
        {tab === "calendar" && <CalendarTab />}
        {tab === "journal" && <JournalTab focusRequest={journalRequest} />}
      </div>

      <AddTaskModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}

/**
 * api 모드는 서버 내 TODO API(06. 개인 업무)로 그린다. 데모 업무를 서버 계정의 할 일로 보이지 않게 한다.
 * 데모 모드는 기존 화면을 그대로 쓴다.
 */
export default function MyWorkPage() {
  const { mode } = useAuth();
  return mode === "api" ? <ServerMyWorkPage /> : <DemoMyWorkPage />;
}
