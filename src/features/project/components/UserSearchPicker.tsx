import { useEffect, useId, useState, type KeyboardEvent } from "react";
import {
  normalizeUserSearchKeyword,
  searchUsers,
  USER_SEARCH_MAX_SIZE,
  type DirectoryUser,
} from "@/features/project/api/directoryApi";
import { lookupFailureMessage } from "@/features/project/utils/serverCreate";
import { USER_SEARCH_TEXT } from "@/features/project/i18n/ko";
import { BUTTON_TEXT } from "@/shared/i18n/catalog/button";
import { formatLabel } from "@/shared/i18n/store";

export interface UserSearchPickerProps {
  /** 검색 입력칸 id. 바깥 label의 htmlFor와 맞춘다 */
  id: string;
  /** 입력칸의 접근 가능한 이름(바깥에 보이는 label이 없을 때도 읽힌다) */
  label: string;
  /** 사람을 고르면 부른다. 고른 뒤 입력칸은 비워져 다음 사람을 바로 찾을 수 있다 */
  onSelect: (user: DirectoryUser) => void;
  /** 결과에서 뺄 사용자(이미 고른 멤버 등) */
  excludeUserIds?: readonly number[];
  disabled?: boolean;
  /** disabled일 때 보여 줄 이유 */
  disabledReason?: string;
  /** 입력을 멈춘 뒤 요청까지 기다리는 시간(ms) */
  debounceMs?: number;
}

type SearchState =
  | { phase: "idle" }
  | { phase: "loading"; keyword: string }
  | { phase: "error"; keyword: string; message: string }
  | { phase: "ready"; keyword: string; users: DirectoryUser[] };

const DEFAULT_DEBOUNCE_MS = 300;

/**
 * 초대할 사용자를 이름으로 찾아 한 명씩 고르는 검색 선택 컴포넌트(GET /api/users/search).
 * - 검색어가 2자 미만이면 요청하지 않고, 입력을 멈춘 뒤(debounce) 요청하며, 새 입력이 오면 이전 요청을 취소한다.
 * - 찾는 중·결과 없음·실패(다시 시도)·결과를 구분해 보여 준다. 결과는 최대 20명이다.
 * - 키보드: ↑↓로 이동, Enter로 고르기, Esc로 목록 닫기(combobox + listbox 패턴).
 * 프로젝트 생성 ⑤ 멤버 초대와 멤버·설정 화면의 멤버 초대(SCRUM-106)가 함께 쓴다.
 */
const UserSearchPicker = function ({
  id,
  label,
  onSelect,
  excludeUserIds = [],
  disabled = false,
  disabledReason,
  debounceMs = DEFAULT_DEBOUNCE_MS,
}: UserSearchPickerProps) {
  const listId = useId();
  const statusId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [state, setState] = useState<SearchState>({ phase: "idle" });
  const [retryToken, setRetryToken] = useState(0);

  const keyword = normalizeUserSearchKeyword(query);

  useEffect(() => {
    if (keyword === null || disabled) {
      setState({ phase: "idle" });
      return undefined;
    }
    setState({ phase: "loading", keyword });
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      searchUsers({ keyword, size: USER_SEARCH_MAX_SIZE, signal: controller.signal }).then((result) => {
        if (controller.signal.aborted) return;
        if (result.ok === true) setState({ phase: "ready", keyword, users: result.data });
        else setState({ phase: "error", keyword, message: lookupFailureMessage(result.failure) || USER_SEARCH_TEXT.failed });
      });
    }, debounceMs);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [keyword, disabled, debounceMs, retryToken]);

  const users = state.phase === "ready" ? state.users.filter((user) => !excludeUserIds.includes(user.id)) : [];
  const listOpen = open && !disabled && query.trim().length > 0;
  const active = activeIndex >= 0 && activeIndex < users.length ? users[activeIndex] : null;

  const choose = (user: DirectoryUser) => {
    onSelect(user);
    setQuery("");
    setActiveIndex(-1);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      if (users.length === 0) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((prev) => (prev < 0 && step < 0 ? users.length - 1 : (prev + step + users.length) % users.length));
      return;
    }
    if (event.key === "Enter") {
      // 바깥 form 제출을 막는다. 목록에서 고른 사람이 있을 때만 선택한다.
      event.preventDefault();
      if (listOpen && active) choose(active);
      return;
    }
    if (event.key === "Escape" && listOpen) {
      // 목록만 닫고 바깥 대화 상자 닫기(Esc)로 번지지 않게 한다.
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      setActiveIndex(-1);
    }
  };

  const statusText = (() => {
    if (disabled) return disabledReason ?? "";
    if (query.trim().length === 0) return "";
    if (keyword === null) return USER_SEARCH_TEXT.tooShort;
    if (state.phase === "loading") return USER_SEARCH_TEXT.loading;
    if (state.phase === "ready" && users.length === 0) return formatLabel(USER_SEARCH_TEXT.empty, { keyword: state.keyword });
    if (state.phase === "ready") {
      const count = formatLabel(USER_SEARCH_TEXT.resultCount, { count: String(users.length) });
      return state.users.length >= USER_SEARCH_MAX_SIZE ? `${count} ${USER_SEARCH_TEXT.limitNote}` : count;
    }
    return "";
  })();

  return (
    <div className="relative">
      <div className="relative">
        <i className="ri-search-line pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] text-foreground-400" aria-hidden="true" />
        <input
          id={id}
          type="text"
          role="combobox"
          aria-label={label}
          aria-autocomplete="list"
          aria-expanded={listOpen}
          aria-controls={listId}
          aria-activedescendant={listOpen && active ? `${listId}-${active.id}` : undefined}
          aria-describedby={statusId}
          autoComplete="off"
          spellCheck={false}
          className="field pl-8 text-[12.5px]"
          placeholder={USER_SEARCH_TEXT.placeholder}
          value={query}
          maxLength={100}
          disabled={disabled}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
        />
      </div>

      <p id={statusId} role="status" aria-live="polite" className="mt-1 min-h-[16px] text-[11px] text-foreground-500">
        {statusText}
      </p>

      {listOpen && state.phase === "error" && (
        <div role="alert" className="mt-1 flex items-center justify-between gap-2 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11.5px] text-rose-700">
          <span>
            {USER_SEARCH_TEXT.failed} {state.message}
          </span>
          <button
            type="button"
            className="btn-outline shrink-0"
            // 입력칸 blur로 목록이 닫히기 전에 처리한다
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setRetryToken((prev) => prev + 1)}
          >
            {BUTTON_TEXT.retry}
          </button>
        </div>
      )}

      {listOpen && users.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          className="absolute left-0 right-0 z-40 mt-1 max-h-[240px] overflow-y-auto rounded-lg border border-background-300 bg-background-50 py-1 shadow-panel"
        >
          {users.map((user, index) => {
            const isActive = index === activeIndex;
            const detail = [user.departmentName ?? USER_SEARCH_TEXT.noDepartment, user.jobTitle].filter(Boolean).join(" · ");
            return (
              <li
                key={user.id}
                id={`${listId}-${user.id}`}
                role="option"
                aria-selected={isActive}
                className={`flex cursor-pointer flex-col px-2.5 py-1.5 ${isActive ? "bg-primary-50" : "hover:bg-background-100"}`}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(user)}
              >
                <span className="truncate text-[12px] font-medium text-foreground-900">{user.name}</span>
                <span className="truncate text-[10.5px] text-foreground-500">{detail}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default UserSearchPicker;
