import { Link } from "react-router-dom";
import Modal from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import type { KnowledgeDoc } from "@/types";
import { VISIBILITY_LABEL } from "@/utils/ui";
import { formatDate } from "@/utils/date";
import { useDemoStore } from "@/stores/DemoStore";

interface DocPreviewModalProps {
  doc: KnowledgeDoc | null;
  onClose: () => void;
}

export default function DocPreviewModal({ doc, onClose }: DocPreviewModalProps) {
  const { users, projects } = useDemoStore();
  const project = projects.find((item) => item.id === doc?.projectId);
  const author = users.find((user) => user.id === doc?.authorId);

  return (
    <Modal
      open={Boolean(doc)}
      title={doc?.title || "지식 문서"}
      description="답변의 근거로 사용된 문서입니다. 조회 권한이 있는 문서만 열립니다."
      onClose={onClose}
      width="max-w-2xl"
      footer={
        doc ? (
          <Link to={`/knowledge?doc=${doc.id}`} className="btn-primary" onClick={onClose}>
            <i className="ri-external-link-line" /> 지식 문서 탭에서 열기
          </Link>
        ) : null
      }
    >
      {doc && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge className="border-background-300 bg-background-50 text-foreground-600">{doc.dept}</Badge>
            <Badge className="border-background-300 bg-background-50 text-foreground-600">{VISIBILITY_LABEL[doc.visibility]}</Badge>
            <Badge className="border-primary-200 bg-primary-50 text-primary-700">v{doc.currentVersion}</Badge>
            {project && <Badge className="border-background-300 bg-background-100 text-foreground-700">{project.name}</Badge>}
          </div>

          <p className="whitespace-pre-wrap rounded-lg border border-background-200 bg-background-50 px-3.5 py-3 text-[12px] leading-6 text-foreground-800">
            {doc.body}
          </p>

          <div className="flex flex-wrap items-center gap-1.5">
            {doc.tags.map((tag) => (
              <span key={tag} className="rounded bg-background-100 px-1.5 py-[1px] text-[10px] text-foreground-600">#{tag}</span>
            ))}
          </div>

          <p className="text-[10.5px] text-foreground-500">
            작성 {author?.name || "-"} · 최근 수정 {formatDate(doc.updatedAt.slice(0, 10))}
          </p>
          <p className="rounded-md border border-background-200 bg-background-100 px-3 py-2 text-[10.5px] leading-4 text-foreground-600">
            <i className="ri-lock-line mr-1" /> 답변과 출처는 현재 사용자의 조회 권한 범위 안에서만 표시됩니다.
          </p>
        </div>
      )}
    </Modal>
  );
}