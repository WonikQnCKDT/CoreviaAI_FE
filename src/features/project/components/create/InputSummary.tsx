import { diffDays, formatDate } from "@/utils/date";
import { VISIBILITY_LABEL } from "@/utils/ui";
import type { User } from "@/types";
import type { ProjectFormState } from "@/features/project/types";
import { BUTTON_TEXT } from "@/shared/i18n/catalog/button";

interface InputSummaryProps {
  form: ProjectFormState;
  users: User[];
  issuedCode: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function InputSummary({ form, users, issuedCode, onCancel, onConfirm }: InputSummaryProps) {
  const pm = users.find((user) => user.id === form.pmId);
  const days = form.startDate && form.endDate ? Math.max(diffDays(form.startDate, form.endDate) + 1, 0) : 0;

  const rows: { label: string; value: string }[] = [
    { label: "프로젝트명", value: form.name.trim() || "-" },
    { label: "주관 부서", value: form.dept || "-" },
    { label: "PM", value: pm ? `${pm.name} · ${pm.dept}` : "-" },
    { label: "기간", value: `${formatDate(form.startDate)} ~ ${formatDate(form.endDate)} (${days}일)` },
    { label: "공개 범위", value: VISIBILITY_LABEL[form.visibility] },
    { label: "식별 코드", value: issuedCode },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2.5 rounded-xl border border-primary-200 bg-primary-50 px-4 py-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background-50 text-primary-600">
          <i className="ri-file-list-3-line text-[16px]" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-foreground-950">입력한 기본 정보를 확인해 주세요</p>
          <p className="mt-0.5 text-[11px] leading-4 text-foreground-600">
            내용이 맞으면 다음 단계인 운영 방식 지정으로 넘어갑니다. 수정이 필요하면 아니요를 눌러 주세요.
          </p>
        </div>
      </div>

      <dl className="overflow-hidden rounded-xl border border-background-200">
        {rows.map((row, index) => (
          <div
            key={row.label}
            className={`flex items-start justify-between gap-4 px-4 py-2.5 ${index % 2 === 0 ? "bg-background-50" : "bg-background-100"}`}
          >
            <dt className="shrink-0 text-[11.5px] text-foreground-500">{row.label}</dt>
            <dd className="min-w-0 text-right text-[12px] font-medium text-foreground-900">{row.value}</dd>
          </div>
        ))}
        {form.description.trim() && (
          <div className="flex items-start justify-between gap-4 border-t border-background-200 bg-background-50 px-4 py-2.5">
            <dt className="shrink-0 text-[11.5px] text-foreground-500">설명</dt>
            <dd className="min-w-0 whitespace-pre-line break-words text-right text-[11.5px] leading-5 text-foreground-800">
              {form.description.trim()}
            </dd>
          </div>
        )}
      </dl>

      <div className="rounded-xl border border-background-200 bg-background-50 px-4 py-4">
        <p className="text-center text-[12.5px] font-medium text-foreground-900">정말 이대로 생성하시겠습니까?</p>
        <div className="mt-3 flex items-center justify-center gap-2">
          <button type="button" className="btn-outline min-w-[104px] whitespace-nowrap" onClick={onCancel}>
            {BUTTON_TEXT.no}
          </button>
          <button type="button" className="btn-primary min-w-[104px] whitespace-nowrap" onClick={onConfirm}>
            {BUTTON_TEXT.yes}
            <i className="ri-arrow-right-line" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}