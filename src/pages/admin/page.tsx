import { useState } from "react";
import { useDemoStore } from "@/stores/DemoStore";
import NoAccess from "@/components/ui/NoAccess";
import AdminUsers from "@/features/admin/components/AdminUsers";
import AdminRiskSettings from "@/features/admin/components/AdminRiskSettings";
import AdminAudit from "@/features/admin/components/AdminAudit";
import { canUseSystemAdmin } from "@/utils/permission";

type TabKey = "users" | "risk" | "audit";

const TABS: { key: TabKey; label: string; icon: string; hint: string }[] = [
  { key: "users", label: "사용자 · 조직", icon: "ri-team-line", hint: "계정·역할·생성 권한" },
  { key: "risk", label: "AI · 리스크 설정", icon: "ri-equalizer-line", hint: "임계값·가중치·이력" },
  { key: "audit", label: "보안 · 접속 로그", icon: "ri-file-shield-2-line", hint: "읽기 전용 감사 로그" },
];

export default function AdminPage() {
  const { currentUser } = useDemoStore();
  const [tab, setTab] = useState<TabKey>("users");

  if (!canUseSystemAdmin(currentUser)) {
    return (
      <NoAccess
        title="시스템 관리 권한이 없습니다"
        description="시스템 관리는 시스템 관리자 역할에게만 표시되는 메뉴입니다. 권한이 필요하면 관리자에게 요청해 주세요. 시스템 관리자 역할은 프로젝트 데이터 접근 권한을 자동으로 부여하지 않습니다."
        requiredRole="시스템 관리자"
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[12px] text-foreground-500">시스템 관리자 전용 · 변경 사항은 데모 저장소에만 반영됩니다</p>
        </div>
        <span className="rounded border border-primary-200 bg-primary-50 px-2.5 py-1 text-[11px] font-medium text-primary-700">
          <i className="ri-shield-check-line mr-1" />
          시스템 관리자
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1 border-b border-background-300">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`relative flex cursor-pointer items-center gap-2 whitespace-nowrap px-3.5 py-2.5 text-[13px] font-medium transition ${
              tab === item.key ? "text-primary-700" : "text-foreground-600 hover:text-foreground-900"
            }`}
          >
            <i className={`${item.icon} text-[15px]`} />
            {item.label}
            <span className="hidden text-[10.5px] font-normal text-foreground-400 sm:inline">{item.hint}</span>
            {tab === item.key && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary-500" />}
          </button>
        ))}
      </div>

      {tab === "users" && <AdminUsers />}
      {tab === "risk" && <AdminRiskSettings />}
      {tab === "audit" && <AdminAudit />}
    </div>
  );
}