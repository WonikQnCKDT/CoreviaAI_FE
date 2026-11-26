import { useState } from "react";
import { useDemoStore } from "@/stores/DemoStore";
import NoAccess from "@/components/ui/NoAccess";
import AdminUsers from "@/features/admin/components/AdminUsers";
import AdminRiskSettings from "@/features/admin/components/AdminRiskSettings";
import AdminAudit from "@/features/admin/components/AdminAudit";
import ServerUsersPanel from "@/features/admin/components/ServerUsersPanel";
import ServerDepartmentsPanel from "@/features/admin/components/ServerDepartmentsPanel";
import ServerCodesPanel from "@/features/admin/components/ServerCodesPanel";
import ServerLabelsPanel from "@/features/admin/components/ServerLabelsPanel";
import { useAuth } from "@/features/auth/authContext";
import { canUseSystemAdmin } from "@/utils/permission";
import { ADMIN_TAB_TEXT } from "@/shared/i18n/catalog/menu";

type TabKey = "users" | "departments" | "codes" | "labels" | "risk" | "audit";

interface TabItem {
  key: TabKey;
  readonly label: string;
  icon: string;
  readonly hint: string;
}

type AdminTabName = keyof typeof ADMIN_TAB_TEXT;

/** 탭 항목. 문구는 읽을 때마다 현재 언어로 바꾼다(모듈을 불러올 때 고정하지 않는다). */
const tabItem = (key: TabKey, label: AdminTabName, icon: string, hint: AdminTabName): TabItem => ({
  key,
  icon,
  get label() {
    return ADMIN_TAB_TEXT[label];
  },
  get hint() {
    return ADMIN_TAB_TEXT[hint];
  },
});

const DEMO_TABS: TabItem[] = [
  tabItem("users", "usersAndOrg", "ri-team-line", "hintUsers"),
  tabItem("risk", "risk", "ri-equalizer-line", "hintRisk"),
  tabItem("audit", "audit", "ri-file-shield-2-line", "hintAudit"),
];

// api 모드: 사용자·부서·공통 코드·다국어 라벨은 서버 API, 나머지 탭은 아직 데모 데이터
const API_TABS: TabItem[] = [
  tabItem("users", "users", "ri-team-line", "hintUsers"),
  tabItem("departments", "departments", "ri-organization-chart", "hintDepartments"),
  tabItem("codes", "codes", "ri-list-settings-line", "hintCodes"),
  tabItem("labels", "labels", "ri-translate-2", "hintLabels"),
  tabItem("risk", "risk", "ri-equalizer-line", "hintDemoData"),
  tabItem("audit", "audit", "ri-file-shield-2-line", "hintDemoData"),
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
              ? "시스템 관리자 전용 · 사용자·부서·공통 코드·다국어 라벨 변경은 서버에 바로 반영되고 감사 로그에 기록됩니다"
              : "시스템 관리자 전용 · 변경 사항은 데모 저장소에만 반영됩니다"}
          </p>
        </div>
        <span className="rounded border border-primary-200 bg-primary-50 px-2.5 py-1 text-[11px] font-medium text-primary-700">
          <i className="ri-shield-check-line mr-1" aria-hidden="true" />
          {ADMIN_TAB_TEXT.adminOnly}
        </span>
      </div>

      <div role="tablist" aria-label={ADMIN_TAB_TEXT.nav} className="flex flex-wrap items-center gap-1 border-b border-background-300">
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
      {tab === "codes" && isApi && <ServerCodesPanel />}
      {tab === "labels" && isApi && <ServerLabelsPanel />}
      {tab === "risk" && <AdminRiskSettings />}
      {tab === "audit" && <AdminAudit />}
    </div>
  );
}
