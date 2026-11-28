import { useMemo, useState } from "react";
import { useDemoStore } from "@/stores/DemoStore";
import { Badge } from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";
import type { GlossaryEntry } from "@/types";
import { formatDate } from "@/utils/date";
import { BUTTON_TEXT } from "@/shared/i18n/catalog/button";

interface TermForm {
  term: string;
  definition: string;
  synonyms: string;
  relatedDocIds: string[];
}

const EMPTY_FORM: TermForm = { term: "", definition: "", synonyms: "", relatedDocIds: [] };

export default function GlossaryTab() {
  const { glossary, knowledgeDocs, users, currentUser, addGlossaryTerm, updateGlossaryTerm } = useDemoStore();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<GlossaryEntry | null>(null);
  const [form, setForm] = useState<TermForm>(EMPTY_FORM);
  const [error, setError] = useState("");
  const [historyOpen, setHistoryOpen] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      glossary
        .filter((g) => {
          if (!query.trim()) return true;
          const q = query.trim().toLowerCase();
          return `${g.term} ${g.definition} ${g.synonyms.join(" ")}`.toLowerCase().includes(q);
        })
        .sort((a, b) => a.term.localeCompare(b.term, "ko")),
    [glossary, query],
  );

  const openNew = () => {
    setTarget(null);
    setForm(EMPTY_FORM);
    setError("");
    setOpen(true);
  };

  const openEdit = (entry: GlossaryEntry) => {
    setTarget(entry);
    setForm({
      term: entry.term,
      definition: entry.definition,
      synonyms: entry.synonyms.join(", "),
      relatedDocIds: entry.relatedDocIds,
    });
    setError("");
    setOpen(true);
  };

  const submit = () => {
    if (!form.term.trim()) {
      setError("용어를 입력해 주세요.");
      return;
    }
    if (!form.definition.trim()) {
      setError("정의를 입력해 주세요.");
      return;
    }
    const normalized = form.term.trim().toLowerCase();
    const duplicate = glossary.find((g) => g.id !== target?.id && (g.term.trim().toLowerCase() === normalized || g.synonyms.some((s) => s.trim().toLowerCase() === normalized)));
    if (duplicate) {
      setError(`중복 용어 경고: '${duplicate.term}'과(와) 같거나 동의어로 등록된 용어입니다.`);
      return;
    }
    const payload = {
      term: form.term.trim(),
      definition: form.definition.trim(),
      synonyms: form.synonyms.split(",").map((s) => s.trim()).filter(Boolean),
      relatedDocIds: form.relatedDocIds,
    };
    if (target) updateGlossaryTerm(target.id, payload);
    else addGlossaryTerm(payload);
    setOpen(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <i className="ri-search-line pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] text-foreground-400" />
          <input className="field w-[250px] py-1.5 pl-8 text-[12px]" placeholder="용어·정의·동의어 검색" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <span className="text-[10.5px] text-foreground-500">총 {glossary.length}개 용어 · 중복 용어는 등록 시 경고됩니다.</span>
        <button type="button" className="btn-primary ml-auto py-1.5" onClick={openNew}><i className="ri-add-line" /> {BUTTON_TEXT.addTerm}</button>
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="ri-book-2-line"
            title={glossary.length === 0 ? "등록된 용어가 없습니다" : "검색 결과가 없습니다"}
            description={glossary.length === 0 ? "프로젝트에서 사용하는 용어를 정의해 공유해 보세요." : "다른 검색어로 시도해 주세요."}
            action={glossary.length === 0 ? <button type="button" className="btn-primary" onClick={openNew}><i className="ri-add-line" /> {BUTTON_TEXT.addTerm}</button> : undefined}
          />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse">
              <thead>
                <tr>
                  <th className="th w-[150px]">용어</th>
                  <th className="th">정의</th>
                  <th className="th w-[150px]">동의어</th>
                  <th className="th w-[110px]">관련 문서</th>
                  <th className="th w-[92px]">수정일</th>
                  <th className="th w-[80px]">이력</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => (
                  <tr key={entry.id} className="border-b border-background-200 last:border-0">
                    <td className="td">
                      <button type="button" className="cursor-pointer font-semibold text-foreground-900 hover:text-primary-700" onClick={() => openEdit(entry)}>{entry.term}</button>
                    </td>
                    <td className="td text-[12px] leading-5 text-foreground-700">{entry.definition}</td>
                    <td className="td text-[11px] text-foreground-600">{entry.synonyms.length > 0 ? entry.synonyms.join(", ") : "-"}</td>
                    <td className="td text-[11.5px]">{entry.relatedDocIds.length}건</td>
                    <td className="td text-[10.5px] text-foreground-500">{formatDate(entry.updatedAt.slice(0, 10))}</td>
                    <td className="td">
                      {entry.history.length > 0 ? (
                        <button type="button" className="cursor-pointer text-[11px] text-primary-600 hover:underline" onClick={() => setHistoryOpen(historyOpen === entry.id ? null : entry.id)}>
                          {entry.history.length}건
                        </button>
                      ) : (
                        <span className="text-[10.5px] text-foreground-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {historyOpen && (
            <div className="border-t border-background-200 bg-background-100 px-4 py-2.5">
              {(() => {
                const entry = glossary.find((g) => g.id === historyOpen);
                if (!entry) return null;
                return (
                  <div>
                    <p className="text-[10.5px] font-semibold text-foreground-600">‘{entry.term}’ 변경 이력</p>
                    <ul className="mt-1 space-y-1">
                      {entry.history.map((h) => (
                        <li key={h.id} className="text-[10.5px] text-foreground-600">
                          {users.find((u) => u.id === h.editedBy)?.name} · {formatDate(h.editedAt.slice(0, 10))} — {h.after}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      <Modal
        open={open}
        title={target ? "용어 수정" : "용어 등록"}
        description="동의어가 겹치면 중복 용어로 경고합니다. 변경 시 이력이 기록됩니다."
        onClose={() => setOpen(false)}
        width="max-w-xl"
        footer={
          <>
            <button type="button" className="btn-outline" onClick={() => setOpen(false)}>{BUTTON_TEXT.cancel}</button>
            <button type="button" className="btn-primary" onClick={submit}><i className="ri-save-line" /> {BUTTON_TEXT.save}</button>
          </>
        }
      >
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-[11.5px] font-medium text-foreground-700">용어 <span className="text-rose-500">*</span></span>
            <input className="field text-[12.5px]" value={form.term} onChange={(e) => { setForm({ ...form, term: e.target.value }); setError(""); }} placeholder="예: 게이트 검수" />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11.5px] font-medium text-foreground-700">정의 <span className="text-rose-500">*</span></span>
            <textarea className="field min-h-[80px] text-[12.5px]" value={form.definition} maxLength={500} onChange={(e) => setForm({ ...form, definition: e.target.value })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11.5px] font-medium text-foreground-700">동의어 (쉼표 구분)</span>
            <input className="field text-[12.5px]" value={form.synonyms} onChange={(e) => setForm({ ...form, synonyms: e.target.value })} placeholder="단계 게이트, Gate Review" />
          </label>
          <div>
            <span className="mb-1 block text-[11.5px] font-medium text-foreground-700">관련 문서</span>
            <div className="max-h-[120px] space-y-1 overflow-y-auto rounded-lg border border-background-200 bg-background-50 px-2.5 py-2">
              {knowledgeDocs.map((doc) => (
                <label key={doc.id} className="flex cursor-pointer items-start gap-2 text-[11px] text-foreground-700">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-3.5 w-3.5 accent-primary-500"
                    checked={form.relatedDocIds.includes(doc.id)}
                    onChange={(e) => setForm({ ...form, relatedDocIds: e.target.checked ? [...form.relatedDocIds, doc.id] : form.relatedDocIds.filter((id) => id !== doc.id) })}
                  />
                  <span className="min-w-0 flex-1 truncate">{doc.title}</span>
                </label>
              ))}
            </div>
          </div>
          {error && <p className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800"><i className="ri-error-warning-line mr-1" />{error}</p>}
          {target && target.history.length > 0 && (
            <div className="rounded-md border border-background-200 bg-background-100 px-2.5 py-2">
              <p className="text-[10.5px] font-semibold text-foreground-600">변경 이력</p>
              <ul className="mt-1 space-y-0.5">
                {target.history.slice(0, 3).map((h) => (
                  <li key={h.id} className="text-[10px] text-foreground-500">{users.find((u) => u.id === h.editedBy)?.name} · {formatDate(h.editedAt.slice(0, 10))} — {h.after}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-[10px] text-foreground-500">수정자: {currentUser.name} · 저장 시 변경 이력이 추가됩니다.</p>
        </div>
      </Modal>
    </div>
  );
}