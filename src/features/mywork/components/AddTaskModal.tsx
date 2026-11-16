import { useState } from "react";
import Modal from "@/components/ui/Modal";
import InfoTip from "@/components/ui/InfoTip";
import { EFFORT_TOOLTIP, effortDetailText } from "@/features/task/utils/effort";
import { useDemoStore } from "@/stores/DemoStore";
import { TODAY } from "@/utils/date";
import type { Priority } from "@/types";

interface AddTaskModalProps {
  open: boolean;
  onClose: () => void;
}

export default function AddTaskModal({ open, onClose }: AddTaskModalProps) {
  const { addTask, currentUser } = useDemoStore();
  const [name, setName] = useState("");
  const [dueDate, setDueDate] = useState(TODAY);
  const [priority, setPriority] = useState<Priority>("normal");
  const [estimate, setEstimate] = useState(1);
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  const reset = () => {
    setName("");
    setDueDate(TODAY);
    setPriority("normal");
    setEstimate(1);
    setDescription("");
    setError("");
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      setError("할 일 이름을 입력해 주세요.");
      return;
    }
    if (!dueDate) {
      setError("마감일을 선택해 주세요.");
      return;
    }
    addTask({
      projectId: null,
      level: 2,
      stage: null,
      name: name.trim(),
      assigneeId: currentUser.id,
      startDate: TODAY,
      endDate: dueDate,
      estimate,
      priority,
      description: description.trim(),
      personal: true,
    });
    reset();
    onClose();
  };

  return (
    <Modal
      open={open}
      title="개인 할 일 추가"
      description="내 업무에만 표시되는 개인 할 일입니다. 프로젝트 업무와는 별도로 관리됩니다."
      onClose={() => {
        setError("");
        onClose();
      }}
      footer={
        <>
          <button type="button" className="btn-outline" onClick={onClose}>
            취소
          </button>
          <button type="button" className="btn-primary" onClick={handleSubmit}>
            <i className="ri-add-line" />
            할 일 추가
          </button>
        </>
      }
    >
      <div className="space-y-3.5">
        <label className="block">
          <span className="mb-1 block text-[11.5px] font-medium text-foreground-700">
            할 일 이름 <span className="text-rose-500">*</span>
          </span>
          <input
            className="field"
            value={name}
            maxLength={80}
            placeholder="예) 주간 리스크 리뷰 자료 정리"
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-[11.5px] font-medium text-foreground-700">마감일</span>
            <input type="date" className="field" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11.5px] font-medium text-foreground-700">우선순위</span>
            <select
              className="field"
              value={priority}
              onChange={(event) => setPriority(event.target.value as Priority)}
            >
              <option value="high">높음</option>
              <option value="normal">보통</option>
              <option value="low">낮음</option>
            </select>
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
            value={estimate}
            onChange={(event) => setEstimate(Number(event.target.value))}
          />
          <span className="mt-1 block text-[10.5px] leading-4 text-foreground-500">
            {effortDetailText(estimate)}
          </span>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11.5px] font-medium text-foreground-700">메모</span>
          <textarea
            className="field resize-none"
            rows={3}
            maxLength={500}
            value={description}
            placeholder="필요한 내용을 간단히 적어 주세요. (선택)"
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        {error && (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[11.5px] text-rose-700">{error}</p>
        )}
      </div>
    </Modal>
  );
}