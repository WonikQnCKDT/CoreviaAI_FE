import { useState } from "react";
import { useParams } from "react-router-dom";
import { useDemoStore } from "@/stores/DemoStore";
import { Badge } from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { buildWeeklyReport, defaultReportRange, type WeeklyReportDraft } from "@/features/knowledge/utils/aiDraft";
import { formatDate } from "@/utils/date";
import { STAGE_LABEL } from "@/utils/ui";
import { BUTTON_TEXT } from "@/shared/i18n/catalog/button";

export default function ReportPage() {
  const { projectId } = useParams();
  const { projects, tasks, issues, journals, currentUser } = useDemoStore();
  const project = projects.find((p) => p.id === projectId);
  const range = defaultReportRange();
  const [start, setStart] = useState(range.start);
  const [end, setEnd] = useState(range.end);
  const [draft, setDraft] = useState<WeeklyReportDraft | null>(null);
  const [error, setError] = useState("");

  if (!project) return null;
  const isPm = project.pmId === currentUser.id;

  const generate = () => {
    if (!start || !end) {
      setError("기간을 선택해 주세요.");
      return;
    }
    if (end < start) {
      setError("종료일이 시작일보다 빠를 수 없습니다.");
      return;
    }
    setDraft(buildWeeklyReport(project, tasks, issues, journals, start, end));
    setError("");
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div>
          <h3 className="text-[14px] font-semibold text-foreground-950">주간 리포트</h3>
          <p className="mt-0.5 text-[11.5px] text-foreground-500">기간을 선택해 금주 실적·차주 계획·이슈·리스크를 초안으로 정리합니다.</p>
        </div>
        <Badge className="border-amber-200 bg-amber-50 text-amber-700"><i className="ri-sparkling-2-line" /> AI 초안 · 데모</Badge>
        {!isPm && <Badge className="border-background-300 bg-background-100 text-foreground-500">PM만 생성 가능</Badge>}
      </div>

      <div className="card px-4 py-3">
        <div className="flex flex-wrap items-end gap-2">
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-foreground-700">시작일</span>
            <input type="date" className="field w-auto py-1.5 text-[12px]" value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-foreground-700">종료일</span>
            <input type="date" className="field w-auto py-1.5 text-[12px]" value={end} onChange={(e) => setEnd(e.target.value)} />
          </label>
          <button type="button" className="btn-primary ml-auto py-1.5" onClick={generate} disabled={!isPm}>
            <i className="ri-file-chart-line" /> {BUTTON_TEXT.generateWeeklyReportDraft}
          </button>
        </div>
        {error && <p className="mt-1 text-[11px] text-rose-600">{error}</p>}
        <p className="mt-1.5 text-[10.5px] text-foreground-500">
          자동 발송과 PDF 내보내기는 이번 범위에 포함되지 않습니다. 초안은 화면에서만 확인합니다.
        </p>
      </div>

      {!draft ? (
        <div className="card">
          <EmptyState
            icon="ri-file-chart-line"
            title="생성된 주간 리포트가 없습니다"
            description={isPm ? "기간을 선택하고 초안을 생성해 보세요." : "PM이 주간 리포트 초안을 생성할 수 있습니다."}
          />
        </div>
      ) : (
        <article className="card px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-2 border-b border-background-200 pb-3">
            <div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10.5px] text-foreground-500">{project.code}</span>
                <Badge className="border-amber-200 bg-amber-50 text-amber-700">데모 결과 · AI 초안</Badge>
              </div>
              <h3 className="mt-1 text-[16px] font-semibold text-foreground-950">{project.name} 주간 리포트</h3>
              <p className="mt-0.5 text-[11px] text-foreground-500">
                {formatDate(draft.period.start)} ~ {formatDate(draft.period.end)} · 작성자 {currentUser.name} · 생성 {formatDate(range.end)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10.5px] text-foreground-500">전체 진척률</p>
              <p className="text-[22px] font-semibold leading-tight text-primary-600">{draft.progress}%</p>
            </div>
          </div>

          <section className="mt-3">
            <h4 className="text-[12px] font-semibold text-foreground-900">요약</h4>
            <p className="mt-1 rounded-md border border-background-200 bg-background-100 px-3 py-2 text-[11.5px] leading-5 text-foreground-700">{draft.summary}</p>
          </section>

          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
            <section>
              <h4 className="text-[12px] font-semibold text-foreground-900">금주 실적</h4>
              <ul className="mt-1 space-y-1">
                {[...draft.doneThisWeek, ...draft.progressThisWeek].slice(0, 6).map((task) => (
                  <li key={task.id} className="flex items-center gap-2 rounded border border-background-200 px-2.5 py-1.5 text-[11px]">
                    <i className={task.status === "done" ? "ri-checkbox-circle-fill text-emerald-500" : "ri-time-line text-amber-500"} />
                    <span className="min-w-0 flex-1 truncate text-foreground-800">{task.name}</span>
                    <span className="text-[10px] text-foreground-500">{task.progress}%</span>
                  </li>
                ))}
                {draft.doneThisWeek.length + draft.progressThisWeek.length === 0 && <li className="text-[11px] text-foreground-500">해당 기간에 완료·진행 업무가 없습니다.</li>}
              </ul>
            </section>

            <section>
              <h4 className="text-[12px] font-semibold text-foreground-900">차주 계획</h4>
              <ul className="mt-1 space-y-1">
                {draft.nextWeek.slice(0, 6).map((task) => (
                  <li key={task.id} className="flex items-center gap-2 rounded border border-background-200 px-2.5 py-1.5 text-[11px]">
                    <i className="ri-arrow-right-s-line text-primary-500" />
                    <span className="min-w-0 flex-1 truncate text-foreground-800">{task.name}</span>
                    <span className="text-[10px] text-foreground-500">{STAGE_LABEL[task.stage || "analysis"]} · {formatDate(task.endDate)}</span>
                  </li>
                ))}
                {draft.nextWeek.length === 0 && <li className="text-[11px] text-foreground-500">차주 예정 업무가 없습니다.</li>}
              </ul>
            </section>

            <section>
              <h4 className="text-[12px] font-semibold text-foreground-900">단계 · 마일스톤</h4>
              <ul className="mt-1 space-y-1">
                {draft.milestones.map((m, index) => (
                  <li key={index} className="flex items-center gap-2 rounded border border-background-200 px-2.5 py-1.5 text-[11px]">
                    <i className="ri-flag-2-line text-amber-500" />
                    <span className="min-w-0 flex-1 text-foreground-800">{m.name}</span>
                    <span className="text-[10px] text-foreground-500">{STAGE_LABEL[m.stage as keyof typeof STAGE_LABEL]} · {formatDate(m.date)}</span>
                  </li>
                ))}
                {draft.milestones.length === 0 && <li className="text-[11px] text-foreground-500">해당 기간 마일스톤이 없습니다.</li>}
              </ul>
            </section>

            <section>
              <h4 className="text-[12px] font-semibold text-foreground-900">이슈</h4>
              <ul className="mt-1 space-y-1">
                {draft.issues.slice(0, 5).map((issue) => (
                  <li key={issue.id} className="flex items-center gap-2 rounded border border-background-200 px-2.5 py-1.5 text-[11px]">
                    <i className="ri-error-warning-line text-rose-500" />
                    <span className="min-w-0 flex-1 truncate text-foreground-800">{issue.title}</span>
                    <span className="text-[10px] text-foreground-500">{issue.severity}</span>
                  </li>
                ))}
                {draft.issues.length === 0 && <li className="text-[11px] text-foreground-500">미해결 이슈가 없습니다.</li>}
              </ul>
            </section>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
            <section className="rounded-lg border border-background-200 px-3 py-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-[12px] font-semibold text-foreground-900">리스크 점수와 근거</h4>
                <span className="text-[18px] font-semibold text-rose-600">{draft.riskScore}점</span>
              </div>
              <ul className="mt-1.5 space-y-1">
                {draft.riskEvidence.map((item) => (
                  <li key={item.label} className="flex items-center justify-between text-[11px] text-foreground-700">
                    <span>{item.label}</span>
                    <span className="font-medium text-foreground-900">{item.value}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-[10px] text-foreground-500">규칙 기반 데모 지표입니다. 실제 분석 결과가 아닙니다.</p>
            </section>
            <section className="rounded-lg border border-primary-200 bg-primary-50 px-3 py-2.5">
              <h4 className="text-[12px] font-semibold text-primary-900">요청사항</h4>
              <ul className="mt-1.5 space-y-1">
                {draft.requests.map((request, index) => (
                  <li key={index} className="flex gap-1.5 text-[11px] leading-5 text-primary-900">
                    <i className="ri-arrow-right-s-line mt-0.5" /> {request}
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <p className="mt-3 rounded-md bg-background-100 px-3 py-2 text-[10px] leading-4 text-foreground-500">
            이 리포트는 샘플 데이터와 규칙 기반 집계로 만든 ‘AI 초안’입니다. 자동 발송·PDF 내보내기는 제공하지 않으며, 실제 공유 전에는 담당자 검토가 필요합니다.
          </p>
        </article>
      )}
    </div>
  );
}