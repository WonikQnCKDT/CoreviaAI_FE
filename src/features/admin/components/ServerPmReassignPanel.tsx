import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { fetchAdminUsers, type AdminUser } from "@/features/admin/api/adminApi";
import { ADMIN_PROJECT_CODE_PATTERN, normalizeProjectCode, reassignProjectPm } from "@/features/admin/api/adminProjectApi";
import ConfirmDialog, { type ConfirmPhase } from "@/features/admin/components/ConfirmDialog";
import { ADMIN_PM_TEXT } from "@/features/admin/i18n/pmReassign";
import { ADMIN_TEXT } from "@/features/admin/i18n/ko";
import { adminErrorMessage } from "@/features/admin/utils/adminFormat";
import { interpretReassignPmFailure } from "@/features/admin/utils/pmReassignFailure";
import { formatLabel } from "@/shared/i18n/store";

const SEARCH_DELAY_MS = 300;
/** 한 번에 보여 줄 후보 수. 더 찾으려면 검색어를 좁힌다 */
const CANDIDATE_SIZE = 20;

type SearchState = { phase: "loading" } | { phase: "error"; message: string } | { phase: "ready"; users: AdminUser[] };

/**
 * api 모드 시스템 관리 › PM 재지정 (PUT /api/admin/projects/pm).
 * 시스템 관리자만 이 화면에 들어온다(관리 페이지가 막고, 서버도 /api/admin/** 로 막는다).
 * 새 PM 후보는 관리자 사용자 목록 API에서 활성 일반 사용자만 고른다(서버도 같은 기준으로 다시 검사한다).
 */
const ServerPmReassignPanel = function () {
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [search, setSearch] = useState<SearchState>({ phase: "loading" });
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [userError, setUserError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmPhase>({ phase: "idle" });
  const [notice, setNotice] = useState("");
  const submitRef = useRef<AbortController | null>(null);
  const codeId = useId();
  const codeErrorId = useId();
  const searchId = useId();
  const userErrorId = useId();
  const titleId = useId();

  // 입력이 멈춘 뒤에만 검색 요청을 보낸다.
  useEffect(() => {
    const timer = window.setTimeout(() => setKeyword(keywordInput.trim()), SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [keywordInput]);

  useEffect(() => {
    const controller = new AbortController();
    fetchAdminUsers({ keyword, status: "active", systemRole: "user", size: CANDIDATE_SIZE, signal: controller.signal }).then((result) => {
      if (controller.signal.aborted) return;
      if (result.ok === false) {
        setSearch({ phase: "error", message: adminErrorMessage(result.failure) });
        return;
      }
      setSearch({ phase: "ready", users: result.data.items });
    });
    return () => controller.abort();
  }, [keyword]);

  useEffect(() => () => submitRef.current?.abort(), []);

  const validate = function () {
    const normalized = normalizeProjectCode(code);
    const nextCodeError = !normalized
      ? ADMIN_PM_TEXT.codeRequired
      : ADMIN_PROJECT_CODE_PATTERN.test(normalized)
        ? ""
        : ADMIN_PM_TEXT.codeFormat;
    const nextUserError = selected ? "" : ADMIN_PM_TEXT.userRequired;
    setCodeError(nextCodeError);
    setUserError(nextUserError);
    return !nextCodeError && !nextUserError;
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setNotice("");
    if (!validate()) return;
    setConfirmState({ phase: "idle" });
    setConfirmOpen(true);
  };

  const confirm = async () => {
    if (!selected || confirmState.phase === "submitting") return;
    submitRef.current?.abort();
    const controller = new AbortController();
    submitRef.current = controller;
    setConfirmState({ phase: "submitting" });
    const result = await reassignProjectPm({ projectCode: code, newPmUserId: selected.id, signal: controller.signal });
    if (controller.signal.aborted) return;
    if (result.ok === false) {
      setConfirmState({ phase: "failed", message: interpretReassignPmFailure(result.failure) });
      return;
    }
    const { projectCode, pms } = result.data;
    setConfirmOpen(false);
    setConfirmState({ phase: "idle" });
    setNotice(formatLabel(ADMIN_PM_TEXT.done, { code: projectCode, names: pms.map(({ name }) => name).join(", ") || "-" }));
    setCode("");
    setSelected(null);
  };

  return (
    <section className="card space-y-4 px-4 py-4" aria-labelledby={titleId}>
      <div>
        <h3 id={titleId} className="text-[14px] font-semibold text-foreground-950">
          {ADMIN_PM_TEXT.title}
        </h3>
        <p className="mt-1 text-[12px] leading-5 text-foreground-600">{ADMIN_PM_TEXT.description}</p>
        <p className="mt-1 text-[11px] leading-5 text-foreground-500">{ADMIN_PM_TEXT.privacyNote}</p>
      </div>

      {notice && (
        <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-800">
          {notice}
        </p>
      )}

      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <div className="max-w-sm">
          <label htmlFor={codeId} className="block text-[12px] font-medium text-foreground-800">
            {ADMIN_PM_TEXT.code}
          </label>
          <input
            id={codeId}
            className="field mt-1"
            value={code}
            maxLength={20}
            placeholder={ADMIN_PM_TEXT.codePlaceholder}
            aria-invalid={codeError ? true : undefined}
            aria-describedby={codeError ? codeErrorId : undefined}
            onChange={(event) => {
              setCode(event.target.value);
              setCodeError("");
            }}
          />
          {codeError && (
            <p id={codeErrorId} className="mt-1 text-[11px] text-rose-700">
              {codeError}
            </p>
          )}
        </div>

        <fieldset className="space-y-2" aria-describedby={userError ? userErrorId : undefined}>
          <legend className="text-[12px] font-medium text-foreground-800">{ADMIN_PM_TEXT.user}</legend>
          <div className="max-w-sm">
            <label htmlFor={searchId} className="sr-only">
              {ADMIN_PM_TEXT.userSearch}
            </label>
            <input
              id={searchId}
              type="search"
              className="field"
              value={keywordInput}
              maxLength={50}
              placeholder={ADMIN_PM_TEXT.userSearch}
              onChange={(event) => setKeywordInput(event.target.value)}
            />
            <p className="mt-1 text-[10.5px] text-foreground-500">{ADMIN_PM_TEXT.userSearchHint}</p>
          </div>

          {search.phase === "loading" && (
            <p role="status" className="text-[11.5px] text-foreground-500">
              {ADMIN_PM_TEXT.userLoading}
            </p>
          )}
          {search.phase === "error" && (
            <p role="alert" className="text-[11.5px] text-rose-700">
              {ADMIN_PM_TEXT.userFailed} {search.message}
            </p>
          )}
          {search.phase === "ready" && search.users.length === 0 && <p className="text-[11.5px] text-foreground-500">{ADMIN_PM_TEXT.userEmpty}</p>}
          {search.phase === "ready" && search.users.length > 0 && (
            <ul className="max-h-64 max-w-xl divide-y divide-background-200 overflow-y-auto rounded-lg border border-background-200">
              {search.users.map((user) => (
                <li key={user.id}>
                  <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-[12px] hover:bg-background-100">
                    <input
                      type="radio"
                      name="new-pm"
                      value={user.id}
                      checked={selected?.id === user.id}
                      onChange={() => {
                        setSelected(user);
                        setUserError("");
                      }}
                    />
                    <span className="font-medium text-foreground-900">{user.name}</span>
                    <span className="text-foreground-500">
                      {user.loginId} · {user.departmentName || ADMIN_TEXT.none} · {user.jobTitle || ADMIN_TEXT.none}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}

          {selected && (
            <p className="flex items-center gap-2 text-[11.5px] text-foreground-700">
              {formatLabel(ADMIN_PM_TEXT.selected, { name: `${selected.name} (${selected.loginId})` })}
              <button type="button" className="underline underline-offset-2" onClick={() => setSelected(null)}>
                {ADMIN_PM_TEXT.clearSelection}
              </button>
            </p>
          )}
          {userError && (
            <p id={userErrorId} className="text-[11px] text-rose-700">
              {userError}
            </p>
          )}
        </fieldset>

        <button type="submit" className="btn-primary whitespace-nowrap">
          <i className="ri-user-star-line" aria-hidden="true" /> {ADMIN_PM_TEXT.submit}
        </button>
      </form>

      <ConfirmDialog
        open={confirmOpen}
        title={ADMIN_PM_TEXT.confirmTitle}
        confirmLabel={ADMIN_PM_TEXT.submit}
        state={confirmState}
        onConfirm={confirm}
        onClose={() => {
          if (confirmState.phase !== "submitting") setConfirmOpen(false);
        }}
      >
        <p>{formatLabel(ADMIN_PM_TEXT.confirmBody, { code: normalizeProjectCode(code), name: selected ? `${selected.name} (${selected.loginId})` : "-" })}</p>
        <p className="text-[12px] text-foreground-600">{ADMIN_PM_TEXT.confirmNote}</p>
      </ConfirmDialog>
    </section>
  );
};

export default ServerPmReassignPanel;
