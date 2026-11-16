import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Avatar from "@/components/ui/Avatar";
import EmptyState from "@/components/ui/EmptyState";
import { useAuth } from "@/features/auth/authContext";
import {
  changeAdminUserRole,
  changeAdminUserStatus,
  changeProjectCreation,
  fetchAdminUser,
  fetchAdminUsers,
  type AdminUser,
  type RecordStatus,
} from "@/features/admin/api/adminApi";
import { useCursorList } from "@/features/admin/hooks/useCursorList";
import { useDepartments } from "@/features/admin/hooks/useDepartments";
import ConfirmDialog, { type ConfirmPhase } from "@/features/admin/components/ConfirmDialog";
import UserFormDialog, { type UserFormMode } from "@/features/admin/components/UserFormDialog";
import UserHistoryDialog from "@/features/admin/components/UserHistoryDialog";
import PasswordResetDialog from "@/features/admin/components/PasswordResetDialog";
import { ADMIN_TEXT, STATUS_TEXT, SYSTEM_ROLE_TEXT } from "@/features/admin/i18n/ko";
import { adminErrorMessage, failureCode, formatDateTime } from "@/features/admin/utils/adminFormat";
import type { SystemRole } from "@/types";

const ROLES: SystemRole[] = ["user", "exec", "admin"];
const SEARCH_DELAY_MS = 300;

type PendingChange =
  | { kind: "role"; user: AdminUser; systemRole: SystemRole }
  | { kind: "status"; user: AdminUser; status: RecordStatus };

type Notice = { tone: "info" | "error"; text: string } | null;

interface ResetTarget {
  name: string;
  serverUserId: number;
}

/** api 모드 사용자 관리. 데이터는 모두 서버(GET /api/admin/users)에서 온다. */
const ServerUsersPanel = function () {
  const { account } = useAuth();
  const { tree: departments } = useDepartments();
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [systemRole, setSystemRole] = useState<"" | SystemRole>("");
  const [status, setStatus] = useState<"" | RecordStatus>("");
  const [formMode, setFormMode] = useState<UserFormMode | null>(null);
  const [historyUser, setHistoryUser] = useState<AdminUser | null>(null);
  const [resetTarget, setResetTarget] = useState<ResetTarget | null>(null);
  const [resetDescription, setResetDescription] = useState<string | undefined>(undefined);
  const [pending, setPending] = useState<PendingChange | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmPhase>({ phase: "idle" });
  const [busyUserId, setBusyUserId] = useState<number | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const controllerRef = useRef<AbortController | null>(null);

  // 입력이 멈춘 뒤에만 검색 요청을 보낸다.
  useEffect(() => {
    const timer = window.setTimeout(() => setKeyword(keywordInput.trim()), SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [keywordInput]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const query = useMemo(
    () => ({
      keyword,
      departmentId: departmentId ? Number(departmentId) : null,
      systemRole: systemRole || null,
      status: status || null,
    }),
    [keyword, departmentId, systemRole, status],
  );
  const fetchPage = useCallback(
    ({ cursor, signal }: { cursor: string | null; signal: AbortSignal }) => fetchAdminUsers({ ...query, cursor, signal }),
    [query],
  );
  const { state, reload, loadMore, replaceItem, prependItem } = useCursorList({
    queryKey: JSON.stringify(query),
    fetchPage,
  });

  const filtered = Boolean(keyword || departmentId || systemRole || status);
  const resetFilters = () => {
    setKeywordInput("");
    setKeyword("");
    setDepartmentId("");
    setSystemRole("");
    setStatus("");
  };

  /** 409·404처럼 화면 값이 낡았을 때 그 사용자만 다시 받아 바꾼다. */
  const refreshUser = useCallback(
    async (userId: number) => {
      const result = await fetchAdminUser({ userId });
      if (result.ok === true) replaceItem((item) => item.id === userId, result.data);
    },
    [replaceItem],
  );

  const sameUser = (userId: number) => (item: AdminUser) => item.id === userId;

  /* ===== 역할·상태 변경 (확인 후 실행, 503이면 같은 요청을 다시 보낼 수 있다) ===== */

  const openChange = (change: PendingChange) => {
    setPending(change);
    setConfirmState({ phase: "idle" });
  };

  const confirmChange = async () => {
    if (!pending || confirmState.phase === "submitting") return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setConfirmState({ phase: "submitting" });
    const { user } = pending;
    const result =
      pending.kind === "role"
        ? await changeAdminUserRole({ userId: user.id, systemRole: pending.systemRole, signal: controller.signal })
        : await changeAdminUserStatus({ userId: user.id, status: pending.status, signal: controller.signal });
    if (controller.signal.aborted) return;

    if (result.ok === true) {
      replaceItem(sameUser(user.id), result.data);
      setPending(null);
      setConfirmState({ phase: "idle" });
      setNotice({
        tone: "info",
        text:
          pending.kind === "role"
            ? `${user.name} 사용자의 역할을 ${SYSTEM_ROLE_TEXT[result.data.systemRole]}(으)로 바꿨습니다. 대상 사용자는 다시 로그인해야 합니다.`
            : `${user.name} 계정을 ${STATUS_TEXT[result.data.status]} 상태로 바꿨습니다.`,
      });
      return;
    }
    const code = failureCode(result.failure);
    if (code === "CONCURRENT_MODIFICATION" || code === "USER_NOT_FOUND") refreshUser(user.id);
    setConfirmState({ phase: "failed", message: adminErrorMessage(result.failure) });
  };

  /* ===== 프로젝트 생성 권한 (바로 실행) ===== */

  const toggleProjectCreation = async (user: AdminUser) => {
    if (busyUserId !== null) return;
    setBusyUserId(user.id);
    setNotice(null);
    const result = await changeProjectCreation({ userId: user.id, enabled: !user.canCreateProject });
    setBusyUserId(null);
    if (result.ok === true) {
      replaceItem(sameUser(user.id), result.data);
      return;
    }
    const code = failureCode(result.failure);
    if (code === "USER_NOT_FOUND" || code === "PROJECT_CREATION_NOT_ALLOWED") refreshUser(user.id);
    setNotice({ tone: "error", text: `${user.name}: ${adminErrorMessage(result.failure)}` });
  };

  const handleSaved = ({ user, created }: { user: AdminUser; created: boolean }) => {
    setFormMode(null);
    if (created) {
      prependItem(user);
      // 사용자 추가 흐름: 계정 생성 → 임시 비밀번호 발급 → 사용자가 첫 로그인 후 변경
      setResetDescription(ADMIN_TEXT.createdThenReset);
      setResetTarget({ name: user.name, serverUserId: user.id });
      return;
    }
    replaceItem(sameUser(user.id), user);
    setNotice({ tone: "info", text: `${user.name} 사용자 정보를 저장했습니다.` });
  };

  /* ===== 화면 ===== */

  const renderBody = () => {
    if (state.phase === "loading") {
      return (
        <p role="status" className="px-4 py-12 text-center text-sm text-foreground-500">
          {ADMIN_TEXT.loading}
        </p>
      );
    }
    if (state.phase === "error") {
      return (
        <div role="alert" className="px-4 py-12 text-center">
          <p className="text-sm font-medium text-foreground-900">{ADMIN_TEXT.loadUsersFailed}</p>
          <p className="mt-1 text-xs text-foreground-600">{state.message}</p>
          <button type="button" className="btn-outline mt-3" onClick={reload}>
            {ADMIN_TEXT.retry}
          </button>
        </div>
      );
    }
    const { items, hasNext, more } = state;
    if (items.length === 0) {
      return (
        <EmptyState
          icon="ri-user-search-line"
          title={ADMIN_TEXT.emptyUsers}
          description={filtered ? ADMIN_TEXT.emptyUsersHint : undefined}
          action={
            filtered ? (
              <button type="button" className="btn-outline" onClick={resetFilters}>
                {ADMIN_TEXT.resetFilters}
              </button>
            ) : (
              <button type="button" className="btn-primary" onClick={() => setFormMode({ kind: "create" })}>
                {ADMIN_TEXT.addUser}
              </button>
            )
          }
        />
      );
    }
    return (
      <>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] border-collapse">
            <thead>
              <tr>
                <th className="th">사용자</th>
                <th className="th w-40">부서</th>
                <th className="th w-32">직무</th>
                <th className="th w-40">시스템 역할</th>
                <th className="th w-28">프로젝트 생성</th>
                <th className="th w-20">상태</th>
                <th className="th w-36">마지막 로그인</th>
                <th className="th w-80">관리</th>
              </tr>
            </thead>
            <tbody>
              {items.map((user) => {
                const { id, loginId, name, systemRole: role, status: userStatus, departmentName, jobTitle, canCreateProject, lastLoginAt } =
                  user;
                const isSelf = account?.userId === id;
                const busy = busyUserId === id;
                const active = userStatus === "active";
                return (
                  <tr key={id} className="border-b border-background-200 last:border-0" aria-busy={busy}>
                    <td className="td">
                      <span className="flex items-center gap-2">
                        <Avatar name={name} size="xs" />
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5">
                            <span className="block truncate text-sm font-medium text-foreground-950">{name}</span>
                            {isSelf && (
                              <span className="rounded border border-background-300 px-1 text-xs text-foreground-600">{ADMIN_TEXT.self}</span>
                            )}
                          </span>
                          <span className="block font-mono text-xs text-foreground-500">{loginId}</span>
                        </span>
                      </span>
                    </td>
                    <td className="td text-xs">{departmentName || <span className="text-foreground-400">{ADMIN_TEXT.none}</span>}</td>
                    <td className="td text-xs text-foreground-600">{jobTitle || <span className="text-foreground-400">{ADMIN_TEXT.none}</span>}</td>
                    <td className="td">
                      <label className="sr-only" htmlFor={`role-${id}`}>
                        {name} 시스템 역할
                      </label>
                      <select
                        id={`role-${id}`}
                        className="field text-xs disabled:cursor-not-allowed disabled:opacity-60"
                        value={role}
                        disabled={isSelf || busy}
                        title={isSelf ? ADMIN_TEXT.ownAccountLocked : undefined}
                        onChange={(event) => openChange({ kind: "role", user, systemRole: event.target.value as SystemRole })}
                      >
                        {ROLES.map((item) => (
                          <option key={item} value={item}>
                            {SYSTEM_ROLE_TEXT[item]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="td">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={canCreateProject}
                        aria-label={`${name} 프로젝트 생성 권한`}
                        disabled={busy || (role !== "user" && !canCreateProject)}
                        title={role !== "user" ? ADMIN_TEXT.projectCreationUserOnly : undefined}
                        onClick={() => toggleProjectCreation(user)}
                        className={`inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-full border px-2.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
                          canCreateProject
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-background-300 bg-background-100 text-foreground-500"
                        }`}
                      >
                        <i className={canCreateProject ? "ri-check-line" : "ri-close-line"} aria-hidden="true" />
                        {busy ? ADMIN_TEXT.saving : canCreateProject ? "허용" : "미허용"}
                      </button>
                    </td>
                    <td className="td">
                      <span className="inline-flex items-center gap-1.5 text-xs text-foreground-700">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-500" : "border border-foreground-400"}`}
                          aria-hidden="true"
                        />
                        {STATUS_TEXT[userStatus]}
                      </span>
                    </td>
                    <td className="td text-xs tabular-nums text-foreground-600">
                      {lastLoginAt ? (
                        <time dateTime={lastLoginAt}>{formatDateTime({ iso: lastLoginAt })}</time>
                      ) : (
                        <span className="text-foreground-400">{ADMIN_TEXT.neverLoggedIn}</span>
                      )}
                    </td>
                    <td className="td">
                      <div className="flex flex-wrap items-center gap-1">
                        <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => setFormMode({ kind: "edit", user })}>
                          수정
                        </button>
                        <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => setHistoryUser(user)}>
                          이력
                        </button>
                        <button
                          type="button"
                          className="btn-ghost px-2 py-1 text-xs"
                          onClick={() => {
                            setResetDescription(undefined);
                            setResetTarget({ name, serverUserId: id });
                          }}
                        >
                          비밀번호 초기화
                        </button>
                        <button
                          type="button"
                          disabled={isSelf || busy}
                          title={isSelf ? ADMIN_TEXT.ownAccountLocked : undefined}
                          className="btn-outline px-2 py-1 text-xs"
                          onClick={() => openChange({ kind: "status", user, status: active ? "inactive" : "active" })}
                        >
                          {active ? "비활성화" : "활성화"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {hasNext && (
          <div className="border-t border-background-200 px-4 py-3 text-center">
            <button type="button" className="btn-outline" onClick={loadMore} disabled={more.phase === "loading"}>
              {more.phase === "loading" ? ADMIN_TEXT.loadingMore : more.phase === "error" ? ADMIN_TEXT.retry : ADMIN_TEXT.loadMore}
            </button>
            {more.phase === "error" && (
              <p role="alert" className="mt-1 text-xs text-rose-600">
                {more.message}
              </p>
            )}
          </div>
        )}
      </>
    );
  };

  const pendingIsDanger = pending?.kind === "status" && pending.status === "inactive";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground-950">{ADMIN_TEXT.usersTitle}</h3>
          <p className="mt-0.5 text-xs text-foreground-500">{ADMIN_TEXT.usersDescription}</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setFormMode({ kind: "create" })}>
          <i className="ri-user-add-line" aria-hidden="true" /> {ADMIN_TEXT.addUser}
        </button>
      </div>

      {notice && (
        <div
          role={notice.tone === "error" ? "alert" : "status"}
          className={`flex items-start justify-between gap-2 rounded-lg border px-3.5 py-2.5 text-xs leading-5 ${
            notice.tone === "error" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-background-300 bg-background-50 text-foreground-700"
          }`}
        >
          <span>{notice.text}</span>
          <button type="button" className="shrink-0 underline underline-offset-2" onClick={() => setNotice(null)}>
            {ADMIN_TEXT.close}
          </button>
        </div>
      )}

      <section className="card overflow-hidden" aria-label="사용자 목록">
        <div className="flex flex-wrap items-center gap-2 border-b border-background-200 px-4 py-3">
          <div className="relative min-w-[200px] flex-1">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-sm text-foreground-400" aria-hidden="true" />
            <input
              type="search"
              aria-label={ADMIN_TEXT.searchPlaceholder}
              className="field pl-8 text-sm"
              placeholder={ADMIN_TEXT.searchPlaceholder}
              maxLength={50}
              value={keywordInput}
              onChange={(event) => setKeywordInput(event.target.value)}
            />
          </div>
          <select
            aria-label="부서"
            className="field w-auto min-w-[140px] text-sm"
            value={departmentId}
            onChange={(event) => setDepartmentId(event.target.value)}
          >
            <option value="">{ADMIN_TEXT.allDepartments}</option>
            {departments.map(({ department, path }) => (
              <option key={department.id} value={department.id}>
                {path}
                {department.status === "inactive" ? " (비활성)" : ""}
              </option>
            ))}
          </select>
          <select
            aria-label="시스템 역할"
            className="field w-auto min-w-[130px] text-sm"
            value={systemRole}
            onChange={(event) => setSystemRole(event.target.value as "" | SystemRole)}
          >
            <option value="">{ADMIN_TEXT.allRoles}</option>
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {SYSTEM_ROLE_TEXT[role]}
              </option>
            ))}
          </select>
          <select
            aria-label="상태"
            className="field w-auto min-w-[110px] text-sm"
            value={status}
            onChange={(event) => setStatus(event.target.value as "" | RecordStatus)}
          >
            <option value="">{ADMIN_TEXT.allStatuses}</option>
            <option value="active">{STATUS_TEXT.active}</option>
            <option value="inactive">{STATUS_TEXT.inactive}</option>
          </select>
        </div>
        {renderBody()}
        <div className="border-t border-background-200 bg-background-100 px-4 py-2.5 text-xs leading-5 text-foreground-500">
          {ADMIN_TEXT.serverAppliedNote} 부서 필터는 하위 부서를 포함하지 않습니다.
        </div>
      </section>

      <ConfirmDialog
        open={Boolean(pending)}
        title={
          pending?.kind === "role"
            ? ADMIN_TEXT.roleChangeConfirmTitle
            : pending?.status === "inactive"
              ? ADMIN_TEXT.deactivateConfirmTitle
              : ADMIN_TEXT.activateConfirmTitle
        }
        confirmLabel={pendingIsDanger ? "비활성화" : "변경"}
        tone={pendingIsDanger ? "danger" : "default"}
        state={confirmState}
        onConfirm={confirmChange}
        onClose={() => {
          controllerRef.current?.abort();
          setPending(null);
        }}
      >
        {pending?.kind === "role" && (
          <>
            <p>
              <strong className="font-medium text-foreground-950">{pending.user.name}</strong>님의 시스템 역할을{" "}
              {SYSTEM_ROLE_TEXT[pending.user.systemRole]}에서{" "}
              <strong className="font-medium text-foreground-950">{SYSTEM_ROLE_TEXT[pending.systemRole]}</strong>(으)로 바꿉니다.
            </p>
            <p>{ADMIN_TEXT.roleChangeConfirmBody}</p>
            {pending.systemRole !== "user" && pending.user.canCreateProject && <p>{ADMIN_TEXT.roleChangeProjectRevoke}</p>}
          </>
        )}
        {pending?.kind === "status" && (
          <>
            <p>
              <strong className="font-medium text-foreground-950">{pending.user.name}</strong> 계정을{" "}
              {STATUS_TEXT[pending.status]} 상태로 바꿉니다.
            </p>
            <p>{pending.status === "inactive" ? ADMIN_TEXT.deactivateConfirmBody : ADMIN_TEXT.activateConfirmBody}</p>
          </>
        )}
      </ConfirmDialog>

      <UserFormDialog
        mode={formMode}
        departments={departments}
        onClose={() => setFormMode(null)}
        onSaved={handleSaved}
        onStale={refreshUser}
      />
      <UserHistoryDialog user={historyUser} departments={departments} onClose={() => setHistoryUser(null)} />
      <PasswordResetDialog
        target={resetTarget}
        description={resetDescription}
        onClose={() => {
          setResetTarget(null);
          setResetDescription(undefined);
        }}
      />
    </div>
  );
};

export default ServerUsersPanel;
