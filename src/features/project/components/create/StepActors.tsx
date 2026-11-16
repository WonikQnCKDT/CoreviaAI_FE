import { Badge } from "@/components/ui/Badge";
import type { RoleKey } from "@/types";
import { ACTOR_CARDS } from "@/features/project/types";

interface StepActorsProps {
  actors: RoleKey[];
  onToggle: (key: RoleKey) => void;
  error?: string;
  submitted: boolean;
}

const COMING_SOON = [
  { title: "제조 부서", desc: "생산 현장 액터는 조직 정보 연동 후 지원 예정" },
  { title: "협력사", desc: "외부 협력사 계정 초대는 추후 지원 예정" },
];

export default function StepActors({ actors, onToggle, error, submitted }: StepActorsProps) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {ACTOR_CARDS.map((actor) => {
          const selected = actors.includes(actor.key);
          return (
            <button
              key={actor.key}
              type="button"
              onClick={() => onToggle(actor.key)}
              disabled={actor.required}
              className={`rounded-xl border px-3.5 py-3 text-left transition ${
                selected ? "border-primary-400 bg-primary-50" : "border-background-300 bg-background-50 hover:border-background-400"
              } ${actor.required ? "cursor-default" : "cursor-pointer"}`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-foreground-900">
                  {actor.title}
                  {actor.required && <Badge className="border-primary-200 bg-background-50 text-primary-700">필수</Badge>}
                </span>
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                    selected ? "border-primary-500 bg-primary-500 text-background-50" : "border-background-400"
                  }`}
                >
                  {selected && <i className="ri-check-line text-[11px]" aria-hidden="true" />}
                </span>
              </span>
              <span className="mt-1 block text-[10.5px] leading-4 text-foreground-500">{actor.desc}</span>
            </button>
          );
        })}

        {COMING_SOON.map((item) => (
          <div
            key={item.title}
            className="cursor-not-allowed rounded-xl border border-dashed border-background-300 bg-background-100 px-3.5 py-3 opacity-70"
          >
            <span className="flex items-center justify-between gap-2">
              <span className="text-[12.5px] font-semibold text-foreground-500">{item.title}</span>
              <Badge className="border-background-300 bg-background-50 text-foreground-500">추후 지원</Badge>
            </span>
            <span className="mt-1 block text-[10.5px] leading-4 text-foreground-500">{item.desc}</span>
          </div>
        ))}
      </div>

      {submitted && error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[11.5px] text-rose-700">{error}</p>
      )}

      <p className="flex items-start gap-1.5 rounded-lg border border-background-200 bg-background-100 px-3.5 py-2.5 text-[10.5px] leading-4 text-foreground-500">
        <i className="ri-information-line mt-[1px] text-[12px]" aria-hidden="true" />
        선택한 액터는 4단계 멤버 초대에서 역할 선택 항목으로 사용됩니다. 업무 담당자와 게이트 승인자는 별개로 관리됩니다.
      </p>
    </div>
  );
}