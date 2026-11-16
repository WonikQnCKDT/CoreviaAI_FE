import Avatar from "@/components/ui/Avatar";
import { findAssignees } from "@/utils/assignee";
import type { User } from "@/types";

interface AssigneeStackProps {
  userIds: string[];
  users: User[];
  /** 칩을 몇 명까지 보여 줄지 지정합니다. 나머지는 +N으로 표시합니다. */
  max?: number;
  /** 이름 없이 아바타만 표시합니다. */
  avatarsOnly?: boolean;
  emptyLabel?: string;
  className?: string;
}

/**
 * 업무 목록·카드에서 복수 담당자를 이름 칩으로 보여 줍니다.
 * 미지정 업무는 누락 의심 표시와 같은 톤으로 안내합니다.
 */
export default function AssigneeStack({
  userIds,
  users,
  max = 2,
  avatarsOnly = false,
  emptyLabel = "미지정",
  className = "",
}: AssigneeStackProps) {
  const assignees = findAssignees(userIds, users);

  if (assignees.length === 0) {
    return (
      <span className={`flex items-center gap-1 text-[11px] text-amber-700 ${className}`}>
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-50 text-[10px] text-amber-600">
          <i className="ri-user-unfollow-line" aria-hidden="true" />
        </span>
        <span className="truncate">{emptyLabel}</span>
      </span>
    );
  }

  const visible = assignees.slice(0, max);
  const rest = assignees.length - visible.length;

  if (avatarsOnly) {
    return (
      <span className={`flex items-center gap-1 ${className}`}>
        <span className="flex -space-x-1">
          {visible.map((user) => (
            <Avatar key={user.id} name={user.name} seed={user.id} size="xs" className="ring-2 ring-background-50" />
          ))}
        </span>
        {rest > 0 && (
          <span className="rounded-full border border-background-300 bg-background-100 px-1 text-[10px] font-medium text-foreground-600">
            +{rest}
          </span>
        )}
      </span>
    );
  }

  return (
    <span className={`flex flex-wrap items-center gap-1 ${className}`}>
      {visible.map((user) => (
        <span
          key={user.id}
          title={`${user.name} · ${user.dept}`}
          className="inline-flex max-w-[104px] items-center gap-1 rounded-full border border-background-300 bg-background-50 py-0.5 pl-0.5 pr-1.5"
        >
          <Avatar name={user.name} seed={user.id} size="xs" />
          <span className="truncate text-[10.5px] font-medium text-foreground-700">{user.name}</span>
        </span>
      ))}
      {rest > 0 && (
        <span
          title={assignees.slice(max).map((u) => u.name).join(", ")}
          className="inline-flex items-center rounded-full border border-background-300 bg-background-100 px-1.5 py-0.5 text-[10.5px] font-medium text-foreground-600"
        >
          +{rest}
        </span>
      )}
    </span>
  );
}