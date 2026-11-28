import UserSearchPicker from "@/features/project/components/UserSearchPicker";
import type { DirectoryUser } from "@/features/project/api/directoryApi";
import type { ProjectActor } from "@/features/project/api/projectApi";
import { MAX_CREATE_MEMBERS, type CreateMember } from "@/features/project/utils/serverCreate";
import { PROJECT_CREATE_TEXT, USER_SEARCH_TEXT } from "@/features/project/i18n/ko";
import { ROLE_LABEL } from "@/shared/i18n/catalog/status";
import { formatLabel } from "@/shared/i18n/store";

interface ServerMemberInviteProps {
  members: readonly CreateMember[];
  /** 멤버 역할 선택지: 지정한 액터 중 PM 제외 */
  roleOptions: readonly ProjectActor[];
  onAdd: (user: DirectoryUser) => void;
  onRemove: (userId: number) => void;
  onChangeRole: (userId: number, actor: ProjectActor) => void;
  disabled?: boolean;
}

const actorLabel = (actor: ProjectActor) => (actor in ROLE_LABEL ? ROLE_LABEL[actor as keyof typeof ROLE_LABEL] : actor);

/**
 * 생성 화면 ⑤ 멤버 초대. 이름으로 찾아 추가하고(UserSearchPicker), 역할은 지정한 액터 중 PM을 뺀 것에서 고른다.
 * 역할로 고를 액터가 없으면 검색을 막고 이유를 보여 준다. 생성자 본인은 서버 검색 결과에서 빠진다(PM 자동 등록).
 */
const ServerMemberInvite = function ({ members, roleOptions, onAdd, onRemove, onChangeRole, disabled = false }: ServerMemberInviteProps) {
  const noRole = roleOptions.length === 0;
  const atLimit = members.length >= MAX_CREATE_MEMBERS;
  const pickerReason = noRole ? PROJECT_CREATE_TEXT.membersNeedActor : atLimit ? PROJECT_CREATE_TEXT.membersLimit : undefined;

  return (
    <div className="space-y-2">
      <UserSearchPicker
        id="server-create-member-search"
        label={PROJECT_CREATE_TEXT.membersSearch}
        onSelect={onAdd}
        excludeUserIds={members.map(({ userId }) => userId)}
        disabled={disabled || noRole || atLimit}
        disabledReason={pickerReason}
      />
      {members.length === 0 ? (
        <p className="text-[11.5px] text-foreground-500">{PROJECT_CREATE_TEXT.membersEmpty}</p>
      ) : (
        <ul className="divide-y divide-background-200 rounded-lg border border-background-300" aria-label={PROJECT_CREATE_TEXT.membersSection}>
          {members.map(({ userId, name, departmentName, jobTitle, actor }) => (
            <li key={userId} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-medium text-foreground-900">{name}</span>
                <span className="block truncate text-[10.5px] text-foreground-500">
                  {[departmentName ?? USER_SEARCH_TEXT.noDepartment, jobTitle].filter(Boolean).join(" · ")}
                </span>
              </span>
              <select
                className="field w-auto text-[12px]"
                aria-label={formatLabel(PROJECT_CREATE_TEXT.memberRole, { name })}
                value={actor}
                disabled={disabled}
                onChange={(event) => onChangeRole(userId, event.target.value as ProjectActor)}
              >
                {/* 지정한 액터에서 빠진 역할(예: 템플릿을 바꾼 직후)은 다시 고르도록 그대로 보여 준다 */}
                {!roleOptions.includes(actor) && <option value={actor}>{actorLabel(actor)}</option>}
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {actorLabel(role)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-foreground-500 hover:bg-background-200 hover:text-foreground-900"
                aria-label={formatLabel(PROJECT_CREATE_TEXT.removeMember, { name })}
                disabled={disabled}
                onClick={() => onRemove(userId)}
              >
                <i className="ri-close-line text-[15px]" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ServerMemberInvite;
