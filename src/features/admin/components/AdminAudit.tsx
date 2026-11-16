import { useMemo, useState } from "react";
import { useDemoStore } from "@/stores/DemoStore";
import EmptyState from "@/components/ui/EmptyState";
import { TODAY } from "@/utils/date";
import type { AuditType } from "@/types";

const TYPE_LABEL: Record<AuditType, string> = {
  login_success: "로그인 성공",
  login_fail: "로그인 실패",
  permission: "권한·설정 변경",
  download: "다운로드",
  ai: "AI 요청",
  approval: "승인",
};

const TYPE_CLASS: Record<AuditType, string> = {
  login_success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  login_fail: "border-rose-200 bg-rose-50 text-rose-700",
  permission: "border-primary-200 bg-primary-50 text-primary-700",
  download: "border-background-300 bg-background-100 text-foreground-600",
  ai: "border-accent-200 bg-accent-50 text-accent-800",
  approval: "border-amber-200 bg-amber-50 text-amber-800",
};

export default function AdminAudit() {
  const { auditLogs, users } = useDemoStore();
  const [from, setFrom] = useState("2026-11-01");
  const [to, setTo] = useState(TODAY);
  const [userId, setUserId] = useState("all");
  const [type, setType] = useState<"all" | AuditType>("all");

  const logs = useMemo(
    () =>
      auditLogs
        .filter((log) => {
          const day = log.at.slice(0, 10);
          const matchesDate = day >= from && day <= to;
          const matchesUser = userId === "all" || log.userId === userId;
          const matchesType = type === "all" || log.type === type;
          return matchesDate && matchesUser && matchesType;
        })
        .sort((a, b) => (a.at < b.at ? 1 : -1)),
    [auditLogs, from, to, userId, type],
  );

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    auditLogs.forEach((log) => {
      map[log.type] = (map[log.type] || 0) + 1;
    });
    return map;
  }, [auditLogs]);

  const reset = () => {
    setFrom("2026-11-01");
    setTo(TODAY);
    setUserId("all");
    setType("all");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-[13.5px] font-semibold text-foreground-950">보안 · 접속 로그</h3>
          <p className="mt-0.5 text-[11px] leading-5 text-foreground-500">
            로그인 성공·실패, 권한 변경, 다운로드, AI 요청, 승인 기록을 조회합니다. 읽기 전용이며 수정·삭제 기능은
            제공하지 않습니다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[10.5px] font-medium text-amber-800">
            가상 로그 · 실제 운영 로그 아님
          </span>
          <span className="rounded border border-background-300 bg-background-50 px-2 py-1 text-[10.5px] text-foreground-600">
            <i className="ri-eye-line mr-1" /> 읽기 전용
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="card px-3.5 py-3">
          <p className="text-[11px] text-foreground-500">로그인 실패</p>
          <p className="mt-0.5 text-[20px] font-semibold text-rose-600">{counts.login_fail || 0}<span className="ml-1 text-[11px] font-normal text-foreground-500">건</span></p>
        </div>
        <div className="card px-3.5 py-3">
          <p className="text-[11px] text-foreground-500">권한·설정 변경</p>
          <p className="mt-0.5 text-[20px] font-semibold text-primary-700">{counts.permission || 0}<span className="ml-1 text-[11px] font-normal text-foreground-500">건</span></p>
        </div>
        <div className="card px-3.5 py-3">
          <p className="text-[11px] text-foreground-500">승인 기록</p>
          <p className="mt-0.5 text-[20px] font-semibold text-amber-600">{counts.approval || 0}<span className="ml-1 text-[11px] font-normal text-foreground-500">건</span></p>
        </div>
        <div className="card px-3.5 py-3">
          <p className="text-[11px] text-foreground-500">AI 요청</p>
          <p className="mt-0.5 text-[20px] font-semibold text-accent-700">{counts.ai || 0}<span className="ml-1 text-[11px] font-normal text-foreground-500">건</span></p>
        </div>
      </div>

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-end gap-2 border-b border-background-200 px-4 py-3">
          <div>
            <label className="mb-1 block text-[10.5px] text-foreground-500">시작일</label>
            <input type="date" className="field w-[142px] text-[12px]" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-[10.5px] text-foreground-500">종료일</label>
            <input type="date" className="field w-[142px] text-[12px]" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-[10.5px] text-foreground-500">사용자</label>
            <select className="field w-[140px] text-[12px]" value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="all">전체</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10.5px] text-foreground-500">유형</label>
            <select className="field w-[142px] text-[12px]" value={type} onChange={(e) => setType(e.target.value as "all" | AuditType)}>
              <option value="all">전체</option>
              {(Object.keys(TYPE_LABEL) as AuditType[]).map((key) => (
                <option key={key} value={key}>
                  {TYPE_LABEL[key]}
                </option>
              ))}
            </select>
          </div>
          <button type="button" className="btn-outline" onClick={reset}>
            <i className="ri-refresh-line" /> 초기화
          </button>
          <span className="ml-auto text-[11.5px] text-foreground-500">총 {logs.length}건</span>
        </div>

        {logs.length === 0 ? (
          <EmptyState
            icon="ri-file-shield-2-line"
            title="조건에 맞는 로그가 없습니다"
            description="기간·사용자·유형 필터를 변경해 다시 확인해 주세요."
            action={
              <button type="button" className="btn-outline" onClick={reset}>
                필터 초기화
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[940px] border-collapse">
              <thead>
                <tr>
                  <th className="th w-[152px]">일시</th>
                  <th className="th w-[120px]">사용자</th>
                  <th className="th w-[124px]">유형</th>
                  <th className="th w-[124px]">IP</th>
                  <th className="th">상세</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-background-200 last:border-0">
                    <td className="td whitespace-nowrap text-[11.5px] tabular-nums text-foreground-600">{log.at.replace("T", " ")}</td>
                    <td className="td text-[12px] text-foreground-900">{log.userName}</td>
                    <td className="td">
                      <span className={`inline-flex rounded border px-1.5 py-[1px] text-[10.5px] font-medium ${TYPE_CLASS[log.type]}`}>
                        {TYPE_LABEL[log.type]}
                      </span>
                    </td>
                    <td className="td font-mono text-[11px] text-foreground-600">{log.ip}</td>
                    <td className="td text-[11.5px] text-foreground-700">{log.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t border-background-200 bg-background-100 px-4 py-2.5 text-[10.5px] leading-4 text-foreground-500">
          본 화면은 가상 로그입니다. 실제 운영 로그로 오인되지 않도록 표시하며, 수정·삭제 버튼을 제공하지 않습니다.
        </div>
      </section>
    </div>
  );
}