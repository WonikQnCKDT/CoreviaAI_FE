import { useMemo, useState } from "react";
import { useDemoStore, type NewUserInput } from "@/stores/DemoStore";
import Avatar from "@/components/ui/Avatar";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";
import PasswordResetDialog from "@/features/admin/components/PasswordResetDialog";
import { SYSTEM_ROLE_LABEL } from "@/utils/permission";
import type { SystemRole, User } from "@/types";

const SYSTEM_ROLES: SystemRole[] = ["user", "exec", "admin"];

interface FormState {
  name: string;
  dept: string;
  job: string;
  email: string;
  systemRole: SystemRole;
}

const EMPTY_FORM: FormState = {
  name: "",
  dept: "",
  job: "",
  email: "",
  systemRole: "user",
};

export default function AdminUsers() {
  const { users, updateUser, addUser, resetUserPassword, currentUser } = useDemoStore();
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState<"all" | SystemRole>("all");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [message, setMessage] = useState("");

  const depts = Array.from(new Set(users.map((u) => u.dept)));

  const rows = useMemo(
    () =>
      users.filter((user) => {
        const keyword = search.trim().toLowerCase();
        const matchesKeyword =
          !keyword || user.name.toLowerCase().includes(keyword) || user.email.toLowerCase().includes(keyword);
        const matchesDept = deptFilter === "all" || user.dept === deptFilter;
        const matchesRole = roleFilter === "all" || user.systemRole === roleFilter;
        const matchesActive = activeFilter === "all" || (activeFilter === "active" ? user.active : !user.active);
        return matchesKeyword && matchesDept && matchesRole && matchesActive;
      }),
    [users, search, deptFilter, roleFilter, activeFilter],
  );

  const submitNewUser = () => {
    setFormError("");
    if (!form.name.trim()) return setFormError("이름을 입력해 주세요.");
    if (!form.dept.trim()) return setFormError("부서를 입력해 주세요.");
    if (!form.job.trim()) return setFormError("직무를 입력해 주세요.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return setFormError("올바른 이메일 형식을 입력해 주세요.");
    if (users.some((u) => u.email.toLowerCase() === form.email.trim().toLowerCase())) {
      return setFormError("이미 등록된 이메일입니다. 중복 계정은 만들 수 없습니다.");
    }
    const input: NewUserInput = { ...form, email: form.email.trim() };
    addUser(input);
    setAddOpen(false);
    setForm(EMPTY_FORM);
    setMessage(`${input.name} 사용자를 추가했습니다. 초기 비밀번호는 데모 공통 값이며 실제로 저장되지 않습니다.`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-[13.5px] font-semibold text-foreground-950">사용자 · 조직</h3>
          <p className="mt-0.5 text-[11px] text-foreground-500">
            계정·부서·시스템 역할을 관리합니다. 프로젝트는 활성 일반 사용자 누구나 만들 수 있고, 프로젝트 역할은 각 프로젝트의 멤버·설정에서 부여합니다.
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setAddOpen(true)}>
          <i className="ri-user-add-line" /> 사용자 추가
        </button>
      </div>

      {message && (
        <div className="rounded-lg border border-primary-200 bg-primary-50 px-3.5 py-2.5 text-[11.5px] text-primary-800">
          <i className="ri-information-line mr-1" /> {message}
        </div>
      )}

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-background-200 px-4 py-3">
          <div className="relative min-w-[200px] flex-1">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-foreground-400" />
            <input
              className="field pl-8 text-[12.5px]"
              placeholder="이름 또는 이메일 검색"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <select className="field w-auto min-w-[112px] text-[12.5px]" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
            <option value="all">부서 전체</option>
            {depts.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
          <select
            className="field w-auto min-w-[124px] text-[12.5px]"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as "all" | SystemRole)}
          >
            <option value="all">시스템 역할 전체</option>
            {SYSTEM_ROLES.map((role) => (
              <option key={role} value={role}>
                {SYSTEM_ROLE_LABEL[role]}
              </option>
            ))}
          </select>
          <select
            className="field w-auto min-w-[104px] text-[12.5px]"
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value as "all" | "active" | "inactive")}
          >
            <option value="all">상태 전체</option>
            <option value="active">활성</option>
            <option value="inactive">비활성</option>
          </select>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon="ri-user-search-line"
            title="조건에 맞는 사용자가 없습니다"
            description="검색어나 필터를 변경해 다시 시도해 주세요."
            action={
              <button
                type="button"
                className="btn-outline"
                onClick={() => {
                  setSearch("");
                  setDeptFilter("all");
                  setRoleFilter("all");
                  setActiveFilter("all");
                }}
              >
                필터 초기화
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse">
              <thead>
                <tr>
                  <th className="th">사용자</th>
                  <th className="th w-[130px]">부서</th>
                  <th className="th w-[130px]">직무</th>
                  <th className="th w-[150px]">시스템 역할</th>
                  <th className="th w-[86px]">상태</th>
                  <th className="th w-[170px]">관리</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((user) => {
                  const isSelf = user.id === currentUser.id;
                  return (
                    <tr key={user.id} className="border-b border-background-200 last:border-0">
                      <td className="td">
                        <span className="flex items-center gap-2">
                          <Avatar name={user.name} size="xs" />
                          <span className="min-w-0">
                            <span className="flex items-center gap-1.5">
                              <span className="block text-[12.5px] font-medium text-foreground-950">{user.name}</span>
                              {isSelf && (
                                <span className="rounded border border-primary-200 bg-primary-50 px-1 text-[9.5px] text-primary-700">나</span>
                              )}
                            </span>
                            <span className="block text-[10.5px] text-foreground-500">{user.email}</span>
                          </span>
                        </span>
                      </td>
                      <td className="td text-[12px]">{user.dept}</td>
                      <td className="td text-[12px] text-foreground-600">{user.job}</td>
                      <td className="td">
                        <select
                          className="field text-[11.5px]"
                          value={user.systemRole}
                          onChange={(event) => updateUser(user.id, { systemRole: event.target.value as SystemRole })}
                        >
                          {SYSTEM_ROLES.map((role) => (
                            <option key={role} value={role}>
                              {SYSTEM_ROLE_LABEL[role]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="td">
                        <span
                          className={`inline-flex items-center gap-1 rounded border px-1.5 py-[1px] text-[10.5px] ${
                            user.active
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-rose-200 bg-rose-50 text-rose-700"
                          }`}
                        >
                          {user.active ? "활성" : "비활성"}
                        </span>
                      </td>
                      <td className="td">
                        <div className="flex flex-wrap items-center gap-1">
                          <button
                            type="button"
                            className="btn-ghost px-2 py-1 text-[11px]"
                            onClick={() => setResetTarget(user)}
                          >
                            비밀번호 초기화
                          </button>
                          <button
                            type="button"
                            disabled={isSelf}
                            className="btn-outline px-2 py-1 text-[11px]"
                            onClick={() => {
                              updateUser(user.id, { active: !user.active });
                              setMessage(`${user.name} 계정을 ${user.active ? "비활성화" : "활성화"}했습니다.`);
                            }}
                          >
                            {user.active ? "비활성화" : "활성화"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t border-background-200 bg-background-100 px-4 py-2.5 text-[10.5px] leading-4 text-foreground-500">
          비활성화한 계정은 로그인할 수 없습니다. 시스템 관리자 역할만으로는 프로젝트 데이터에 자동 접근할 수 없으며, 해당
          프로젝트의 멤버 역할이 있어야 접근합니다.
        </div>
      </section>

      <Modal
        open={addOpen}
        title="사용자 추가"
        description="데모에서는 계정이 브라우저 저장소에만 추가됩니다."
        onClose={() => {
          setAddOpen(false);
          setFormError("");
        }}
        footer={
          <>
            <button type="button" className="btn-outline" onClick={() => setAddOpen(false)}>
              취소
            </button>
            <button type="button" className="btn-primary" onClick={submitNewUser}>
              추가
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="min-w-0">
            <label className="mb-1 block text-[12px] font-medium text-foreground-800">이름</label>
            <input className="field text-[12.5px]" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-[12px] font-medium text-foreground-800">이메일</label>
            <input className="field text-[12.5px]" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-[12px] font-medium text-foreground-800">부서</label>
            <input className="field text-[12.5px]" value={form.dept} onChange={(e) => setForm({ ...form, dept: e.target.value })} />
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-[12px] font-medium text-foreground-800">직무</label>
            <input className="field text-[12.5px]" value={form.job} onChange={(e) => setForm({ ...form, job: e.target.value })} />
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-[12px] font-medium text-foreground-800">시스템 역할</label>
            <select
              className="field text-[12.5px]"
              value={form.systemRole}
              onChange={(e) => setForm({ ...form, systemRole: e.target.value as SystemRole })}
            >
              {SYSTEM_ROLES.map((role) => (
                <option key={role} value={role}>
                  {SYSTEM_ROLE_LABEL[role]}
                </option>
              ))}
            </select>
          </div>
        </div>
        {formError && (
          <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-2 text-[11.5px] text-rose-700">{formError}</p>
        )}
      </Modal>

      <PasswordResetDialog
        target={resetTarget}
        onClose={() => setResetTarget(null)}
        onDemoReset={(target) => {
          resetUserPassword(target.id);
          setMessage(`${target.name} 사용자의 비밀번호 초기화를 요청했습니다. (데모 · 실제 변경 없음)`);
        }}
      />
    </div>
  );
}