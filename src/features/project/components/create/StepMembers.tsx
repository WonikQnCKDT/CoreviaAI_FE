import { useMemo, useState } from "react";
import Avatar from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { ROLE_LABEL } from "@/utils/ui";
import type { RoleKey, User } from "@/types";
import { BUTTON_TEXT } from "@/shared/i18n/catalog/button";

interface StepMembersProps {
  users: User[];
  pmId: string;
  members: { userId: string; role: RoleKey }[];
  actors: RoleKey[];
  onToggle: (userId: string) => void;
  onChangeRole: (userId: string, role: RoleKey) => void;
}

export default function StepMembers({ users, pmId, members, actors, onToggle, onChangeRole }: StepMembersProps) {
  const [query, setQuery] = useState("");

  const roleOptions = useMemo(() => {
    const list = actors.filter((actor) => actor !== "pm");
    return list.length > 0 ? list : (["biz", "dev", "qa"] as RoleKey[]);
  }, [actors]);

  const selectedUsers = useMemo(
    () =>
      members
        .map((member) => ({ ...member, user: users.find((u) => u.id === member.userId) }))
        .filter((member): member is { userId: string; role: RoleKey; user: User } => Boolean(member.user)),
    [members, users],
  );

  const candidates = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return users
      .filter((user) => user.active && user.id !== pmId)
      .filter((user) => {
        if (!keyword) return true;
        return [user.name, user.dept, user.job, user.email].join(" ").toLowerCase().includes(keyword);
      });
  }, [users, pmId, query]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[12px] text-foreground-600">
          <i className="ri-group-line text-primary-500" aria-hidden="true" />
          초대한 멤버 <span className="font-semibold text-foreground-900 tabular-nums">{selectedUsers.length}</span>명
        </p>
        <Badge className="border-background-300 bg-background-100 text-foreground-500">선택 사항</Badge>
      </div>

      {selectedUsers.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedUsers.map((member) => (
            <span
              key={member.userId}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-primary-200 bg-primary-50 py-0.5 pl-1 pr-1.5 text-[11px] font-medium text-primary-800"
            >
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-background-50 text-[9px] font-semibold text-primary-700">
                {member.user.name.slice(0, 1)}
              </span>
              <span className="truncate">{member.user.name}</span>
              <span className="shrink-0 text-[10px] text-primary-600/80">{ROLE_LABEL[member.role]}</span>
              <button
                type="button"
                onClick={() => onToggle(member.userId)}
                aria-label={`${member.user.name} 초대 해제`}
                className="flex h-3.5 w-3.5 shrink-0 cursor-pointer items-center justify-center rounded-full text-primary-600 hover:bg-primary-200/70 hover:text-primary-900"
              >
                <i className="ri-close-line text-[11px]" aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center text-foreground-400">
          <i className="ri-search-line text-[14px]" aria-hidden="true" />
        </span>
        <input
          className="field pl-9 text-[12px]"
          value={query}
          placeholder="이름·부서·직무로 검색"
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <div className="max-h-[280px] overflow-y-auto rounded-xl border border-background-200">
        {candidates.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-[12px] text-foreground-500">검색 결과가 없습니다.</p>
          </div>
        ) : (
          <ul className="divide-y divide-background-200">
            {candidates.map((user) => {
              const selected = members.find((m) => m.userId === user.id);
              return (
                <li key={user.id} className={`flex flex-wrap items-center gap-2.5 px-3 py-2.5 ${selected ? "bg-primary-50/40" : ""}`}>
                  <button
                    type="button"
                    onClick={() => onToggle(user.id)}
                    aria-label={`${user.name} ${selected ? BUTTON_TEXT.cancelInvite : BUTTON_TEXT.invite}`}
                    aria-pressed={Boolean(selected)}
                    className={`flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded border ${
                      selected ? "border-primary-500 bg-primary-500 text-background-50" : "border-background-400"
                    }`}
                  >
                    {selected && <i className="ri-check-line text-[11px]" aria-hidden="true" />}
                  </button>
                  <Avatar name={user.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium text-foreground-900">{user.name}</p>
                    <p className="truncate text-[10.5px] text-foreground-500">
                      {user.dept} · {user.job}
                    </p>
                  </div>
                  <select
                    className="field w-auto min-w-[112px] max-w-[140px] shrink-0 text-[11.5px]"
                    value={selected?.role || roleOptions[0]}
                    disabled={!selected}
                    aria-label={`${user.name} 역할`}
                    onChange={(event) => onChangeRole(user.id, event.target.value as RoleKey)}
                  >
                    {roleOptions.map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABEL[role]}
                      </option>
                    ))}
                  </select>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="flex items-start gap-1.5 text-[10.5px] leading-4 text-foreground-500">
        <i className="ri-information-line mt-[1px] text-[12px]" aria-hidden="true" />
        초대한 멤버는 생성 후 프로젝트 멤버로 등록됩니다. 지금 초대하지 않아도 생성 후 멤버·설정에서 추가할 수 있습니다.
      </p>
    </div>
  );
}