import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useDemoStore } from "@/stores/DemoStore";
import { Badge } from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";
import type { KnowledgeDoc, Visibility } from "@/types";
import { VISIBILITY_LABEL } from "@/utils/ui";
import { formatDate } from "@/utils/date";
import { canViewKnowledge } from "@/utils/business";
import { BUTTON_TEXT } from "@/shared/i18n/catalog/button";

interface DocForm {
  title: string;
  body: string;
  tags: string;
  dept: string;
  projectId: string;
  visibility: Visibility;
}

const EMPTY_FORM: DocForm = { title: "", body: "", tags: "", dept: "", projectId: "", visibility: "company" };

export default function KnowledgeDocs() {
  const { knowledgeDocs, projects, users, currentUser, addKnowledgeDoc, updateKnowledgeDoc } = useDemoStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const focusId = searchParams.get("doc");
  const [query, setQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [visibilityFilter, setVisibilityFilter] = useState("all");
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<KnowledgeDoc | null>(null);
  const [form, setForm] = useState<DocForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [editNote, setEditNote] = useState("");

  const visibleDocs = useMemo(
    () => knowledgeDocs.filter((doc) => canViewKnowledge(doc, currentUser, projects)),
    [knowledgeDocs, currentUser, projects],
  );

  const deptOptions = useMemo(() => {
    const set = new Set<string>(users.map((u) => u.dept));
    visibleDocs.forEach((d) => set.add(d.dept));
    return Array.from(set);
  }, [users, visibleDocs]);

  const filtered = visibleDocs
    .filter((doc) => {
      if (deptFilter !== "all" && doc.dept !== deptFilter) return false;
      if (visibilityFilter !== "all" && doc.visibility !== visibilityFilter) return false;
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        const haystack = `${doc.title} ${doc.body} ${doc.tags.join(" ")}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));

  const focused = visibleDocs.find((d) => d.id === focusId) || null;
  const focusedProject = projects.find((p) => p.id === focused?.projectId);
  const canEditFocused = Boolean(
    focused && (focused.authorId === currentUser.id || currentUser.isSystemAdmin || focusedProject?.pmId === currentUser.id),
  );

  useEffect(() => {
    if (focusId && !focused) {
      const next = new URLSearchParams(searchParams);
      next.delete("doc");
      setSearchParams(next, { replace: true });
    }
  }, [focusId, focused, searchParams, setSearchParams]);

  const openNew = () => {
    setEditTarget(null);
    setForm({ ...EMPTY_FORM, dept: currentUser.dept });
    setErrors({});
    setEditNote("");
    setEditOpen(true);
  };

  const openEdit = (doc: KnowledgeDoc) => {
    setEditTarget(doc);
    setForm({
      title: doc.title,
      body: doc.body,
      tags: doc.tags.join(", "),
      dept: doc.dept,
      projectId: doc.projectId || "",
      visibility: doc.visibility,
    });
    setErrors({});
    setEditNote("");
    setEditOpen(true);
  };

  const submit = () => {
    const nextErrors: Record<string, string> = {};
    if (!form.title.trim()) nextErrors.title = "제목을 입력해 주세요.";
    if (!form.body.trim()) nextErrors.body = "본문을 입력해 주세요.";
    if (!form.dept.trim()) nextErrors.dept = "부서를 선택해 주세요.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    const payload = {
      title: form.title.trim(),
      body: form.body.trim(),
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      dept: form.dept,
      projectId: form.projectId || null,
      visibility: form.visibility,
    };
    if (editTarget) {
      updateKnowledgeDoc(editTarget.id, payload, editNote || "내용 수정");
    } else {
      addKnowledgeDoc(payload);
    }
    setEditOpen(false);
  };

  const closeFocus = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("doc");
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="relative">
            <i className="ri-search-line pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] text-foreground-400" />
            <input className="field w-[210px] py-1.5 pl-8 text-[12px]" placeholder="제목·본문·태그 검색" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <select className="field w-auto py-1.5 text-[12px]" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
            <option value="all">전체 부서</option>
            {deptOptions.map((dept) => <option key={dept} value={dept}>{dept}</option>)}
          </select>
          <select className="field w-auto py-1.5 text-[12px]" value={visibilityFilter} onChange={(e) => setVisibilityFilter(e.target.value)}>
            <option value="all">전체 공개 범위</option>
            <option value="company">전사 공개</option>
            <option value="department">부서 공개</option>
            <option value="members">멤버 전용</option>
          </select>
        </div>
        <button type="button" className="btn-primary ml-auto py-1.5" onClick={openNew}><i className="ri-add-line" /> {BUTTON_TEXT.writeDoc}</button>
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="ri-book-open-line"
            title={visibleDocs.length === 0 ? "조회 가능한 지식 문서가 없습니다" : "검색 결과가 없습니다"}
            description={visibleDocs.length === 0 ? "첫 지식 문서를 작성해 조직 지식을 축적해 보세요." : "검색어나 필터를 변경해 주세요."}
            action={
              visibleDocs.length === 0 ? (
                <button type="button" className="btn-primary" onClick={openNew}><i className="ri-add-line" /> {BUTTON_TEXT.writeDoc}</button>
              ) : (
                <button type="button" className="btn-outline" onClick={() => { setQuery(""); setDeptFilter("all"); setVisibilityFilter("all"); }}>{BUTTON_TEXT.resetFilters}</button>
              )
            }
          />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse">
              <thead>
                <tr>
                  <th className="th">제목</th>
                  <th className="th w-[170px]">태그</th>
                  <th className="th w-[100px]">부서</th>
                  <th className="th w-[130px]">프로젝트</th>
                  <th className="th w-[92px]">공개 범위</th>
                  <th className="th w-[64px]">버전</th>
                  <th className="th w-[96px]">수정일</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((doc) => {
                  const project = projects.find((p) => p.id === doc.projectId);
                  return (
                    <tr key={doc.id} className="cursor-pointer border-b border-background-200 last:border-0 hover:bg-background-100" onClick={() => setSearchParams({ doc: doc.id })}>
                      <td className="td">
                        <span className="block max-w-[320px] truncate font-medium text-foreground-900">{doc.title}</span>
                        {doc.sourceType && (
                          <span className="mt-0.5 flex items-center gap-1 text-[10px] text-primary-600">
                            <i className={doc.sourceType === "meeting" ? "ri-file-text-line" : "ri-bug-line"} />
                            {doc.sourceType === "meeting" ? "회의록에서 저장" : "이슈에서 저장"}
                          </span>
                        )}
                      </td>
                      <td className="td">
                        <span className="flex flex-wrap gap-1">
                          {doc.tags.slice(0, 3).map((tag) => <span key={tag} className="rounded bg-background-100 px-1.5 py-[1px] text-[10px] text-foreground-600">#{tag}</span>)}
                        </span>
                      </td>
                      <td className="td text-[11.5px]">{doc.dept}</td>
                      <td className="td text-[11.5px] text-foreground-600">{project?.name || "-"}</td>
                      <td className="td"><Badge className="border-background-300 bg-background-50 text-foreground-600">{VISIBILITY_LABEL[doc.visibility]}</Badge></td>
                      <td className="td text-[11.5px]">v{doc.currentVersion}</td>
                      <td className="td text-[11px] text-foreground-500">{formatDate(doc.updatedAt.slice(0, 10))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={Boolean(focused)}
        title={focused?.title || "지식 문서"}
        onClose={closeFocus}
        width="max-w-3xl"
        footer={
          focused ? (
            <>
              {focused.sourceType && focused.projectId && (
                <Link
                  to={focused.sourceType === "meeting" ? `/projects/${focused.projectId}/collab/meeting?meeting=${focused.sourceId}` : `/projects/${focused.projectId}/issues`}
                  className="btn-outline"
                >
                  <i className="ri-link" /> 원본 열기
                </Link>
              )}
              {canEditFocused && <button type="button" className="btn-primary" onClick={() => openEdit(focused)}><i className="ri-edit-line" /> {BUTTON_TEXT.edit}</button>}
            </>
          ) : null
        }
      >
        {focused && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge className="border-background-300 bg-background-50 text-foreground-600">{focused.dept}</Badge>
              <Badge className="border-background-300 bg-background-50 text-foreground-600">{VISIBILITY_LABEL[focused.visibility]}</Badge>
              <Badge className="border-primary-200 bg-primary-50 text-primary-700">v{focused.currentVersion}</Badge>
              {focused.tags.map((tag) => <span key={tag} className="rounded bg-background-100 px-1.5 py-[1px] text-[10px] text-foreground-600">#{tag}</span>)}
            </div>
            <p className="whitespace-pre-wrap rounded-lg border border-background-200 bg-background-50 px-3.5 py-3 text-[12px] leading-6 text-foreground-800">{focused.body}</p>
            <div className="text-[10.5px] text-foreground-500">
              작성 {users.find((u) => u.id === focused.authorId)?.name || "-"} · 최초 {formatDate(focused.createdAt.slice(0, 10))} · 최근 수정 {formatDate(focused.updatedAt.slice(0, 10))}
              {focusedProject && ` · ${focusedProject.name}`}
            </div>
            <div className="rounded-lg border border-background-200 px-3.5 py-2.5">
              <p className="text-[11px] font-semibold text-foreground-800">버전 이력</p>
              <ul className="mt-1.5 space-y-1.5">
                {[...focused.versions].reverse().map((version) => (
                  <li key={version.id} className="flex flex-wrap items-center gap-2 text-[11px]">
                    <Badge className="border-background-300 bg-background-100 text-foreground-700">v{version.version}</Badge>
                    <span className="text-foreground-800">{version.title}</span>
                    <span className="text-foreground-500">{users.find((u) => u.id === version.editedBy)?.name} · {formatDate(version.editedAt.slice(0, 10))}</span>
                    {version.note && <span className="text-foreground-500">· {version.note}</span>}
                  </li>
                ))}
              </ul>
            </div>
            {focused.sourceType && (
              <p className="rounded-md border border-primary-200 bg-primary-50 px-3 py-2 text-[10.5px] text-primary-800">
                <i className="ri-link mr-1" /> {focused.sourceType === "meeting" ? "회의록" : "이슈"}에서 저장된 문서로 원본 링크가 유지됩니다.
              </p>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={editOpen}
        title={editTarget ? "지식 문서 수정" : "지식 문서 작성"}
        description={editTarget ? "수정 시 새 버전이 생성되고 이전 버전 이력이 유지됩니다." : "프로젝트에서 얻은 지식을 문서로 남겨 보세요."}
        onClose={() => setEditOpen(false)}
        width="max-w-2xl"
        footer={
          <>
            <button type="button" className="btn-outline" onClick={() => setEditOpen(false)}>{BUTTON_TEXT.cancel}</button>
            <button type="button" className="btn-primary" onClick={submit}><i className="ri-save-line" /> {BUTTON_TEXT.save}</button>
          </>
        }
      >
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-[11.5px] font-medium text-foreground-700">제목 <span className="text-rose-500">*</span></span>
            <input className="field text-[12.5px]" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            {errors.title && <span className="mt-1 block text-[11px] text-rose-600">{errors.title}</span>}
          </label>
          <label className="block">
            <span className="mb-1 block text-[11.5px] font-medium text-foreground-700">본문 <span className="text-rose-500">*</span></span>
            <textarea className="field min-h-[150px] text-[12.5px] leading-5" value={form.body} maxLength={3000} onChange={(e) => setForm({ ...form, body: e.target.value })} />
            {errors.body && <span className="mt-1 block text-[11px] text-rose-600">{errors.body}</span>}
          </label>
          <label className="block">
            <span className="mb-1 block text-[11.5px] font-medium text-foreground-700">태그 (쉼표 구분)</span>
            <input className="field text-[12.5px]" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="권한, 보안, 프로젝트" />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="block min-w-0">
              <span className="mb-1 block text-[11.5px] font-medium text-foreground-700">부서</span>
              <select className="field text-[12px]" value={form.dept} onChange={(e) => setForm({ ...form, dept: e.target.value })}>
                <option value="">선택</option>
                {deptOptions.map((dept) => <option key={dept} value={dept}>{dept}</option>)}
              </select>
              {errors.dept && <span className="mt-1 block text-[11px] text-rose-600">{errors.dept}</span>}
            </label>
            <label className="block min-w-0">
              <span className="mb-1 block text-[11.5px] font-medium text-foreground-700">프로젝트</span>
              <select className="field text-[12px]" value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
                <option value="">연결 없음</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label className="block min-w-0">
              <span className="mb-1 block text-[11.5px] font-medium text-foreground-700">공개 범위</span>
              <select className="field text-[12px]" value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value as Visibility })}>
                <option value="company">전사 공개</option>
                <option value="department">부서 공개</option>
                <option value="members">멤버 전용</option>
              </select>
            </label>
          </div>
          {editTarget && (
            <label className="block">
              <span className="mb-1 block text-[11.5px] font-medium text-foreground-700">수정 메모</span>
              <input className="field text-[12px]" value={editNote} onChange={(e) => setEditNote(e.target.value)} placeholder="예: 보안팀 의견 반영" />
            </label>
          )}
        </div>
      </Modal>
    </div>
  );
}