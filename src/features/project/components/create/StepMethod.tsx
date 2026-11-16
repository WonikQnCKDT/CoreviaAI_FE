import { Badge } from "@/components/ui/Badge";
import { STAGES } from "@/utils/ui";

export default function StepMethod() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border-2 border-primary-400 bg-primary-50 px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-[13.5px] font-semibold text-foreground-950">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-background-50 text-primary-600">
                <i className="ri-flow-chart text-[15px]" aria-hidden="true" />
              </span>
              폭포수
            </span>
            <Badge className="border-primary-300 bg-background-50 text-primary-700">
              <i className="ri-check-line" aria-hidden="true" />
              선택됨
            </Badge>
          </div>
          <p className="mt-2.5 text-[11.5px] leading-5 text-foreground-600">
            분석 → 설계 → 개발 → 테스트 → 이행 순서로 단계를 넘어갑니다. 단계별 마일스톤과 산출물 검수에 적합합니다.
          </p>
          <ul className="mt-2.5 space-y-1 text-[11px] text-foreground-600">
            <li className="flex items-center gap-1.5">
              <i className="ri-check-line text-primary-600" aria-hidden="true" /> 단계별 WBS 자동 생성
            </li>
            <li className="flex items-center gap-1.5">
              <i className="ri-check-line text-primary-600" aria-hidden="true" /> 마일스톤·D-day 관리
            </li>
            <li className="flex items-center gap-1.5">
              <i className="ri-check-line text-primary-600" aria-hidden="true" /> 게이트 승인 후 단계 전환
            </li>
          </ul>
        </div>

        <div className="cursor-not-allowed rounded-xl border border-dashed border-background-300 bg-background-100 px-4 py-4 opacity-70">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-[13.5px] font-semibold text-foreground-500">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-background-200 text-foreground-500">
                <i className="ri-loop-left-line text-[15px]" aria-hidden="true" />
              </span>
              애자일
            </span>
            <Badge className="border-background-300 bg-background-50 text-foreground-500">추후 지원</Badge>
          </div>
          <p className="mt-2.5 text-[11.5px] leading-5 text-foreground-500">
            스프린트와 백로그 기반 운영은 다음 버전에서 지원할 예정입니다. 현재는 선택할 수 없습니다.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-background-200 bg-background-100 px-4 py-3.5">
        <p className="flex items-center gap-1.5 text-[12px] font-semibold text-foreground-900">
          <i className="ri-route-line text-primary-500" aria-hidden="true" />
          단계 흐름
        </p>
        <ol className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {STAGES.map((stage, index) => (
            <li key={stage.key} className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-background-300 bg-background-50 px-2.5 py-1.5 text-[11.5px] font-medium text-foreground-800">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary-100 text-[10px] font-semibold text-primary-700">
                  {index + 1}
                </span>
                {stage.label}
              </span>
              {index < STAGES.length - 1 && (
                <i className="ri-arrow-right-s-line text-[13px] text-foreground-400" aria-hidden="true" />
              )}
            </li>
          ))}
        </ol>
        <p className="mt-2.5 text-[10.5px] leading-4 text-foreground-500">
          각 단계는 필수 산출물이 승인되어야 다음 단계로 넘어갈 수 있습니다.
        </p>
      </div>
    </div>
  );
}