import { useRef, useState } from "react";
import Modal from "@/components/ui/Modal";
import {
  createBoardColumn,
  deleteBoardColumn,
  reorderBoardColumns,
  updateBoardColumn,
  type BoardColumn,
} from "@/features/board/api/boardApi";
import { BOARD_COLUMN_TEXT } from "@/features/board/i18n/ko";
import { canDeleteColumn, columnTitle, interpretBoardFailure, reorderedIds, validateColumnInput, type BoardAction } from "@/features/board/utils/boardRules";
import type { WbsStatus } from "@/features/wbs/api/wbsApi";
import type { ApiResult } from "@/shared/api/client";
import { TASK_STATUS_LABEL } from "@/shared/i18n/catalog/status";
import { formatLabel } from "@/shared/i18n/store";

interface Props {
  projectId: number;
  columns: BoardColumn[];
  onClose: () => void;
  /** 컬럼이 바뀌면 보드를 다시 받는다(카드 위치·WIP 판정이 함께 바뀐다) */
  onChanged: () => void;
}

const STATUSES: WbsStatus[] = ["todo", "progress", "review", "done"];

type Draft = Record<number, { name: string; wipLimit: string }>;

const draftOf = (columns: BoardColumn[]): Draft =>
  Object.fromEntries(columns.map((c) => [c.id, { name: c.name ?? "", wipLimit: c.wipLimit === null ? "" : String(c.wipLimit) }]));

/** 컬럼 관리(PM): 이름·WIP 저장, 앞뒤 순서, 추가, 삭제. 서버 응답이 오면 보드를 다시 받는다 */
export default function BoardColumnsDialog({ projectId, columns, onClose, onChanged }: Props) {
  const [draft, setDraft] = useState<Draft>(() => draftOf(columns));
  const [list, setList] = useState(columns);
  const [added, setAdded] = useState({ name: "", statusCategory: "todo" as WbsStatus, wipLimit: "" });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  // 빠른 두 번 클릭에도 요청을 한 번만 보낸다(상태 갱신 전에 두 번째 클릭이 올 수 있다)
  const busyRef = useRef(false);

  /** 성공하면 true */
  const run = async (action: BoardAction, request: () => Promise<ApiResult<BoardColumn[]>>, success: string): Promise<boolean> => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setNotice(null);
    const result = await request();
    busyRef.current = false;
    setBusy(false);
    if (result.ok === true) {
      // 응답 컬럼에는 카드가 없어 카드 수는 기존 값을 이어 쓴다(보드는 onChanged로 다시 받는다)
      const counts = new Map(list.map((c) => [c.id, c.cardCount]));
      const next = result.data.map((c) => ({ ...c, cardCount: counts.get(c.id) ?? c.cardCount }));
      setList(next);
      setDraft(draftOf(next));
      setNotice({ tone: "success", text: success });
      onChanged();
      return true;
    }
    const view = interpretBoardFailure(action, result.failure);
    setNotice({ tone: "error", text: view.message });
    if (view.reload) onChanged();
    return false;
  };

  const save = (column: BoardColumn) => {
    const input = draft[column.id] ?? { name: "", wipLimit: "" };
    const checked = validateColumnInput(input);
    if (checked.ok === false) {
      setNotice({ tone: "error", text: checked.message });
      return;
    }
    void run("updateColumn", () => updateBoardColumn({ projectId, columnId: column.id, name: checked.name, wipLimit: checked.wipLimit }), BOARD_COLUMN_TEXT.saved);
  };

  const move = (column: BoardColumn, direction: "left" | "right") => {
    const ids = reorderedIds(list, column.id, direction);
    if (ids) void run("reorderColumns", () => reorderBoardColumns({ projectId, columnIds: ids }), BOARD_COLUMN_TEXT.reordered);
  };

  const remove = (column: BoardColumn) => {
    if (!window.confirm(formatLabel(BOARD_COLUMN_TEXT.confirmDelete, { name: columnTitle(column) }))) return;
    void run("deleteColumn", () => deleteBoardColumn({ projectId, columnId: column.id }), BOARD_COLUMN_TEXT.deleted);
  };

  const add = () => {
    const checked = validateColumnInput(added);
    if (checked.ok === false) {
      setNotice({ tone: "error", text: checked.message });
      return;
    }
    void run(
      "createColumn",
      () => createBoardColumn({ projectId, name: checked.name, statusCategory: added.statusCategory, wipLimit: checked.wipLimit }),
      BOARD_COLUMN_TEXT.added,
    ).then((ok) => {
      // 실패하면 입력을 남겨 고쳐서 다시 보낼 수 있게 한다
      if (ok) setAdded((prev) => ({ ...prev, name: "", wipLimit: "" }));
    });
  };

  const fieldClass = "field w-full text-[12.5px]";

  return (
    <Modal open title={BOARD_COLUMN_TEXT.title} description={BOARD_COLUMN_TEXT.description} onClose={onClose} width="max-w-2xl">
      <div className="space-y-3">
        {notice && (
          <p role={notice.tone === "error" ? "alert" : "status"} className={`rounded-md px-3 py-2 text-[12px] ${notice.tone === "error" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
            {notice.text}
          </p>
        )}
        <ul className="space-y-2">
          {list.map((column, index) => {
            const title = columnTitle(column);
            const value = draft[column.id] ?? { name: "", wipLimit: "" };
            return (
              <li key={column.id} className="grid grid-cols-[1fr_88px_96px_auto] items-center gap-2 rounded-lg border border-background-300 p-2">
                <input
                  className={fieldClass}
                  aria-label={`${BOARD_COLUMN_TEXT.name}: ${title}`}
                  placeholder={column.labelKey ? `${BOARD_COLUMN_TEXT.namePlaceholder} (${TASK_STATUS_LABEL[column.statusCategory]})` : BOARD_COLUMN_TEXT.namePlaceholder}
                  maxLength={50}
                  value={value.name}
                  onChange={(e) => setDraft({ ...draft, [column.id]: { ...value, name: e.target.value } })}
                />
                <span className="text-[11.5px] text-foreground-600">{TASK_STATUS_LABEL[column.statusCategory]}</span>
                <input
                  className={fieldClass}
                  inputMode="numeric"
                  aria-label={`${BOARD_COLUMN_TEXT.wipLimit}: ${title}`}
                  placeholder={BOARD_COLUMN_TEXT.wipPlaceholder}
                  value={value.wipLimit}
                  onChange={(e) => setDraft({ ...draft, [column.id]: { ...value, wipLimit: e.target.value } })}
                />
                <div className="flex gap-0.5">
                  <button type="button" className="btn-ghost px-1.5 py-1 text-[12px]" aria-label={`${BOARD_COLUMN_TEXT.moveLeft}: ${title}`} disabled={busy || index === 0} onClick={() => move(column, "left")}>
                    <i className="ri-arrow-left-s-line" aria-hidden="true" />
                  </button>
                  <button type="button" className="btn-ghost px-1.5 py-1 text-[12px]" aria-label={`${BOARD_COLUMN_TEXT.moveRight}: ${title}`} disabled={busy || index === list.length - 1} onClick={() => move(column, "right")}>
                    <i className="ri-arrow-right-s-line" aria-hidden="true" />
                  </button>
                  <button type="button" className="btn-outline px-2 py-1 text-[12px]" aria-label={`${BOARD_COLUMN_TEXT.save}: ${title}`} disabled={busy} onClick={() => save(column)}>
                    {BOARD_COLUMN_TEXT.save}
                  </button>
                  <button
                    type="button"
                    className="btn-ghost px-2 py-1 text-[12px] text-rose-600"
                    aria-label={`${BOARD_COLUMN_TEXT.delete}: ${title}`}
                    title={canDeleteColumn(list, column) ? undefined : BOARD_COLUMN_TEXT.cannotDelete}
                    disabled={busy || !canDeleteColumn(list, column)}
                    onClick={() => remove(column)}
                  >
                    {BOARD_COLUMN_TEXT.delete}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        <fieldset className="rounded-lg border border-dashed border-background-400 p-2">
          <legend className="px-1 text-[12px] font-semibold text-foreground-800">{BOARD_COLUMN_TEXT.addTitle}</legend>
          <div className="grid grid-cols-[1fr_120px_96px_auto] items-center gap-2">
            <input className={fieldClass} aria-label={`${BOARD_COLUMN_TEXT.addTitle} ${BOARD_COLUMN_TEXT.name}`} placeholder={BOARD_COLUMN_TEXT.namePlaceholder} maxLength={50} value={added.name} onChange={(e) => setAdded({ ...added, name: e.target.value })} />
            <select className={fieldClass} aria-label={`${BOARD_COLUMN_TEXT.addTitle} ${BOARD_COLUMN_TEXT.status}`} value={added.statusCategory} onChange={(e) => setAdded({ ...added, statusCategory: e.target.value as WbsStatus })}>
              {STATUSES.map((s) => <option key={s} value={s}>{TASK_STATUS_LABEL[s]}</option>)}
            </select>
            <input className={fieldClass} inputMode="numeric" aria-label={`${BOARD_COLUMN_TEXT.addTitle} ${BOARD_COLUMN_TEXT.wipLimit}`} placeholder={BOARD_COLUMN_TEXT.wipPlaceholder} value={added.wipLimit} onChange={(e) => setAdded({ ...added, wipLimit: e.target.value })} />
            <button type="button" className="btn-primary px-3 py-1 text-[12px]" disabled={busy || list.length >= 20} onClick={add}>
              {BOARD_COLUMN_TEXT.add}
            </button>
          </div>
        </fieldset>

        <div className="flex justify-end">
          <button type="button" className="btn-outline" onClick={onClose}>{BOARD_COLUMN_TEXT.close}</button>
        </div>
      </div>
    </Modal>
  );
}
