import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useDemoStore } from "@/stores/DemoStore";
import { Badge } from "@/components/ui/Badge";
import Avatar from "@/components/ui/Avatar";
import EmptyState from "@/components/ui/EmptyState";
import { formatDate } from "@/utils/date";
import { STAGE_LABEL } from "@/utils/ui";
import { approvalRequestsForUser } from "@/features/gate/utils/gate";

/**
 * 나에게 온 게이트 승인 요청 목록입니다.
 * 업무 담당자 목록(내 업무 TODO)과 완전히 분리해서 표시합니다.
 */
export default function ApprovalTab() {
  const { projects, deliverables, users, currentUser } = useDemoStore();

  const requests = useMemo(
    () => approvalRequestsForUser(projects, deliverables, currentUser.id),
    [projects, deliverables, currentUser.id],
  );

  const projectCount = new Set(requests.map((item) => item.project.id)).size;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="card flex items-center gap-3 px-4 py-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
            <i className="ri-shield-check-line text-[17px]" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-[10.5px] text-foreground-500">검수 대기 승인 요청</span>
            <span className="block text-[15px] font-semibold text-foreground-950">{requests.length}건</span>
          </span>
        </div>
        <div className="card flex items-center gap-3 px-4 py-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-50 text-accent-700">
            <i className="ri-folder-shield-2-line text-[17px]" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-[10.5px] text-foreground-500">승인 요청이 온 프로젝트</span>
            <span className="block text-[15px] font-semibold text-foreground-950">{projectCount}개</span>
          </span>
        </div>
      </div>

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-background-200 px-4 py-3">
          <div>
            <h2 className="flex items-center gap-2 text-[13.5px] font-semibold text-foreground-950">
              <i className="ri-shield-user-line text-primary-500" aria-hidden="true" />
              게이트 승인 요청
              <span className="text-[11.5px] font-normal text-foreground-500">{requests.length}건</span>
            </h2>
            <p className="mt-0.5 text-[11px] text-foreground-500">
              내가 게이트 승인자로 지정된 산출물만 표시됩니다. 업무 담당자 배정과는 별개입니다.
            </p>
          </div>
        </div>

        {requests.length === 0 ? (
          <EmptyState
            icon="ri-shield-check-line"
            title="나에게 지정된 승인 요청이 없습니다"
            description="프로젝트 PM이 게이트 승인자로 지정하고 산출물이 제출되면 이곳에 요청이 표시됩니다. 승인자 미지정 상태는 자동으로 승인되지 않습니다."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse">
              <thead>
                <tr>
                  <th className="th">산출물</th>
                  <th className="th w-[170px]">프로젝트</th>
                  <th className="th w-[100px]">게이트</th>
                  <th className="th w-[120px]">요청자</th>
                  <th className="th w-[110px]">요청일</th>
                  <th className="th w-[96px]">상태</th>
                  <th className="th w-[120px]">처리</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((item) => {
                  const submitter = item.submittedBy ? users.find((u) => u.id === item.submittedBy) : null;
                  return (
                    <tr key={item.deliverable.id} className="border-b border-background-200 last:border-0 hover:bg-background-100">
                      <td className="td">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-[12.5px] font-medium text-foreground-900">{item.deliverable.name}</span>
                          <Badge className="border-background-300 bg-background-50 text-foreground-600">
                            {item.deliverable.currentVersion}
                          </Badge>
                          {item.deliverable.required && (
                            <Badge className="border-rose-200 bg-rose-50 text-rose-700">필수</Badge>
                          )}
                        </span>
                      </td>
                      <td className="td">
                        <span className="block truncate text-[12px] text-foreground-700">{item.project.name}</span>
                      </td>
                      <td className="td">
                        <span className="whitespace-nowrap text-[11.5px] text-foreground-700">{STAGE_LABEL[item.stage]}</span>
                      </td>
                      <td className="td">
                        <span className="flex items-center gap-1.5">
                          {submitter && <Avatar name={submitter.name} size="xs" />}
                          <span className="truncate text-[11.5px] text-foreground-700">{submitter?.name || "-"}</span>
                        </span>
                      </td>
                      <td className="td">
                        <span className="whitespace-nowrap text-[11px] text-foreground-600">{formatDate(item.requestedAt)}</span>
                      </td>
                      <td className="td">
                        <Badge className="border-primary-200 bg-primary-50 text-primary-700">검수 대기</Badge>
                      </td>
                      <td className="td">
                        <Link
                          to={`/projects/${item.project.id}/collab/deliverables`}
                          className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-2.5 py-1 text-[11.5px] font-medium text-foreground-700 hover:border-primary-300 hover:text-primary-700"
                        >
                          <i className="ri-edit-line" aria-hidden="true" /> 검수하기
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="rounded-lg border border-background-300 bg-background-100 px-3.5 py-2.5 text-[11px] leading-5 text-foreground-600">
        승인 요청과 업무 담당자는 서로 다른 개념입니다. 승인자로 지정되어도 해당 업무가 내 업무 목록에 자동으로 추가되지는
        않습니다. 승인자 미지정 상태는 자동 승인으로 처리되지 않으며, PM이 승인자를 지정해야 검수를 진행할 수 있습니다.
      </p>
    </div>
  );
}