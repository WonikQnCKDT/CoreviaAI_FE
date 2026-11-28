import { useMemo, useState } from "react";
import Modal from "@/components/ui/Modal";
import { useDemoStore } from "@/stores/DemoStore";
import { descendantsOf } from "@/features/task/utils/taskTree";
import { formatDate } from "@/utils/date";
import { STAGE_LABEL } from "@/utils/ui";
import { StatusBadge } from "@/components/ui/Badge";
import { BUTTON_TEXT } from "@/shared/i18n/catalog/button";

interface PredecessorModalProps {
  open: boolean;
  taskId: string;
  onClose: () => void;
}

export default function PredecessorModal({ open, taskId, onClose }: PredecessorModalProps) {
  const { tasks, setPredecessors } = useDemoStore();
  const task = tasks.find((t) => t.id === taskId);
  const [selected, setSelected] = useState<string[]>(task?.predecessors || []);

  const candidates = useMemo(() => {
    if (!task) return [];
    const descendantIds = new Set(descendantsOf(tasks, task.id).map((t) => t.id));
    return tasks
      .filter((t) => t.projectId === task.projectId && t.id !== task.id && !descendantIds.has(t.id))
      .sort((a, b) => (a.startDate < b.startDate ? -1 : 1));
  }, [tasks, task]);

  if (!task) return null;

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  return (
    <Modal
      open={open}
      title="선행작업 설정"
      description="완료 → 시작 의존관계로 연결됩니다. 자기 자신과 하위작업은 선택할 수 없어 순환 의존이 차단됩니다."
      onClose={onClose}
      width="max-w-xl"
      footer={
        <>
          <button type="button" className="btn-outline" onClick={onClose}>
            {BUTTON_TEXT.cancel}
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setPredecessors(task.id, selected);
              onClose();
            }}
          >
            {BUTTON_TEXT.save}
          </button>
        </>
      }
    >
      <div className="mb-3 rounded-lg border border-background-200 bg-background-100 px-3 py-2 text-[11.5px] text-foreground-600">
        대상 업무: <span className="font-medium text-foreground-900">{task.name}</span> · {task.stage ? STAGE_LABEL[task.stage] : ""}
      </div>
      <ul className="max-h-[320px] space-y-1.5 overflow-y-auto pr-1">
        {candidates.map((candidate) => {
          const checked = selected.includes(candidate.id);
          return (
            <li key={candidate.id}>
              <button
                type="button"
                onClick={() => toggle(candidate.id)}
                className={`flex w-full cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition ${
                  checked ? "border-primary-300 bg-primary-50" : "border-background-200 bg-background-50 hover:border-background-400"
                }`}
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                    checked ? "border-primary-500 bg-primary-500 text-background-50" : "border-background-400"
                  }`}
                >
                  {checked && <i className="ri-check-line text-[11px]" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-medium text-foreground-900">{candidate.name}</span>
                  <span className="mt-0.5 block text-[10.5px] text-foreground-500">
                    {candidate.stage ? STAGE_LABEL[candidate.stage] : "-"} · {formatDate(candidate.startDate)} ~ {formatDate(candidate.endDate)}
                  </span>
                </span>
                <StatusBadge status={candidate.status} />
              </button>
            </li>
          );
        })}
        {candidates.length === 0 && (
          <li className="rounded-lg border border-dashed border-background-300 px-3 py-6 text-center text-[12px] text-foreground-500">
            선택할 수 있는 선행작업이 없습니다.
          </li>
        )}
      </ul>
    </Modal>
  );
}