import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useDemoStore } from "@/stores/DemoStore";
import Avatar from "@/components/ui/Avatar";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";
import type { BoardPost } from "@/types";
import { formatDate } from "@/utils/date";

interface PostForm {
  id: string | null;
  type: "notice" | "share";
  title: string;
  body: string;
  attachments: BoardPost["attachments"];
}

const EMPTY_FORM: PostForm = { id: null, type: "share", title: "", body: "", attachments: [] };

export default function BoardPage() {
  const { projectId } = useParams();
  const { projects, boardPosts, users, currentUser, addBoardPost, updateBoardPost, deleteBoardPost, togglePinPost } = useDemoStore();
  const project = projects.find((p) => p.id === projectId);
  const isPm = project?.pmId === currentUser.id;

  const [filter, setFilter] = useState<"all" | "notice" | "share">("all");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<PostForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const posts = useMemo(() => {
    return boardPosts
      .filter((p) => p.projectId === projectId)
      .filter((p) => filter === "all" || p.type === filter)
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return a.createdAt < b.createdAt ? 1 : -1;
      });
  }, [boardPosts, projectId, filter]);

  if (!project) return null;

  const openNew = () => {
    setForm({ ...EMPTY_FORM });
    setErrors({});
    setFormOpen(true);
  };

  const openEdit = (post: BoardPost) => {
    setForm({ id: post.id, type: post.type, title: post.title, body: post.body, attachments: post.attachments });
    setErrors({});
    setFormOpen(true);
  };

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const next = Array.from(files).map((file, index) => ({
      id: `local-${Date.now()}-${index}`,
      name: file.name,
      size: file.size > 1024 * 1024 ? `${(file.size / (1024 * 1024)).toFixed(1)}MB` : `${Math.max(1, Math.round(file.size / 1024))}KB`,
      local: true,
    }));
    setForm({ ...form, attachments: [...form.attachments, ...next] });
  };

  const submit = () => {
    const nextErrors: Record<string, string> = {};
    if (!form.title.trim()) nextErrors.title = "제목을 입력해 주세요.";
    if (!form.body.trim()) nextErrors.body = "내용을 입력해 주세요.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !projectId) return;

    if (form.id) {
      updateBoardPost(form.id, { type: form.type, title: form.title.trim(), body: form.body.trim(), attachments: form.attachments });
    } else {
      addBoardPost({ projectId, type: form.type, title: form.title.trim(), body: form.body.trim(), attachments: form.attachments });
    }
    setFormOpen(false);
  };

  const confirmDelete = () => {
    if (!deleteId) return;
    deleteBoardPost(deleteId);
    if (detailId === deleteId) setDetailId(null);
    setDeleteId(null);
  };

  const target = boardPosts.find((p) => p.id === deleteId);
  const detailPost = boardPosts.find((p) => p.id === detailId) || null;
  const detailAuthor = detailPost ? users.find((u) => u.id === detailPost.authorId) : undefined;
  const canManageDetail = Boolean(detailPost) && (isPm || detailPost?.authorId === currentUser.id);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div>
          <h3 className="text-[14px] font-semibold text-foreground-950">게시판</h3>
          <p className="mt-0.5 text-[11.5px] text-foreground-500">공지와 자료를 공유합니다. PM이 공지를 상단 고정하면 프로젝트 개요의 고정 공지에 반영됩니다.</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-0.5 rounded-full border border-background-300 bg-background-50 p-1">
            {(["all", "notice", "share"] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`cursor-pointer whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-medium transition ${
                  filter === key ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:bg-background-100"
                }`}
              >
                {key === "all" ? "전체" : key === "notice" ? "공지" : "자료 공유"}
              </button>
            ))}
          </div>
          <button type="button" className="btn-primary py-1.5" onClick={openNew}><i className="ri-edit-line" /> 글쓰기</button>
        </div>
      </div>

      {posts.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="ri-article-line"
            title="게시글이 없습니다"
            description="프로젝트 공지나 자료 공유 글을 작성해 보세요."
            action={<button type="button" className="btn-primary" onClick={openNew}><i className="ri-edit-line" /> 글쓰기</button>}
          />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <ul className="divide-y divide-background-200">
            {posts.map((post) => {
              const canManage = isPm || post.authorId === currentUser.id;
              return (
                <li key={post.id} className="flex items-center gap-2 px-3 py-2.5 transition hover:bg-background-100 sm:px-4">
                  <button
                    type="button"
                    onClick={() => setDetailId(post.id)}
                    className="flex min-w-0 flex-1 cursor-pointer flex-col gap-1 text-left sm:flex-row sm:items-center sm:gap-2"
                  >
                    <span className="flex min-w-0 flex-1 items-center gap-1.5">
                      {post.type === "notice" && (
                        <span role="img" aria-label="공지" title="공지" className="shrink-0 text-[12px] leading-none">
                          📢
                        </span>
                      )}
                      {post.pinned && (
                        <span className="flex shrink-0 items-center gap-0.5 whitespace-nowrap text-[10.5px] text-foreground-500">
                          <i className="ri-pushpin-2-line" aria-hidden="true" />
                          상단 고정
                        </span>
                      )}
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground-950">{post.title}</span>
                      {post.attachments.length > 0 && (
                        <span
                          className="flex shrink-0 items-center gap-0.5 text-[10.5px] text-foreground-500"
                          title={`첨부 ${post.attachments.length}개`}
                        >
                          <i className="ri-attachment-2" aria-hidden="true" />
                          <span className="tabular-nums">{post.attachments.length}</span>
                          <span className="sr-only">첨부 {post.attachments.length}개</span>
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-[10.5px] tabular-nums text-foreground-500 sm:w-[84px] sm:text-right">
                      {formatDate(post.createdAt.slice(0, 10))}
                    </span>
                  </button>
                  <div className="flex shrink-0 items-center gap-0.5">
                    {isPm && canManage && post.type === "notice" && (
                      <button
                        type="button"
                        onClick={() => togglePinPost(post.id)}
                        title={post.pinned ? "고정 해제" : "상단 고정"}
                        aria-label={post.pinned ? "고정 해제" : "상단 고정"}
                        className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-foreground-500 transition hover:bg-background-200 hover:text-foreground-900"
                      >
                        <i className={post.pinned ? "ri-unpin-line" : "ri-pushpin-2-line"} />
                      </button>
                    )}
                    {canManage && (
                      <>
                        <button
                          type="button"
                          onClick={() => openEdit(post)}
                          title="수정"
                          aria-label="수정"
                          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-foreground-500 transition hover:bg-background-200 hover:text-foreground-900"
                        >
                          <i className="ri-edit-line" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteId(post.id)}
                          title="삭제"
                          aria-label="삭제"
                          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-foreground-500 transition hover:bg-background-200 hover:text-rose-600"
                        >
                          <i className="ri-delete-bin-line" />
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <p className="rounded-lg border border-background-200 bg-background-50 px-3 py-2 text-[10.5px] leading-4 text-foreground-500">
        첨부 파일은 브라우저 메모리에만 표시되는 로컬 데모입니다. 서버 업로드나 파일 저장은 이루어지지 않습니다.
      </p>

      <Modal
        open={formOpen}
        title={form.id ? "게시글 수정" : "게시글 작성"}
        onClose={() => setFormOpen(false)}
        width="max-w-xl"
        footer={
          <>
            <button type="button" className="btn-outline" onClick={() => setFormOpen(false)}>취소</button>
            <button type="button" className="btn-primary" onClick={submit}><i className="ri-save-line" /> 저장</button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="flex items-center gap-1.5">
            {(["notice", "share"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setForm({ ...form, type })}
                className={`cursor-pointer rounded-full border px-3 py-1 text-[11.5px] font-medium ${
                  form.type === type ? "border-primary-300 bg-primary-50 text-primary-700" : "border-background-300 bg-background-50 text-foreground-600"
                }`}
              >
                {type === "notice" ? "공지" : "자료 공유"}
              </button>
            ))}
          </div>
          <label className="block">
            <span className="mb-1 block text-[11.5px] font-medium text-foreground-700">제목 <span className="text-rose-500">*</span></span>
            <input className="field text-[12.5px]" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            {errors.title && <span className="mt-1 block text-[11px] text-rose-600">{errors.title}</span>}
          </label>
          <label className="block">
            <span className="mb-1 block text-[11.5px] font-medium text-foreground-700">내용 <span className="text-rose-500">*</span></span>
            <textarea className="field min-h-[140px] text-[12.5px]" value={form.body} maxLength={2000} onChange={(e) => setForm({ ...form, body: e.target.value })} />
            {errors.body && <span className="mt-1 block text-[11px] text-rose-600">{errors.body}</span>}
          </label>
          <div>
            <span className="mb-1 block text-[11.5px] font-medium text-foreground-700">첨부 파일</span>
            <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-background-300 bg-background-100 px-3 py-3 text-[11.5px] text-foreground-600 hover:border-primary-300">
              <i className="ri-upload-2-line" /> 파일 선택 (로컬 데모 · 실제 업로드 없음)
              <input type="file" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
            </label>
            {form.attachments.length > 0 && (
              <ul className="mt-2 space-y-1">
                {form.attachments.map((file) => (
                  <li key={file.id} className="flex items-center gap-2 rounded-md border border-background-200 px-2.5 py-1.5 text-[11px]">
                    <i className="ri-file-line text-foreground-500" />
                    <span className="min-w-0 flex-1 truncate text-foreground-800">{file.name}</span>
                    <span className="text-foreground-400">{file.size}</span>
                    <button type="button" className="cursor-pointer text-foreground-400 hover:text-rose-600" onClick={() => setForm({ ...form, attachments: form.attachments.filter((f) => f.id !== file.id) })}>
                      <i className="ri-close-line" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {form.type === "notice" && <p className="mt-1 text-[10.5px] text-foreground-500">공지는 PM이 상단 고정할 수 있습니다.</p>}
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(detailPost)}
        title={detailPost?.title || "게시글"}
        onClose={() => setDetailId(null)}
        width="max-w-2xl"
        footer={
          <>
            {detailPost && isPm && detailPost.type === "notice" && (
              <button type="button" className="btn-outline" onClick={() => togglePinPost(detailPost.id)}>
                <i className={detailPost.pinned ? "ri-unpin-line" : "ri-pushpin-2-line"} />
                {detailPost.pinned ? "고정 해제" : "상단 고정"}
              </button>
            )}
            {detailPost && canManageDetail && (
              <>
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => {
                    setDetailId(null);
                    openEdit(detailPost);
                  }}
                >
                  <i className="ri-edit-line" /> 수정
                </button>
                <button type="button" className="btn-outline text-rose-600" onClick={() => setDeleteId(detailPost.id)}>
                  <i className="ri-delete-bin-line" /> 삭제
                </button>
              </>
            )}
            <button type="button" className="btn-primary whitespace-nowrap" onClick={() => setDetailId(null)}>닫기</button>
          </>
        }
      >
        {detailPost && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-foreground-600">
              <span className="flex items-center gap-1 rounded-md bg-background-100 px-1.5 py-0.5 font-medium text-foreground-700">
                {detailPost.type === "notice" ? (
                  <>
                    <span role="img" aria-label="공지" title="공지">📢</span> 공지
                  </>
                ) : (
                  <>
                    <i className="ri-file-text-line" aria-hidden="true" /> 자료 공유
                  </>
                )}
              </span>
              {detailPost.pinned && (
                <span className="flex items-center gap-0.5 text-[10.5px] text-foreground-500">
                  <i className="ri-pushpin-2-line" aria-hidden="true" />
                  상단 고정
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Avatar name={detailAuthor?.name || "?"} size="xs" />
                {detailAuthor?.name || "알 수 없음"}
              </span>
              <span className="tabular-nums text-foreground-500">
                {formatDate(detailPost.createdAt.slice(0, 10))} {detailPost.createdAt.slice(11, 16)}
              </span>
            </div>

            <div className="whitespace-pre-wrap rounded-lg border border-background-200 bg-background-100/60 px-3.5 py-3 text-[12.5px] leading-6 text-foreground-800">
              {detailPost.body}
            </div>

            <div>
              <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-foreground-800">
                <i className="ri-attachment-2" aria-hidden="true" />
                첨부 파일 {detailPost.attachments.length}개
              </p>
              {detailPost.attachments.length > 0 ? (
                <ul className="mt-1.5 space-y-1">
                  {detailPost.attachments.map((file) => (
                    <li key={file.id} className="flex items-center gap-2 rounded-md border border-background-200 px-2.5 py-1.5 text-[11.5px]">
                      <i className="ri-file-line text-foreground-500" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate text-foreground-800">{file.name}</span>
                      <span className="shrink-0 text-[10.5px] text-foreground-500">{file.size}</span>
                      {file.local && <span className="shrink-0 rounded bg-background-200 px-1 text-[9.5px] text-foreground-500">로컬 데모</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1.5 text-[11px] text-foreground-500">첨부된 파일이 없습니다.</p>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(deleteId)}
        title="게시글을 삭제할까요?"
        description="삭제한 게시글은 복구할 수 없습니다."
        onClose={() => setDeleteId(null)}
        footer={
          <>
            <button type="button" className="btn-outline" onClick={() => setDeleteId(null)}>취소</button>
            <button type="button" className="btn-primary" onClick={confirmDelete}>삭제</button>
          </>
        }
      >
        <p className="text-[12.5px] text-foreground-800">{target?.title}</p>
      </Modal>
    </div>
  );
}