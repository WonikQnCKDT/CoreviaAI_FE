import { useRef, useState, type DragEvent } from "react";
import { Badge } from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import ProgressBar from "@/components/ui/ProgressBar";
import WorkPlanTabs from "@/features/task/components/WorkPlanTabs";
import { moveBoardCard, type BoardCard, type BoardColumn } from "@/features/board/api/boardApi";
import BoardColumnsDialog from "@/features/board/components/BoardColumnsDialog";
import ServerTaskDetailDialog from "@/features/board/components/ServerTaskDetailDialog";
import { useServerBoard } from "@/features/board/hooks/useServerBoard";
import { BOARD_TEXT } from "@/features/board/i18n/ko";
import {
  boardViewerNote,
  canManageColumns,
  canMoveCard,
  columnTitle,
  interpretBoardFailure,
  taskPriorityLabel,
  taskTypeLabel,
} from "@/features/board/utils/boardRules";
import { formatLabel } from "@/shared/i18n/store";
import type { Project } from "@/types";

type Notice = { tone: "success" | "error" | "warning"; text: string } | null;

const NOTICE_CLASS = {
  success: "bg-emerald-50 text-emerald-700",
  error: "bg-rose-50 text-rose-700",
  warning: "bg-amber-50 text-amber-800",
} as const;

/**
 * api 모드 칸반 보드(FR-TSK-02). 화면은 언제나 서버 보드를 그린다.
 * 카드를 옮기면 서버가 성공을 응답한 뒤에만 보드를 다시 받아 반영한다(가짜 성공 없음).
 * 드래그가 어려운 환경을 위해 카드마다 '이동' 선택도 둔다.
 */
export default function ServerKanbanView({ project }: { project: Project & { serverId: number } }) {
  const projectId = project.serverId;
  const [phaseId, setPhaseId] = useState<number | null>(null);
  const [assigneeUserId, setAssigneeUserId] = useState<number | null>(null);
  const { state, reload, viewer } = useServerBoard(projectId, assigneeUserId, phaseId);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [detailTaskId, setDetailTaskId] = useState<number | null>(null);
  const [dragging, setDragging] = useState<BoardCard | null>(null);
  const [overColumn, setOverColumn] = useState<number | null>(null);
  const busyRef = useRef(false);

  const hasFilter = phaseId !== null || assigneeUserId !== null;
  const resetFilters = () => {
    setPhaseId(null);
    setAssigneeUserId(null);
  };

  if (state.phase === "loading") return <p role="status" className="py-10 text-center text-[13px] text-foreground-500">{BOARD_TEXT.loading}</p>;
  if (state.phase === "unavailable") return <EmptyState icon="ri-layout-grid-line" title={BOARD_TEXT.unavailable} />;
  if (state.phase === "error") {
    return (
      <EmptyState
        tone="danger"
        icon="ri-error-warning-line"
        title={BOARD_TEXT.loadFailed}
        description={state.message}
        action={
          <div className="flex items-center justify-center gap-2">
            <button type="button" className="btn-outline" onClick={reload}>{BOARD_TEXT.retry}</button>
            {hasFilter && (
              <button type="button" className="btn-outline" onClick={resetFilters}>{BOARD_TEXT.resetFilters}</button>
            )}
          </div>
        }
      />
    );
  }

  const { columns, phases, members } = state;
  const note = boardViewerNote(viewer);
  const cardTotal = columns.reduce((sum, c) => sum + c.cards.length, 0);

  const move = async (card: BoardCard, column: BoardColumn) => {
    const from = columns.find((c) => c.cards.some((k) => k.id === card.id));
    if (busyRef.current || from?.id === column.id) return;
    busyRef.current = true;
    setBusy(true);
    setNotice(null);
    const result = await moveBoardCard({ projectId, taskId: card.id, columnId: column.id, version: card.version });
    busyRef.current = false;
    setBusy(false);
    if (result.ok === true) {
      const title = columnTitle(column);
      setNotice(
        result.data.wipWarning
          ? { tone: "warning", text: formatLabel(BOARD_TEXT.wipWarning, { column: title }) }
          : { tone: "success", text: formatLabel(BOARD_TEXT.moved, { name: card.name, column: title }) },
      );
      reload();
      return;
    }
    const view = interpretBoardFailure("move", result.failure);
    setNotice({ tone: "error", text: view.message });
    if (view.reload) reload();
  };

  const onDrop = (event: DragEvent, column: BoardColumn) => {
    event.preventDefault();
    setOverColumn(null);
    if (dragging) void move(dragging, column);
    setDragging(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <WorkPlanTabs projectId={project.id} active="kanban" />
          <span className="text-[10.5px] text-foreground-500">
            {formatLabel(BOARD_TEXT.cardCount, { count: cardTotal })} · {BOARD_TEXT.dragHint}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {phases.length > 0 && (
            <select
              className="field w-auto min-w-[108px] text-[12px]"
              aria-label={BOARD_TEXT.phaseFilter}
              value={phaseId ?? ""}
              onChange={(e) => setPhaseId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">{BOARD_TEXT.phaseAll}</option>
              {phases.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          <select
            className="field w-auto min-w-[116px] text-[12px]"
            aria-label={BOARD_TEXT.assigneeFilter}
            value={assigneeUserId ?? ""}
            onChange={(e) => setAssigneeUserId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">{BOARD_TEXT.assigneeAll}</option>
            {members.map((m) => <option key={m.userId} value={m.userId}>{m.name}</option>)}
          </select>
          {canManageColumns(viewer) && (
            <button type="button" className="btn-outline" onClick={() => setColumnsOpen(true)}>
              <i className="ri-settings-3-line" /> {BOARD_TEXT.manageColumns}
            </button>
          )}
        </div>
      </div>

      {note && <p className="rounded-md bg-background-100 px-3 py-2 text-[12px] text-foreground-600">{note}</p>}
      {notice && (
        <p role={notice.tone === "error" ? "alert" : "status"} className={`rounded-md px-3 py-2 text-[12px] ${NOTICE_CLASS[notice.tone]}`}>
          {notice.text}
        </p>
      )}

      <div className="flex gap-3 overflow-x-auto pb-2">
        {columns.map((column) => {
          const title = columnTitle(column);
          return (
            <section
              key={column.id}
              aria-label={title}
              className={`flex w-[272px] shrink-0 flex-col rounded-xl border bg-background-100 ${overColumn === column.id ? "border-primary-400" : "border-background-300"}`}
              onDragOver={(e) => {
                if (!dragging) return;
                e.preventDefault();
                setOverColumn(column.id);
              }}
              onDragLeave={() => setOverColumn((prev) => (prev === column.id ? null : prev))}
              onDrop={(e) => onDrop(e, column)}
            >
              <header className="flex items-center justify-between gap-2 border-b border-background-300 px-3 py-2">
                <h3 className="truncate text-[12.5px] font-semibold text-foreground-950" title={title}>{title}</h3>
                <span className="flex items-center gap-1 text-[11px] text-foreground-500">
                  {column.cardCount}
                  {column.wipLimit !== null && <span>/ {formatLabel(BOARD_TEXT.wipLimit, { count: column.wipLimit })}</span>}
                  {column.wipExceeded && <Badge className="border-amber-200 bg-amber-50 text-amber-700">{BOARD_TEXT.wipExceeded}</Badge>}
                </span>
              </header>
              <ul className="flex min-h-[80px] flex-col gap-2 p-2">
                {column.cards.length === 0 && <li className="px-1 py-3 text-center text-[11.5px] text-foreground-500">{BOARD_TEXT.emptyColumn}</li>}
                {column.cards.map((card) => {
                  const movable = canMoveCard(viewer, card);
                  return (
                    <li
                      key={card.id}
                      draggable={movable && !busy}
                      onDragStart={(e) => {
                        if (!movable || busy) return;
                        e.dataTransfer?.setData("text/plain", String(card.id));
                        setDragging(card);
                      }}
                      onDragEnd={() => {
                        setDragging(null);
                        setOverColumn(null);
                      }}
                      className={`rounded-lg border border-background-300 bg-background-50 p-2.5 shadow-card ${movable ? "cursor-grab" : ""}`}
                    >
                      {card.parentTaskName && <p className="truncate text-[10.5px] text-foreground-500">{formatLabel(BOARD_TEXT.subtaskOf, { name: card.parentTaskName })}</p>}
                      <button
                        type="button"
                        className="block w-full text-left text-[12.5px] font-medium text-foreground-950 hover:underline"
                        aria-label={`${BOARD_TEXT.openDetail}: ${card.name}`}
                        onClick={() => setDetailTaskId(card.id)}
                      >
                        {card.name}
                      </button>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[10.5px]">
                        <Badge className={card.taskType === "defect" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-background-300 text-foreground-600"}>{taskTypeLabel(card.taskType)}</Badge>
                        <Badge className="border-background-300 text-foreground-600">{taskPriorityLabel(card.priority)}</Badge>
                        <span className="text-foreground-600">{card.assignee ? card.assignee.name || `#${card.assignee.id}` : BOARD_TEXT.unassigned}</span>
                        {card.endDate && <span className="tabular-nums text-foreground-500">~{card.endDate}</span>}
                      </div>
                      <ProgressBar value={card.progress} className="mt-1.5" />
                      {movable && (
                        <select
                          className="field mt-1.5 w-full text-[11.5px]"
                          aria-label={formatLabel(BOARD_TEXT.moveToLabel, { name: card.name })}
                          value={column.id}
                          disabled={busy}
                          onChange={(e) => {
                            const target = columns.find((c) => c.id === Number(e.target.value));
                            if (target) void move(card, target);
                          }}
                        >
                          {columns.map((c) => <option key={c.id} value={c.id}>{BOARD_TEXT.moveTo}: {columnTitle(c)}</option>)}
                        </select>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      {hasFilter && cardTotal === 0 && (
        <div className="card">
          <EmptyState
            icon="ri-layout-grid-line"
            title={BOARD_TEXT.emptyFilteredTitle}
            description={BOARD_TEXT.emptyFilteredDescription}
            action={
              <button type="button" className="btn-outline" onClick={resetFilters}>
                {BOARD_TEXT.resetFilters}
              </button>
            }
          />
        </div>
      )}

      {columnsOpen && <BoardColumnsDialog projectId={projectId} columns={columns} onClose={() => setColumnsOpen(false)} onChanged={reload} />}
      {detailTaskId !== null && (
        <ServerTaskDetailDialog projectId={projectId} taskId={detailTaskId} viewer={viewer} members={members} onClose={() => setDetailTaskId(null)} onChanged={reload} />
      )}
    </div>
  );
}
