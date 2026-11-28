import Avatar from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { ROLE_LABEL, STAGES } from "@/utils/ui";
import type { RoleKey, User } from "@/types";
import { BUTTON_TEXT } from "@/shared/i18n/catalog/button";

interface StepApproverMember {
  userId: string;
  role: RoleKey;
  user: User;
}

interface StepApproverProps {
  members: StepApproverMember[];
  pmName: string;
  value: string | null;
  onChange: (userId: string | null) => void;
}

export default function StepApprover({ members, pmName, value, onChange }: StepApproverProps) {
  const selected = members.find((member) => member.userId === value) || null;

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-lg border border-primary-200 bg-primary-50 px-3.5 py-2.5">
        <i className="ri-shield-check-line mt-[1px] text-[14px] text-primary-600" aria-hidden="true" />
        <p className="text-[11px] leading-4 text-primary-900">
          승인자를 지정하면 5개 게이트에 동일하게 적용됩니다. 지정하지 않으면 자동 승인되지 않으며, 각 단계는 승인자가 없어
          전환할 수 없습니다.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-background-200">
        <button
          type="button"
          onClick={() => onChange(null)}
          className={`flex w-full cursor-pointer items-center gap-2.5 border-b border-background-200 px-3.5 py-3 text-left transition ${
            value === null ? "bg-background-100" : "bg-background-50 hover:bg-background-100"
          }`}
        >
          <span
            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
              value === null ? "border-primary-500 bg-primary-500" : "border-background-400"
            }`}
          >
            {value === null && <span className="h-1.5 w-1.5 rounded-full bg-background-50" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[12.5px] font-medium text-foreground-900">{BUTTON_TEXT.noApprover}</span>
            <span className="block text-[10.5px] text-foreground-500">{BUTTON_TEXT.approverLaterHint}</span>
          </span>
        </button>

        {members.length === 0 ? (
          <div className="px-3.5 py-6 text-center">
            <p className="text-[12px] text-foreground-500">초대한 멤버가 없어 지정할 수 있는 승인자가 없습니다.</p>
            <p className="mt-1 text-[10.5px] text-foreground-400">
              이전 단계에서 멤버를 초대하거나, 지금은 미지정 상태로 생성해도 됩니다.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-background-200">
            {members.map((member) => {
              const checked = value === member.userId;
              return (
                <li key={member.userId}>
                  <button
                    type="button"
                    onClick={() => onChange(member.userId)}
                    className={`flex w-full cursor-pointer items-center gap-2.5 px-3.5 py-2.5 text-left transition ${
                      checked ? "bg-primary-50/60" : "hover:bg-background-100"
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                        checked ? "border-primary-500 bg-primary-500" : "border-background-400"
                      }`}
                    >
                      {checked && <span className="h-1.5 w-1.5 rounded-full bg-background-50" />}
                    </span>
                    <Avatar name={member.user.name} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-medium text-foreground-900">{member.user.name}</span>
                      <span className="block truncate text-[10.5px] text-foreground-500">
                        {member.user.dept} · {ROLE_LABEL[member.role]}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-background-200 bg-background-100 px-3.5 py-3">
        <p className="flex items-center justify-between gap-2 text-[11.5px] font-semibold text-foreground-900">
          <span className="flex items-center gap-1.5">
            <i className="ri-list-check-2 text-primary-500" aria-hidden="true" />
            게이트별 적용 결과
          </span>
          <Badge className="border-background-300 bg-background-50 text-foreground-600">
            {selected ? selected.user.name : "미지정"}
          </Badge>
        </p>
        <ul className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
          {STAGES.map((stage) => (
            <li
              key={stage.key}
              className="flex items-center justify-between gap-2 rounded-md border border-background-200 bg-background-50 px-2.5 py-1.5"
            >
              <span className="text-[11.5px] text-foreground-700">{stage.label}</span>
              <span className={`text-[11px] font-medium ${selected ? "text-foreground-900" : "text-foreground-400"}`}>
                {selected ? selected.user.name : "미지정"}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 flex items-start gap-1 text-[10px] leading-4 text-foreground-500">
          <i className="ri-information-line mt-[1px] text-[11px]" aria-hidden="true" />
          현재 PM({pmName})은 게이트 승인자로 지정할 수 없습니다. 업무 담당자와 승인자는 별개입니다.
        </p>
      </div>
    </div>
  );
}