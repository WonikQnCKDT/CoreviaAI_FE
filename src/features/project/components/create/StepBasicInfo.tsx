import { Badge } from "@/components/ui/Badge";
import InfoTip from "@/components/ui/InfoTip";
import { PROJECT_CODE_RULE_HINT } from "@/features/project/utils/projectCode";
import { VISIBILITY_LABEL } from "@/utils/ui";
import type { User } from "@/types";
import { DEPARTMENTS, VISIBILITY_CARDS, type ProjectFormState } from "@/features/project/types";
import { BUTTON_TEXT } from "@/shared/i18n/catalog/button";

interface StepBasicInfoProps {
  form: ProjectFormState;
  users: User[];
  currentUserId: string;
  issuedCode: string;
  codeCopied: boolean;
  onCopyCode: () => void;
  onChange: (patch: Partial<ProjectFormState>) => void;
  errors: Record<string, string>;
  submitted: boolean;
}

export default function StepBasicInfo({
  form,
  users,
  currentUserId,
  issuedCode,
  codeCopied,
  onCopyCode,
  onChange,
  errors,
  submitted,
}: StepBasicInfoProps) {
  const pmCandidates = users.filter((u) => u.active && (u.role === "pm" || u.id === currentUserId));
  const deptOptions = form.dept && !DEPARTMENTS.includes(form.dept) ? [form.dept, ...DEPARTMENTS] : DEPARTMENTS;
  const showError = (key: string) => submitted && Boolean(errors[key]);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <label className="block min-w-0 md:col-span-2">
        <span className="mb-1.5 block text-[12px] font-medium text-foreground-700">
          프로젝트명 <span className="text-rose-500">*</span>
        </span>
        <input
          className={`field ${showError("name") ? "border-rose-400" : ""}`}
          value={form.name}
          maxLength={60}
          autoFocus
          placeholder="예) 사내 업무포털 고도화"
          onChange={(event) => onChange({ name: event.target.value })}
        />
        {showError("name") && <span className="mt-1 block text-[11px] text-rose-600">{errors.name}</span>}
      </label>

      <label className="block min-w-0">
        <span className="mb-1.5 block text-[12px] font-medium text-foreground-700">
          주관 부서 <span className="text-rose-500">*</span>
        </span>
        <select className="field" value={form.dept} onChange={(event) => onChange({ dept: event.target.value })}>
          {deptOptions.map((dept) => (
            <option key={dept} value={dept}>
              {dept}
            </option>
          ))}
        </select>
        {showError("dept") && <span className="mt-1 block text-[11px] text-rose-600">{errors.dept}</span>}
      </label>

      <label className="block min-w-0">
        <span className="mb-1.5 block text-[12px] font-medium text-foreground-700">
          PM <span className="text-rose-500">*</span>
        </span>
        <select className="field" value={form.pmId} onChange={(event) => onChange({ pmId: event.target.value })}>
          {pmCandidates.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name} · {user.dept}
              {user.id === currentUserId ? " (생성자)" : ""}
            </option>
          ))}
        </select>
        {showError("pmId") && <span className="mt-1 block text-[11px] text-rose-600">{errors.pmId}</span>}
      </label>

      <label className="block min-w-0">
        <span className="mb-1.5 block text-[12px] font-medium text-foreground-700">
          시작일 <span className="text-rose-500">*</span>
        </span>
        <input
          type="date"
          className={`field ${showError("startDate") ? "border-rose-400" : ""}`}
          value={form.startDate}
          onChange={(event) => onChange({ startDate: event.target.value })}
        />
        {showError("startDate") && <span className="mt-1 block text-[11px] text-rose-600">{errors.startDate}</span>}
      </label>

      <label className="block min-w-0">
        <span className="mb-1.5 block text-[12px] font-medium text-foreground-700">
          종료일 <span className="text-rose-500">*</span>
        </span>
        <input
          type="date"
          className={`field ${showError("endDate") ? "border-rose-400" : ""}`}
          value={form.endDate}
          onChange={(event) => onChange({ endDate: event.target.value })}
        />
        {showError("endDate") && <span className="mt-1 block text-[11px] text-rose-600">{errors.endDate}</span>}
      </label>

      <div className="block min-w-0 md:col-span-2">
        <span className="mb-1.5 flex items-center justify-between gap-2 text-[12px] font-medium text-foreground-700">
          <span>프로젝트 설명</span>
          <span className="text-[10.5px] font-normal text-foreground-400 tabular-nums">{form.description.length} / 500</span>
        </span>
        <textarea
          className="field min-h-[76px] resize-y"
          rows={3}
          maxLength={500}
          placeholder="프로젝트 목적과 범위를 간단히 적어 주세요. (선택)"
          value={form.description}
          onChange={(event) => onChange({ description: event.target.value })}
        />
      </div>

      <div className="block min-w-0 md:col-span-2">
        <span className="mb-1.5 flex items-center gap-1.5 text-[12px] font-medium text-foreground-700">
          식별 코드
          <Badge className="border-primary-200 bg-primary-50 text-primary-700">자동 발급</Badge>
          <InfoTip
            label="식별 코드 안내"
            text={`${PROJECT_CODE_RULE_HINT} 이미 사용 중인 코드와 겹치지 않도록 다음 번호를 찾아 드립니다.`}
          />
        </span>
        <div className="flex items-center gap-1.5 rounded-lg border border-background-300 bg-background-100 px-2.5 py-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-background-50 text-primary-600">
            <i className="ri-lock-2-line text-[13px]" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1 truncate font-mono text-[13px] font-medium text-foreground-900">{issuedCode}</span>
          <button
            type="button"
            onClick={onCopyCode}
            className="flex shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap rounded border border-background-300 bg-background-50 px-2 py-1 text-[11px] font-medium text-foreground-700 hover:border-primary-300 hover:text-primary-700"
          >
            <i className={codeCopied ? "ri-check-line text-emerald-600" : "ri-file-copy-line"} aria-hidden="true" />
            {codeCopied ? BUTTON_TEXT.copied : BUTTON_TEXT.copy}
          </button>
        </div>
      </div>

      <div className="block min-w-0 md:col-span-2">
        <span className="mb-1.5 block text-[12px] font-medium text-foreground-700">공개 범위</span>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {VISIBILITY_CARDS.map((item) => {
            const selected = form.visibility === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onChange({ visibility: item.key })}
                className={`cursor-pointer rounded-lg border px-3 py-2.5 text-left transition ${
                  selected
                    ? "border-primary-400 bg-primary-50"
                    : "border-background-300 bg-background-50 hover:border-background-400"
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-[12.5px] font-medium text-foreground-900">{VISIBILITY_LABEL[item.key]}</span>
                  <span
                    className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border ${
                      selected ? "border-primary-500 bg-primary-500" : "border-background-400"
                    }`}
                  >
                    {selected && <span className="h-1.5 w-1.5 rounded-full bg-background-50" />}
                  </span>
                </span>
                <span className="mt-1 block text-[10.5px] leading-4 text-foreground-500">{item.desc}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}