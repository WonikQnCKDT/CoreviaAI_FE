import { useState } from "react";
import { useDemoStore } from "@/stores/DemoStore";
import NoAccess from "@/components/ui/NoAccess";
import AdminUsers from "@/features/admin/components/AdminUsers";
import AdminRiskSettings from "@/features/admin/components/AdminRiskSettings";
import AdminAudit from "@/features/admin/components/AdminAudit";
import ServerUsersPanel from "@/features/admin/components/ServerUsersPanel";
import ServerDepartmentsPanel from "@/features/admin/components/ServerDepartmentsPanel";
import { useAuth } from "@/features/auth/authContext";
import { canUseSystemAdmin } from "@/utils/permission";

type TabKey = "users" | "departments" | "risk" | "audit";

interface TabItem {
  key: TabKey;
  label: string;
  icon: string;
  hint: string;
}

const DEMO_TABS: TabItem[] = [
  { key: "users", label: "사용자 · 조직", icon: "ri-team-line", hint: "계정·역할·생성 권한" },
  { key: "risk", label: "AI · 리스크 설정", icon: "ri-equalizer-line", hint: "임계값·가중치·이력" },
  { key: "audit", label: "보안 · 접속 로그", icon: "ri-file-shield-2-line", hint: "읽기 전용 감사 로그" },
];

// api 모드: 사용자·부서는 서버 API, 나머지 탭은 아직 데모 데이터
const API_TABS: TabItem[] = [
  { key: "users", label: "사용자", icon: "ri-team-line", hint: "계정·역할·생성 권한" },
  { key: "departments", label: "부서", icon: "ri-organization-chart", hint: "조직 트리" },
  { key: "risk", label: "AI · 리스크 설정", icon: "ri-equalizer-line", hint: "데모 데이터" },
  { key: "audit", label: "보안 · 접속 로그", icon: "ri-file-shield-2-line", hint: "데모 데이터" },
];

export default function AdminPage() {
  const { currentUser } = useDemoStore();
  const { mode } = useAuth();
  const isApi = mode === "api";
  const tabs = isApi ? API_TABS : DEMO_TABS;
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
          <p className="text-[12px] text-foreground-500">
            {isApi
              ? "시스템 관리자 전용 · 사용자·부서 변경은 서버에 바로 반영되고 감사 로그에 기록됩니다"
              : "시스템 관리자 전용 · 변경 사항은 데모 저장소에만 반영됩니다"}
          </p>
        </div>
        <span className="rounded border border-primary-200 bg-primary-50 px-2.5 py-1 text-[11px] font-medium text-primary-700">
          <i className="ri-shield-check-line mr-1" aria-hidden="true" />
          시스템 관리자
        </span>
      </div>

      <div role="tablist" aria-label="시스템 관리" className="flex flex-wrap items-center gap-1 border-b border-background-300">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            onClick={() => setTab(item.key)}
            className={`relative flex cursor-pointer items-center gap-2 whitespace-nowrap px-3.5 py-2.5 text-[13px] font-medium transition-colors ${
              tab === item.key ? "text-primary-700" : "text-foreground-600 hover:text-foreground-900"
            }`}
          >
            <i className={`${item.icon} text-[15px]`} aria-hidden="true" />
            {item.label}
            <span className="hidden text-[11px] font-normal text-foreground-400 sm:inline">{item.hint}</span>
            {tab === item.key && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary-500" />}
          </button>
        ))}
      </div>

      {tab === "users" && (isApi ? <ServerUsersPanel /> : <AdminUsers />)}
      {tab === "departments" && isApi && <ServerDepartmentsPanel />}
      {tab === "risk" && <AdminRiskSettings />}
      {tab === "audit" && <AdminAudit />}
    </div>
  );
}
