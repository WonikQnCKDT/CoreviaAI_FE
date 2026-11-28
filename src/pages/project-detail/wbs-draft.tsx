import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useDemoStore } from "@/stores/DemoStore";
import { useAuth } from "@/features/auth/authContext";
import ServerWbsDraft from "@/features/wbs/components/ServerWbsDraft";
import { Badge } from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { STAGES, STAGE_LABEL } from "@/utils/ui";
import { effortUnitText } from "@/features/task/utils/effort";
import { buildWbsDraft, type DraftWbsMilestone, type DraftWbsTask } from "@/features/knowledge/utils/aiDraft";
import { BUTTON_TEXT } from "@/shared/i18n/catalog/button";

interface DraftState {
  tasks: DraftWbsTask[];
  milestones: DraftWbsMilestone[];
}

function DemoWbsDraftPage() {
  const { projectId } = useParams();
  const { projects, currentUser, tasks, applyWbsDraft } = useDemoStore();
  const project = projects.find((p) => p.id === projectId);
  const [purpose, setPurpose] = useState("");
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  if (!project) return null;
  const isPm = project.pmId === currentUser.id;
  const existing = new Set(tasks.filter((t) => t.projectId === project.id).map((t) => `${t.stage}|${t.name}`));

  const generate = () => {
    if (purpose.trim().length < 10) {
      setError("프로젝트 목적이나 요구사항을 10자 이상 입력해 주세요.");
      return;
    }
    const next = buildWbsDraft(project, purpose);
    setDraft(next);
    setError("");
    setNotice("AI WBS 초안을 생성했습니다. 규칙 기반 데모 결과이므로 반드시 검토 후 선택해 주세요.");
  };

  const toggleTask = (id: string) => {
    if (!draft) return;
    setDraft({ ...draft, tasks: draft.tasks.map((t) => (t.id === id ? { ...t, selected: !t.selected } : t)) });
  };

  const updateTask = (id: string, patch: Partial<DraftWbsTask>) => {
    if (!draft) return;
    setDraft({ ...draft, tasks: draft.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
  };

  const toggleMilestone = (id: string) => {
    if (!draft) return;
    setDraft({ ...draft, milestones: draft.milestones.map((m) => (m.id === id ? { ...m, selected: !m.selected } : m)) });
  };

  const updateMilestone = (id: string, patch: Partial<DraftWbsMilestone>) => {
    if (!draft) return;
    setDraft({ ...draft, milestones: draft.milestones.map((m) => (m.id === id ? { ...m, ...patch } : m)) });
  };

  const apply = () => {
    if (!draft) return;
    if (!isPm) {
      setNotice("WBS 등록은 프로젝트 PM만 승인할 수 있습니다.");
      return;
    }
    const selectedTasks = draft.tasks.filter((t) => t.selected && t.name.trim());
    const selectedMilestones = draft.milestones.filter((m) => m.selected);
    if (selectedTasks.length === 0 && selectedMilestones.length === 0) {
      setNotice("WBS에 등록할 항목을 선택해 주세요.");
      return;
    }
    const duplicates = selectedTasks.filter((t) => existing.has(`${t.stage}|${t.name}`)).length;
    const created = applyWbsDraft(
      project.id,
      selectedTasks.map((t) => ({ stage: t.stage, name: t.name.trim(), estimate: t.estimate, description: t.description })),
      selectedMilestones.map((m) => ({ stage: m.stage, name: m.name, date: m.date })),
    );
    setNotice(`업무 ${created}건을 WBS에 등록했습니다.${duplicates > 0 ? ` 중복 항목 ${duplicates}건은 제외했습니다.` : ""} 승인한 항목만 반영됩니다.`);
    setDraft({
      tasks: draft.tasks.map((t) => (t.selected ? { ...t, selected: false } : t)),
      milestones: draft.milestones.map((m) => ({ ...m, selected: false })),
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div>
          <h3 className="text-[14px] font-semibold text-foreground-950">AI WBS 초안</h3>
          <p className="mt-0.5 text-[11.5px] text-foreground-500">프로젝트 목적·요구사항을 입력하면 5단계 작업과 마일스톤 초안을 만듭니다.</p>
        </div>
        <Badge className="border-amber-200 bg-amber-50 text-amber-700"><i className="ri-sparkling-2-line" /> AI 초안 · 데모</Badge>
        {!isPm && <Badge className="border-background-300 bg-background-100 text-foreground-500">PM만 등록 승인 가능</Badge>}
        <Link to={`/projects/${project.id}/wbs`} className="btn-ghost ml-auto py-1.5 text-[11.5px]">
          <i className="ri-arrow-left-line" /> WBS로 돌아가기
        </Link>
      </div>

      {notice && (
        <div className="flex items-start gap-2 rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-[12px] text-primary-800">
          <i className="ri-information-line mt-0.5" />
          <span className="flex-1">{notice}</span>
          <button type="button" onClick={() => setNotice("")} className="cursor-pointer opacity-60"><i className="ri-close-line" /></button>
        </div>
      )}

      <div className="card px-4 py-3">
        <label className="block">
          <span className="mb-1 block text-[11.5px] font-medium text-foreground-700">프로젝트 목적 또는 요구사항</span>
          <textarea
            className="field min-h-[96px] text-[12.5px] leading-5"
            value={purpose}
            maxLength={1000}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="예: 사내 업무포털에 통합검색과 권한 기반 문서 열람을 추가해 업무 누락을 줄이고, 관리자 콘솔에서 조직·권한을 관리할 수 있게 한다."
          />
        </label>
        {error && <p className="mt-1 text-[11px] text-rose-600">{error}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <p className="text-[10.5px] text-foreground-500">입력 내용은 데모 초안 생성에만 사용되며 서버로 전송되지 않습니다.</p>
          <button type="button" className="btn-primary ml-auto py-1.5" onClick={generate}>
            <i className="ri-sparkling-2-line" /> {BUTTON_TEXT.generateDraft}
          </button>
        </div>
      </div>

      {!draft ? (
        <div className="card">
          <EmptyState
            icon="ri-node-tree"
            title="아직 생성된 초안이 없습니다"
            description="프로젝트 목적을 입력하고 초안을 생성하면 단계별 작업과 마일스톤을 검토할 수 있습니다."
          />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
            <i className="ri-flask-line" />
            <span className="flex-1">아래 항목은 샘플 AI 초안입니다. PM이 수정·선택한 항목만 WBS에 등록되며, 같은 이름의 작업은 중복 등록되지 않습니다.</span>
            <span className="text-[10px]">선택 {draft.tasks.filter((t) => t.selected).length}건</span>
          </div>

          <div className="space-y-2.5">
            {STAGES.map((stage) => {
              const items = draft.tasks.filter((t) => t.stage === stage.key);
              return (
                <section key={stage.key} className="card overflow-hidden">
                  <div className="flex items-center gap-2 border-b border-background-200 bg-background-100/60 px-3.5 py-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-500 text-[10px] font-semibold text-background-50">
                      {STAGES.findIndex((s) => s.key === stage.key) + 1}
                    </span>
                    <p className="text-[12px] font-semibold text-foreground-900">{STAGE_LABEL[stage.key]}</p>
                    <span className="text-[10.5px] text-foreground-500">작업 {items.length}건 · 예상 작업량 {effortUnitText(items.reduce((sum, t) => sum + t.estimate, 0))}</span>
                  </div>
                  <ul className="divide-y divide-background-200">
                    {items.map((item) => {
                      const isDuplicate = existing.has(`${item.stage}|${item.name}`);
                      return (
                        <li key={item.id} className="flex flex-wrap items-start gap-2 px-3.5 py-2">
                          <input
                            type="checkbox"
                            className="mt-1.5 h-3.5 w-3.5 cursor-pointer accent-primary-500"
                            checked={item.selected}
                            onChange={() => toggleTask(item.id)}
                            disabled={!isPm}
                          />
                          <div className="min-w-0 flex-1">
                            <input
                              className="field py-1 text-[12px]"
                              value={item.name}
                              onChange={(e) => updateTask(item.id, { name: e.target.value })}
                              disabled={!isPm}
                            />
                            <p className="mt-0.5 text-[10.5px] text-foreground-500">{item.description}</p>
                            {isDuplicate && <p className="mt-0.5 text-[10px] text-amber-700"><i className="ri-error-warning-line" /> 동일 이름 작업이 이미 있어 등록 시 제외됩니다.</p>}
                          </div>
                          <label className="flex items-center gap-1 text-[10.5px] text-foreground-500" title="1인일은 1명이 하루 동안 수행하는 작업량입니다.">
                            <input
                              type="number"
                              min={0.5}
                              step={0.5}
                              className="field w-[64px] py-1 text-[11px]"
                              value={item.estimate}
                              onChange={(e) => updateTask(item.id, { estimate: Number(e.target.value) })}
                              disabled={!isPm}
                            />
                            인일
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>

          <section className="card overflow-hidden">
            <div className="border-b border-background-200 px-3.5 py-2">
              <p className="text-[12px] font-semibold text-foreground-900">마일스톤 초안</p>
            </div>
            <ul className="divide-y divide-background-200">
              {draft.milestones.map((milestone) => (
                <li key={milestone.id} className="flex flex-wrap items-center gap-2 px-3.5 py-2">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 cursor-pointer accent-primary-500"
                    checked={milestone.selected}
                    onChange={() => toggleMilestone(milestone.id)}
                    disabled={!isPm}
                  />
                  <span className="w-[58px] text-[10.5px] text-foreground-500">{STAGE_LABEL[milestone.stage]}</span>
                  <input className="field min-w-[160px] flex-1 py-1 text-[12px]" value={milestone.name} onChange={(e) => updateMilestone(milestone.id, { name: e.target.value })} disabled={!isPm} />
                  <input type="date" className="field w-auto py-1 text-[11px]" value={milestone.date} onChange={(e) => updateMilestone(milestone.id, { date: e.target.value })} disabled={!isPm} />
                </li>
              ))}
            </ul>
          </section>

          <div className="card flex flex-wrap items-center gap-2 px-4 py-3">
            <p className="text-[11px] text-foreground-600">
              등록 예정 업무 {draft.tasks.filter((t) => t.selected && !existing.has(`${t.stage}|${t.name}`)).length}건 · 마일스톤 {draft.milestones.filter((m) => m.selected).length}건
            </p>
            <div className="ml-auto flex gap-1.5">
              <button type="button" className="btn-outline py-1.5" onClick={() => setDraft(null)}>{BUTTON_TEXT.clearDraft}</button>
              <button type="button" className="btn-primary py-1.5" onClick={apply} disabled={!isPm}>
                <i className="ri-check-double-line" /> {BUTTON_TEXT.approveSelectedAddWbs}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * api 모드의 서버 프로젝트는 서버 WBS API(04. WBS·일정)로 그린다. 데모 업무를 서버 프로젝트에 섞지 않는다.
 * 데모 모드·프론트 데모 프로젝트는 기존 데모 화면을 그대로 쓴다.
 */
export default function WbsDraftPage() {
  const { mode } = useAuth();
  const { projectId } = useParams();
  const { projects } = useDemoStore();
  const project = projects.find((p) => p.id === projectId);
  if (mode === "api" && project?.serverId !== undefined) return <ServerWbsDraft project={{ ...project, serverId: project.serverId }} />;
  return <DemoWbsDraftPage />;
}
