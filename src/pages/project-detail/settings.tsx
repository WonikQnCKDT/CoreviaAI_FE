import { useState } from "react";
import { useParams } from "react-router-dom";
import { useDemoStore } from "@/stores/DemoStore";
import { Badge } from "@/components/ui/Badge";
import Avatar from "@/components/ui/Avatar";
import EmptyState from "@/components/ui/EmptyState";
import Modal from "@/components/ui/Modal";
import GateApproverPanel from "@/features/gate/components/GateApproverPanel";
import { ROLE_LABEL } from "@/utils/ui";
import { canEditProject, isSystemAdmin } from "@/utils/permission";
import { gateApproverCandidates } from "@/features/gate/utils/gate";
import { BUTTON_TEXT } from "@/shared/i18n/catalog/button";

export default function ProjectSettingsPage() {
  const { projectId } = useParams();
  const { projects, users, currentUser, changeProjectPm } = useDemoStore();
  const [nextPmId, setNextPmId] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pmMessage, setPmMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const project = projects.find((p) => p.id === projectId);

  if (!project) {
    return (
      <div className="card">
        <EmptyState
          icon="ri-lock-2-line"
          title="프로젝트를 찾을 수 없습니다"
          description="삭제되었거나 접근 권한이 없는 프로젝트입니다. 프로젝트 목록에서 다시 확인해 주세요."
          tone="danger"
        />
      </div>
    );
  }

  const isPm = canEditProject(project, currentUser);
  // PM을 잃은 프로젝트를 정리할 수 있도록 시스템 관리자에게도 PM 변경 권한을 엽니다.
  const isAdmin = isSystemAdmin(currentUser);
  const canDelegatePm = isPm || isAdmin;
  const pm = users.find((u) => u.id === project.pmId);
  const assignable = gateApproverCandidates(project, users);
  // 위임 대상은 현재 PM을 제외한 프로젝트 멤버 중 활성 계정입니다.
  const pmCandidates = project.members
    .filter((member) => member.userId !== project.pmId)
    .map((member) => users.find((user) => user.id === member.userId))
    .filter((user): user is NonNullable<typeof user> => Boolean(user) && Boolean(user?.active));
  const nextPm = users.find((u) => u.id === nextPmId) || null;

  const requestPmChange = () => {
    if (!nextPmId) {
      setPmMessage({ tone: "error", text: "새 PM으로 위임할 멤버를 선택해 주세요." });
      return;
    }
    setConfirmOpen(true);
  };

  const confirmPmChange = () => {
    const result = changeProjectPm(project.id, nextPmId);
    setConfirmOpen(false);
    if (result.ok) {
      setPmMessage({ tone: "ok", text: result.message });
      setNextPmId("");
      return;
    }
    // 게이트 승인자로 지정된 멤버는 자동 해제하지 않고 그대로 차단합니다.
    setPmMessage({ tone: "error", text: result.message });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-[14px] font-semibold text-foreground-950">멤버·설정</h3>
          <p className="mt-0.5 text-[11.5px] text-foreground-500">
            게이트 승인자는 프로젝트 멤버 중에서 PM이 직접 지정합니다. 단계마다 서로 다른 승인자를 둘 수 있습니다.
          </p>
        </div>
        {!isPm && (
          <Badge className="border-background-300 bg-background-100 text-foreground-600">
            <i className="ri-eye-line mr-1" /> 읽기 전용 · 승인자 변경은 PM만 가능
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_300px]">
        <section className="card px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground-950">
              <i className="ri-shield-check-line text-primary-500" aria-hidden="true" />
              게이트별 승인자 · 승인 상태
            </h4>
            <span className="text-[10.5px] text-foreground-500">5단계 · 승인자 {assignable.length}명 후보</span>
          </div>
          <div className="mt-3">
            <GateApproverPanel project={project} editable={isPm} showBulk />
          </div>
        </section>

        <aside className="space-y-3">
          <div className="card px-4 py-3">
            <p className="text-[12px] font-semibold text-foreground-900">프로젝트 PM</p>
            <div className="mt-2 flex items-center gap-2.5 rounded-lg border border-primary-200 bg-primary-50 px-3 py-2.5">
              <Avatar name={pm?.name || "?"} size="sm" />
              <span className="min-w-0">
                <span className="block truncate text-[12.5px] font-medium text-foreground-900">{pm?.name || "-"}</span>
                <span className="block truncate text-[10.5px] text-foreground-500">{pm?.dept} · {pm?.job}</span>
              </span>
            </div>
            <p className="mt-2 text-[10.5px] leading-4 text-foreground-600">
              현재 PM은 게이트 승인자로 지정할 수 없습니다. 아래 PM 위임 절차를 사용해 주세요.
            </p>
          </div>

          <div className="card px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <p className="text-[12px] font-semibold text-foreground-900">PM 변경·위임</p>
              <Badge className="border-background-300 bg-background-100 text-foreground-600">
                {isPm ? "현재 PM" : isAdmin ? "시스템 관리자" : "권한 없음"}
              </Badge>
            </div>
            {canDelegatePm ? (
              <>
                <p className="mt-1 text-[10.5px] leading-4 text-foreground-600">
                  위임 전에 기존 PM과 새 PM을 확인합니다. 일반 멤버는 PM을 변경할 수 없습니다.
                </p>
                <select
                  className="field mt-2 text-[12px]"
                  value={nextPmId}
                  onChange={(event) => {
                    setNextPmId(event.target.value);
                    setPmMessage(null);
                  }}
                  aria-label="새 PM 선택"
                >
                  <option value="">새 PM 선택</option>
                  {pmCandidates.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} · {user.dept} · {ROLE_LABEL[project.members.find((m) => m.userId === user.id)?.role || "dev"]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={requestPmChange}
                  disabled={pmCandidates.length === 0}
                  className="btn-outline mt-2 w-full justify-center whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <i className="ri-user-shared-line" aria-hidden="true" /> {BUTTON_TEXT.delegatePm}
                </button>
                {pmCandidates.length === 0 && (
                  <p className="mt-1.5 text-[10.5px] leading-4 text-foreground-500">
                    위임할 수 있는 다른 활성 멤버가 없습니다. PM이 아닌 프로젝트 멤버만 위임 대상이 될 수 있습니다.
                  </p>
                )}
              </>
            ) : (
              <p className="mt-1 text-[10.5px] leading-4 text-foreground-600">
                PM 변경은 현재 PM 또는 시스템 관리자만 수행할 수 있습니다.
              </p>
            )}
            {pmMessage && (
              <p
                role="status"
                className={`mt-2 rounded-md border px-2.5 py-2 text-[10.5px] leading-4 ${
                  pmMessage.tone === "ok"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-rose-200 bg-rose-50 text-rose-700"
                }`}
              >
                {pmMessage.text}
              </p>
            )}
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-900">
              <i className="ri-information-line" /> 업무 담당자와 승인자는 다릅니다
            </p>
            <ul className="mt-1.5 space-y-1 text-[10.5px] leading-4 text-amber-800">
              <li>· 업무 담당자: 업무를 수행하는 사람 (내 업무·업무 목록에 표시)</li>
              <li>· 게이트 승인자: 산출물 검수와 단계 전환을 판정하는 사람 (승인 요청에 표시)</li>
              <li>· 승인자로 지정해도 업무 담당자로 자동 배정되지 않습니다.</li>
            </ul>
          </div>
        </aside>
      </div>

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-background-200 px-4 py-3">
          <h4 className="text-[13px] font-semibold text-foreground-950">현재 멤버 ({project.members.length}명)</h4>
          <span className="text-[10.5px] text-foreground-500">승인자 후보는 이 중 PM을 제외한 멤버입니다.</span>
        </div>
        <ul className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-2 xl:grid-cols-3">
          {project.members.map((member) => {
            const user = users.find((u) => u.id === member.userId);
            const isApprover = Object.values(project.gateApprovers || {}).includes(member.userId);
            return (
              <li
                key={member.userId}
                className="flex items-center gap-2.5 rounded-lg border border-background-200 bg-background-50 px-3 py-2"
              >
                <Avatar name={user?.name || "?"} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[12.5px] font-medium text-foreground-900">{user?.name}</span>
                    {member.userId === project.pmId && (
                      <Badge className="border-primary-200 bg-primary-50 text-primary-700">PM</Badge>
                    )}
                    {isApprover && member.userId !== project.pmId && (
                      <Badge className="border-accent-200 bg-accent-50 text-accent-800">승인자</Badge>
                    )}
                  </span>
                  <span className="block truncate text-[10.5px] text-foreground-500">
                    {user?.dept} · {ROLE_LABEL[member.role]}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <Modal
        open={confirmOpen}
        title="PM을 위임하시겠습니까?"
        description="위임이 완료되면 프로젝트의 PM 표시와 PM 권한이 함께 바뀝니다."
        onClose={() => setConfirmOpen(false)}
        width="max-w-md"
        footer={
          <>
            <button type="button" className="btn-outline whitespace-nowrap" onClick={() => setConfirmOpen(false)}>
              {BUTTON_TEXT.cancel}
            </button>
            <button type="button" className="btn-primary whitespace-nowrap" onClick={confirmPmChange}>
              {BUTTON_TEXT.executeDelegation}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_1fr]">
            <div className="rounded-lg border border-background-300 bg-background-50 px-3 py-2.5">
              <p className="text-[10.5px] text-foreground-500">기존 PM</p>
              <div className="mt-1.5 flex items-center gap-2">
                <Avatar name={pm?.name || "?"} size="sm" />
                <span className="min-w-0">
                  <span className="block truncate text-[12.5px] font-medium text-foreground-900">{pm?.name || "-"}</span>
                  <span className="block truncate text-[10px] text-foreground-500">{pm?.dept}</span>
                </span>
              </div>
            </div>
            <div className="flex items-center justify-center text-foreground-400">
              <i className="ri-arrow-right-line" aria-hidden="true" />
            </div>
            <div className="rounded-lg border border-primary-300 bg-primary-50 px-3 py-2.5">
              <p className="text-[10.5px] text-primary-700">새 PM</p>
              <div className="mt-1.5 flex items-center gap-2">
                <Avatar name={nextPm?.name || "?"} size="sm" />
                <span className="min-w-0">
                  <span className="block truncate text-[12.5px] font-medium text-foreground-900">{nextPm?.name || "-"}</span>
                  <span className="block truncate text-[10px] text-foreground-500">{nextPm?.dept}</span>
                </span>
              </div>
            </div>
          </div>
          <p className="text-[11px] leading-5 text-foreground-600">
            위임 대상이 게이트 승인자로 지정되어 있으면 위임이 차단됩니다. 이 경우 승인자 지정을 먼저 해제한 후 다시
            시도해 주세요. 승인자 지정은 자동으로 해제되지 않습니다.
          </p>
        </div>
      </Modal>
    </div>
  );
}