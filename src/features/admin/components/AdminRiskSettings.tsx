import { useState } from "react";
import { useDemoStore } from "@/stores/DemoStore";
import type { RiskSettings } from "@/types";

function cloneSettings(settings: RiskSettings): RiskSettings {
  return {
    weights: { ...settings.weights },
    thresholds: { ...settings.thresholds },
    bottleneckWip: settings.bottleneckWip ?? 4,
    workloadShare: settings.workloadShare ?? 40,
  };
}

export default function AdminRiskSettings() {
  const { riskSettings, riskSettingHistory, updateRiskSettings, users } = useDemoStore();
  const [draft, setDraft] = useState<RiskSettings>(() => cloneSettings(riskSettings));
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  const weightTotal = draft.weights.schedule + draft.weights.bottleneck + draft.weights.workload + draft.weights.impact;

  const setWeight = (key: keyof RiskSettings["weights"], value: number) => {
    setDraft((prev) => ({ ...prev, weights: { ...prev.weights, [key]: Math.max(0, Math.min(100, value)) } }));
    setSaved("");
  };

  const handleSave = () => {
    setError("");
    setSaved("");
    if (weightTotal !== 100) {
      setError(`가중치 합계가 ${weightTotal}%입니다. 네 개 가중치의 합이 100%가 되어야 합니다.`);
      return;
    }
    if (draft.thresholds.caution >= draft.thresholds.danger) {
      setError("주의 기준 점수는 위험 기준 점수보다 낮아야 합니다.");
      return;
    }
    if (draft.thresholds.danger > 100 || draft.thresholds.caution < 0) {
      setError("등급 기준은 0~100 사이로 입력해 주세요.");
      return;
    }
    if (!note.trim()) {
      setError("변경 사유를 입력해 주세요. 변경 이력에 함께 기록됩니다.");
      return;
    }
    updateRiskSettings({ ...draft, updatedBy: undefined, updatedAt: undefined }, note.trim());
    setSaved("설정을 저장했습니다. 다음 리스크 계산부터 적용됩니다. 기존에 산정된 점수는 소급 변경되지 않습니다.");
    setNote("");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-[13.5px] font-semibold text-foreground-950">AI · 리스크 설정</h3>
          <p className="mt-0.5 text-[11px] leading-5 text-foreground-500">
            병목·편중 임계값과 리스크 가중치·등급 기준을 설정합니다. 실제 계산 엔진은 연결되지 않았으며, 이 화면의 값은
            데모 설정입니다.
          </p>
        </div>
        <span className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[10.5px] font-medium text-amber-800">
          데모 설정 · 모델 선택·사용량 관리 제외
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <section className="card xl:col-span-2">
          <div className="border-b border-background-200 px-4 py-3">
            <h4 className="text-[13px] font-semibold text-foreground-950">리스크 가중치</h4>
            <p className="mt-0.5 text-[11px] text-foreground-500">네 영역의 합이 100%가 되어야 저장할 수 있습니다.</p>
          </div>
          <div className="space-y-4 px-4 py-4">
            {(
              [
                { key: "schedule", label: "일정 지연", hint: "마감 경과·예상 종료일 초과" },
                { key: "bottleneck", label: "병목", hint: "선행 지연·WIP 한도 초과" },
                { key: "workload", label: "인력 편중", hint: "특정 담당자 업무 집중도" },
                { key: "impact", label: "파급 효과", hint: "후행 작업·마일스톤 영향 범위" },
              ] as const
            ).map((item) => (
              <div key={item.key}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[12.5px] font-medium text-foreground-900">{item.label}</p>
                    <p className="text-[10.5px] text-foreground-500">{item.hint}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      className="field w-[76px] text-right text-[12.5px]"
                      value={draft.weights[item.key]}
                      onChange={(event) => setWeight(item.key, Number(event.target.value))}
                    />
                    <span className="text-[11.5px] text-foreground-500">%</span>
                  </div>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  className="mt-2 w-full cursor-pointer accent-primary-600"
                  value={draft.weights[item.key]}
                  onChange={(event) => setWeight(item.key, Number(event.target.value))}
                />
              </div>
            ))}
            <div
              className={`flex items-center justify-between rounded-lg border px-3 py-2 text-[11.5px] ${
                weightTotal === 100
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-rose-200 bg-rose-50 text-rose-800"
              }`}
            >
              <span>가중치 합계</span>
              <span className="font-semibold tabular-nums">{weightTotal}%</span>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="border-b border-background-200 px-4 py-3">
            <h4 className="text-[13px] font-semibold text-foreground-950">등급 기준</h4>
            <p className="mt-0.5 text-[11px] text-foreground-500">0~100점 구간을 나눕니다.</p>
          </div>
          <div className="space-y-4 px-4 py-4">
            <div>
              <label className="mb-1 block text-[12px] font-medium text-foreground-800">주의 시작 점수</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  className="field text-[12.5px]"
                  value={draft.thresholds.caution}
                  onChange={(event) => {
                    setDraft((prev) => ({ ...prev, thresholds: { ...prev.thresholds, caution: Number(event.target.value) } }));
                    setSaved("");
                  }}
                />
                <span className="text-[11.5px] text-foreground-500">점 이상</span>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-medium text-foreground-800">위험 시작 점수</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  className="field text-[12.5px]"
                  value={draft.thresholds.danger}
                  onChange={(event) => {
                    setDraft((prev) => ({ ...prev, thresholds: { ...prev.thresholds, danger: Number(event.target.value) } }));
                    setSaved("");
                  }}
                />
                <span className="text-[11.5px] text-foreground-500">점 이상</span>
              </div>
            </div>
            <div className="rounded-lg border border-background-300 bg-background-100 px-3 py-2.5 text-[11px] leading-5 text-foreground-600">
              <p className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> 0 ~ {draft.thresholds.caution - 1}점 · 정상</p>
              <p className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" /> {draft.thresholds.caution} ~ {draft.thresholds.danger - 1}점 · 주의</p>
              <p className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-500" /> {draft.thresholds.danger} ~ 100점 · 위험</p>
            </div>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <section className="card xl:col-span-2">
          <div className="border-b border-background-200 px-4 py-3">
            <h4 className="text-[13px] font-semibold text-foreground-950">병목 · 편중 임계값</h4>
            <p className="mt-0.5 text-[11px] text-foreground-500">초과 시 리스크 근거와 대응 제안에 반영됩니다.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 px-4 py-4 sm:grid-cols-2">
            <div className="min-w-0">
              <label className="mb-1 block text-[12px] font-medium text-foreground-800">WIP(진행 업무) 병목 기준</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  className="field text-[12.5px]"
                  value={draft.bottleneckWip}
                  onChange={(event) => setDraft({ ...draft, bottleneckWip: Number(event.target.value) })}
                />
                <span className="whitespace-nowrap text-[11.5px] text-foreground-500">건 초과</span>
              </div>
            </div>
            <div className="min-w-0">
              <label className="mb-1 block text-[12px] font-medium text-foreground-800">특정 담당자 편중 기준</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={100}
                  className="field text-[12.5px]"
                  value={draft.workloadShare}
                  onChange={(event) => setDraft({ ...draft, workloadShare: Number(event.target.value) })}
                />
                <span className="whitespace-nowrap text-[11.5px] text-foreground-500">% 초과</span>
              </div>
            </div>
          </div>
          <div className="border-t border-background-200 px-4 py-3">
            <label className="mb-1 block text-[12px] font-medium text-foreground-800">변경 사유 <span className="text-rose-600">*</span></label>
            <textarea
              className="field min-h-[64px] text-[12.5px]"
              maxLength={200}
              placeholder="예: 11월 회고에서 일정 지연 가중치 상향 합의"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
            {error && (
              <p className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-2 text-[11.5px] text-rose-700">{error}</p>
            )}
            {saved && (
              <p className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-[11.5px] text-emerald-700">{saved}</p>
            )}
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[10.5px] leading-4 text-foreground-500">
                저장 시 다음 계산부터 적용되며, 현재 프로젝트 점수는 즉시 바뀌지 않습니다.
              </p>
              <div className="flex gap-2">
                <button type="button" className="btn-outline" onClick={() => { setDraft(cloneSettings(riskSettings)); setNote(""); setError(""); setSaved(""); }}>
                  되돌리기
                </button>
                <button type="button" className="btn-primary" onClick={handleSave}>
                  설정 저장
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="border-b border-background-200 px-4 py-3">
            <h4 className="text-[13px] font-semibold text-foreground-950">현재 적용 설정</h4>
            <p className="mt-0.5 text-[11px] text-foreground-500">
              최근 변경 {riskSettings.updatedAt ? riskSettings.updatedAt.slice(0, 16).replace("T", " ") : "없음"}
            </p>
          </div>
          <ul className="space-y-2 px-4 py-3 text-[11.5px] text-foreground-700">
            <li className="flex justify-between"><span>일정 지연</span><span className="font-medium">{riskSettings.weights.schedule}%</span></li>
            <li className="flex justify-between"><span>병목</span><span className="font-medium">{riskSettings.weights.bottleneck}%</span></li>
            <li className="flex justify-between"><span>인력 편중</span><span className="font-medium">{riskSettings.weights.workload}%</span></li>
            <li className="flex justify-between"><span>파급 효과</span><span className="font-medium">{riskSettings.weights.impact}%</span></li>
            <li className="flex justify-between border-t border-background-200 pt-2"><span>주의 기준</span><span className="font-medium">{riskSettings.thresholds.caution}점</span></li>
            <li className="flex justify-between"><span>위험 기준</span><span className="font-medium">{riskSettings.thresholds.danger}점</span></li>
            <li className="flex justify-between border-t border-background-200 pt-2"><span>WIP 병목 기준</span><span className="font-medium">{riskSettings.bottleneckWip ?? 4}건</span></li>
            <li className="flex justify-between"><span>편중 기준</span><span className="font-medium">{riskSettings.workloadShare ?? 40}%</span></li>
          </ul>
        </section>
      </div>

      <section className="card overflow-hidden">
        <div className="border-b border-background-200 px-4 py-3">
          <h4 className="text-[13px] font-semibold text-foreground-950">변경 이력</h4>
          <p className="mt-0.5 text-[11px] text-foreground-500">설정 변경은 사유와 함께 기록됩니다.</p>
        </div>
        {riskSettingHistory.length === 0 ? (
          <p className="px-4 py-8 text-center text-[12px] text-foreground-500">아직 변경 이력이 없습니다. 위에서 설정을 저장해 보세요.</p>
        ) : (
          <ul className="divide-y divide-background-200">
            {riskSettingHistory.map((entry) => (
              <li key={entry.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[12px] font-medium text-foreground-900">{entry.note}</p>
                  <p className="text-[10.5px] text-foreground-500">
                    {users.find((u) => u.id === entry.changedBy)?.name || entry.changedBy} · {entry.changedAt.slice(0, 16).replace("T", " ")}
                  </p>
                </div>
                <div className="mt-1.5 grid grid-cols-1 gap-1.5 text-[11px] leading-5 sm:grid-cols-2">
                  <p className="rounded border border-background-200 bg-background-100 px-2 py-1.5 text-foreground-600">
                    변경 전 · {entry.before}
                  </p>
                  <p className="rounded border border-primary-200 bg-primary-50 px-2 py-1.5 text-primary-800">
                    변경 후 · {entry.after}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}