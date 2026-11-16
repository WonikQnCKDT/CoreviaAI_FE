import { useCallback } from "react";
import Modal from "@/components/ui/Modal";
import { fetchUserHistories, type AdminUser, type HistoryChange } from "@/features/admin/api/adminApi";
import { useCursorList } from "@/features/admin/hooks/useCursorList";
import type { DepartmentNode } from "@/features/admin/hooks/useDepartments";
import {
  ADMIN_TEXT,
  HISTORY_ACTION_TEXT,
  HISTORY_FIELD_TEXT,
  STATUS_TEXT,
  SYSTEM_ROLE_TEXT,
} from "@/features/admin/i18n/ko";
import { formatDateTime } from "@/features/admin/utils/adminFormat";

interface UserHistoryDialogProps {
  user: AdminUser | null;
  departments: DepartmentNode[];
  onClose: () => void;
}

const ROLE_VALUE_TEXT: Record<string, string> = {
  SYSTEM_ADMIN: SYSTEM_ROLE_TEXT.admin,
  EXECUTIVE: SYSTEM_ROLE_TEXT.exec,
  USER: SYSTEM_ROLE_TEXT.user,
};
const STATUS_VALUE_TEXT: Record<string, string> = { ACTIVE: STATUS_TEXT.active, INACTIVE: STATUS_TEXT.inactive };

/** 변경 전후 값을 사람이 읽을 수 있는 글자로 바꾼다. */
const describeValue = function ({
  field,
  value,
  departments,
}: {
  field: string;
  value: unknown;
  departments: DepartmentNode[];
}): string {
  if (value === null || value === undefined || value === "") return ADMIN_TEXT.none;
  if (field === "systemRole") return ROLE_VALUE_TEXT[String(value)] ?? String(value);
  if (field === "status") return STATUS_VALUE_TEXT[String(value)] ?? String(value);
  if (field === "departmentId") {
    const found = departments.find(({ department }) => department.id === Number(value));
    return found ? found.path : `#${String(value)}`;
  }
  if (typeof value === "boolean") return value ? "있음" : "없음";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

const HistoryList = function ({ user, departments }: { user: AdminUser; departments: DepartmentNode[] }) {
  const { id: userId } = user;
  const fetchPage = useCallback(
    ({ cursor, signal }: { cursor: string | null; signal: AbortSignal }) => fetchUserHistories({ userId, cursor, signal }),
    [userId],
  );
  const { state, reload, loadMore } = useCursorList({ queryKey: String(userId), fetchPage });

  if (state.phase === "loading") {
    return (
      <p role="status" className="py-8 text-center text-sm text-foreground-500">
        {ADMIN_TEXT.loading}
      </p>
    );
  }
  if (state.phase === "error") {
    return (
      <div role="alert" className="py-8 text-center">
        <p className="text-sm font-medium text-foreground-900">{ADMIN_TEXT.loadHistoryFailed}</p>
        <p className="mt-1 text-xs text-foreground-600">{state.message}</p>
        <button type="button" className="btn-outline mt-3" onClick={reload}>
          {ADMIN_TEXT.retry}
        </button>
      </div>
    );
  }
  const { items, hasNext, more } = state;
  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-foreground-500">{ADMIN_TEXT.emptyHistory}</p>;
  }

  const renderChange = ({ field, before, after }: HistoryChange) => (
    <li key={field} className="text-xs leading-5 text-foreground-700">
      <span className="text-foreground-500">{HISTORY_FIELD_TEXT[field] ?? field}</span>{" "}
      {describeValue({ field, value: before, departments })}
      <span className="mx-1 text-foreground-400" aria-label="에서">
        →
      </span>
      {describeValue({ field, value: after, departments })}
    </li>
  );

  return (
    <div>
      <ol className="divide-y divide-background-200">
        {items.map(({ id, action, actorName, changes, ipAddress, occurredAt }) => (
          <li key={id} className="py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="text-sm font-medium text-foreground-950">{HISTORY_ACTION_TEXT[action] ?? action}</p>
              <time dateTime={occurredAt} className="text-xs tabular-nums text-foreground-500">
                {formatDateTime({ iso: occurredAt })}
              </time>
            </div>
            <p className="mt-0.5 text-xs text-foreground-500">
              {actorName} · <span className="font-mono">{ipAddress}</span>
            </p>
            {changes.length > 0 && <ul className="mt-1.5 space-y-0.5">{changes.map(renderChange)}</ul>}
          </li>
        ))}
      </ol>
      {hasNext && (
        <div className="pt-2 text-center">
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
    </div>
  );
};

const UserHistoryDialog = function ({ user, departments, onClose }: UserHistoryDialogProps) {
  return (
    <Modal
      open={Boolean(user)}
      title={`${ADMIN_TEXT.history}${user ? ` · ${user.name}` : ""}`}
      description="최신 변경이 위에 옵니다. 비밀번호 초기화는 기록만 남고 내용은 저장하지 않습니다."
      onClose={onClose}
      width="max-w-xl"
    >
      {user && <HistoryList user={user} departments={departments} />}
    </Modal>
  );
};

export default UserHistoryDialog;
