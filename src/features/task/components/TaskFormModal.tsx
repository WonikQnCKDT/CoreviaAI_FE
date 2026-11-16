import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import InfoTip from "@/components/ui/InfoTip";
import { EFFORT_TOOLTIP, effortDetailText } from "@/features/task/utils/effort";
import { useDemoStore } from "@/stores/DemoStore";
import { addDays, TODAY } from "@/utils/date";
import { ROLE_LABEL, STAGE_LABEL } from "@/utils/ui";
import AssigneeMultiSelect from "@/features/task/components/AssigneeMultiSelect";
import type { Priority, StageKey } from "@/types";

interface TaskFormModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  stage: StageKey;
  parentId: string | null;
  parentName?: string;
}

export default function TaskFormModal({ open, onClose, projectId, stage, parentId, parentName }: TaskFormModalProps) {
  const { projects, users, addTask } = useDemoStore();
  const project = projects.find((p) => p.id === projectId);
  const members = (project?.members || []).map((m) => ({
    userId: m.userId,
    role: m.role,
    name: users.find((u) => u.id === m.userId)?.name || "",
  }));
  const assigneeOptions = members.map((member) => ({
    id: member.userId,
    name: member.name,
    roleLabel: ROLE_LABEL[member.role],
    dept: users.find((u) => u.id === member.userId)?.dept,
  }));

  const [form, setForm] = useState({
    name: "",
    assigneeIds: [] as string[],
    startDate: TODAY,
    endDate: addDays(TODAY, 7),
    estimate: 2,
    priority: "normal" as Priority,
    description: "",
  });
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm({
        name: "",
        assigneeIds: [],
        startDate: TODAY,
        endDate: addDays(TODAY, 7),
        estimate: 2,
        priority: "normal",
        description: "",
      });
      setError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = () => {
    if (!form.name.trim()) {
      setError("업무명을 입력해 주세요.");
      return;
    }
    if (!form.startDate || !form.endDate) {
      setError("시작일과 종료일을 입력해 주세요.");
      return;
    }
    if (form.endDate < form.startDate) {
      setError("종료일이 시작일보다 빠릅니다.");
      return;
    }
    if (form.estimate <= 0) {
      setError("예상 작업량은 0보다 커야 합니다.");
      return;
    }
    addTask({
      projectId,
      parentId,
      level: parentId ? 3 : 2,
      stage,
      name: form.name.trim(),
      assigneeIds: form.assigneeIds,
      startDate: form.startDate,
      endDate: form.endDate,
      estimate: form.estimate,
      priority: form.priority,
      description: form.description.trim(),
    });
    onClose();
  };

  return (
    <Modal
      open={open}
      title={parentId ? "하위작업 추가" : "작업 추가"}
      description={`${STAGE_LABEL[stage]} 단계${parentName ? ` · 상위: ${parentName}` : ""}에 업무를 추가합니다.`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-outline" onClick={onClose}>
            취소
          </button>
          <button type="button" className="btn-primary" onClick={submit}>
            <i className="ri-add-line" />
            업무 추가
          </button>
        </>
      }
    >
      <div className="space-y-3.5">
        <label className="block">
          <span className="mb-1 block text-[11.5px] font-medium text-foreground-700">
            업무명 <span className="text-rose-500">*</span>
          </span>
          <input
            className="field"
            value={form.name}
            maxLength={80}
            placeholder="예) 통합검색 API 성능 점검"
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="block sm:col-span-2">
            <span className="mb-1 flex items-center gap-1 text-[11.5px] font-medium text-foreground-700">
              담당자
              <span className="text-[10.5px] font-normal text-foreground-500">(여러 명 선택 가능)</span>
            </span>
            <AssigneeMultiSelect
              members={assigneeOptions}
              value={form.assigneeIds}
              onChange={(next) => setForm({ ...form, assigneeIds: next })}
            />
          </div>
          <label className="block">
            <span className="mb-1 block text-[11.5px] font-medium text-foreground-700">우선순위</span>
            <select
              className="field"
              value={form.priority}
              onChange={(event) => setForm({ ...form, priority: event.target.value as Priority })}
            >
              <option value="high">높음</option>
              <option value="normal">보통</option>
              <option value="low">낮음</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11.5px] font-medium text-foreground-700">시작일</span>
            <input
              type="date"
              className="field"
              value={form.startDate}
              onChange={(event) => setForm({ ...form, startDate: event.target.value })}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11.5px] font-medium text-foreground-700">종료일</span>
            <input
              type="date"
              className="field"
              value={form.endDate}
              onChange={(event) => setForm({ ...form, endDate: event.target.value })}
            />
          </label>
        </div>
        <label className="block">
          <span className="mb-1 flex items-center gap-1 text-[11.5px] font-medium text-foreground-700">
            예상 작업량 (인일)
            <InfoTip label="예상 작업량 설명" text={EFFORT_TOOLTIP} />
          </span>
          <input
            type="number"
            min={0.5}
            step={0.5}
            className="field"
            value={form.estimate}
            onChange={(event) => setForm({ ...form, estimate: Number(event.target.value) })}
          />
          <span className="mt-1 block text-[10.5px] leading-4 text-foreground-500">
            {effortDetailText(form.estimate)} · 일정 기간과는 별개로 계산됩니다.
          </span>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11.5px] font-medium text-foreground-700">설명</span>
          <textarea
            className="field resize-none"
            rows={2}
            maxLength={500}
            value={form.description}
            placeholder="업무 범위나 참고 사항을 적어 주세요. (선택)"
            onChange={(event) => setForm({ ...form, description: event.target.value })}
          />
        </label>
        {error && <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[11.5px] text-rose-700">{error}</p>}
      </div>
    </Modal>
  );
}