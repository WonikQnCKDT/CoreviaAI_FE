import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/authContext";
import { useDemoStore } from "@/stores/DemoStore";
import {
  checkProjectCode,
  createProject,
  fetchCreationOptions,
  type CreationOptions,
  type ProjectActor,
  type ProjectFeature,
  type ProjectTemplate,
} from "@/features/project/api/projectApi";
import { generateProjectCode, issueYear } from "@/features/project/utils/projectCode";
import {
  applyTemplate,
  changeMethodology,
  initialForm,
  interpretCreateFailure,
  lookupFailureMessage,
  requiredBlockers,
  selectableActors,
  selectableFeatures,
  selectableMethodologies,
  SERVER_DIRECTORY,
  toCreateInput,
  validateCreateForm,
  type CreateErrors,
  type ServerCreateForm,
} from "@/features/project/utils/serverCreate";
import { PROJECT_CREATE_TEXT, PROJECT_DIRECTORY_TEXT, PROJECT_FEATURE_LABEL, PROJECT_TEMPLATE_LABEL } from "@/features/project/i18n/ko";
import { METHODOLOGY_LABEL, ROLE_LABEL, VISIBILITY_LABEL } from "@/shared/i18n/catalog/status";
import { BUTTON_TEXT } from "@/shared/i18n/catalog/button";
import { formatLabel } from "@/shared/i18n/store";
import { clearUnsavedGuard, setUnsavedGuard } from "@/utils/navGuard";
import { TODAY } from "@/utils/date";
import type { MethodKey, Visibility } from "@/types";

/** 목록 화면이 생성 성공 안내를 띄우려고 받는 내비게이션 state */
export interface ProjectCreatedState {
  projectCreated: { id: number; name: string };
}

type OptionsState = { phase: "loading" } | { phase: "error"; message: string } | { phase: "ready"; options: CreationOptions };
type CodeCheck = { phase: "idle" } | { phase: "checking" } | { phase: "done"; code: string; available: boolean } | { phase: "error"; message: string };
type SubmitState = { phase: "idle" } | { phase: "submitting" } | { phase: "failed"; message: string };

const VISIBILITIES: Visibility[] = ["company", "department", "members"];
const UNSAVED_MESSAGE = "저장하지 않은 프로젝트 정보가 있습니다.";

const actorLabel = (actor: ProjectActor) => (actor in ROLE_LABEL ? ROLE_LABEL[actor as keyof typeof ROLE_LABEL] : actor);

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="space-y-2">
    <h3 className="text-[12.5px] font-semibold text-foreground-900">{title}</h3>
    {children}
  </section>
);

/** 조회 API가 없어 고를 수 없는 선택 항목 */
const UnavailableItem = ({ title, reason }: { title: string; reason: string }) => (
  <Section title={title}>
    <p className="flex items-start gap-1.5 rounded-lg border border-background-300 bg-background-100 px-3 py-2 text-[11.5px] leading-5 text-foreground-600">
      <i className="ri-information-line mt-0.5 shrink-0" aria-hidden="true" />
      <span>
        {reason} {PROJECT_CREATE_TEXT.omittedNote}
      </span>
    </p>
  </Section>
);

/**
 * api 모드 프로젝트 생성(FR-PRJ-01). 선택값은 서버 생성 선택지(GET /api/projects/creation-options)에서만 고르고,
 * 마지막에 POST /api/projects를 한 번 부른다. 서버가 성공을 돌려준 뒤에만 목록으로 가서 성공 안내를 띄운다.
 * 데모 모드는 기존 단계형 화면(ProjectCreateWizard)을 그대로 쓴다.
 */
const ServerProjectCreateWizard = function () {
  const navigate = useNavigate();
  const { account } = useAuth();
  const { projects, syncServerProjectDetail } = useDemoStore();
  const [optionsState, setOptionsState] = useState<OptionsState>({ phase: "loading" });
  const [form, setForm] = useState<ServerCreateForm | null>(null);
  const [errors, setErrors] = useState<CreateErrors>({});
  const [codeCheck, setCodeCheck] = useState<CodeCheck>({ phase: "idle" });
  const [submit, setSubmit] = useState<SubmitState>({ phase: "idle" });
  const optionsController = useRef<AbortController | null>(null);
  const actionController = useRef<AbortController | null>(null);

  // 제안 코드는 화면을 연 시점에 한 번 정한다. 서버에서 받은 프로젝트 코드만 본다(데모 샘플 코드는 섞지 않는다).
  const [suggestedCode] = useState(() =>
    generateProjectCode(projects.filter((p) => p.serverId !== undefined).map((p) => p.code), issueYear(TODAY)),
  );

  const loadOptions = useCallback(() => {
    optionsController.current?.abort();
    const controller = new AbortController();
    optionsController.current = controller;
    setOptionsState({ phase: "loading" });
    fetchCreationOptions({ signal: controller.signal }).then((result) => {
      if (controller.signal.aborted) return;
      if (result.ok === false) {
        setOptionsState({ phase: "error", message: lookupFailureMessage(result.failure) });
        return;
      }
      setOptionsState({ phase: "ready", options: result.data });
      setForm((prev) => prev ?? initialForm(result.data, suggestedCode));
    });
  }, [suggestedCode]);

  useEffect(() => {
    loadOptions();
    return () => {
      optionsController.current?.abort();
      actionController.current?.abort();
    };
  }, [loadOptions]);

  const dirty = Boolean(form && (form.name.trim() || form.startDate || form.endDate));
  useEffect(() => {
    if (dirty) setUnsavedGuard(UNSAVED_MESSAGE);
    else clearUnsavedGuard(UNSAVED_MESSAGE);
    return () => clearUnsavedGuard(UNSAVED_MESSAGE);
  }, [dirty]);

  const options = optionsState.phase === "ready" ? optionsState.options : null;
  const blockers = options ? requiredBlockers(options) : [];
  const submitting = submit.phase === "submitting";

  /** 입력을 바꾸면 그 칸의 오류를 지운다(기간은 시작일·종료일이 한 오류를 같이 쓴다). */
  const update = (patch: Partial<ServerCreateForm>) => {
    setForm((prev) => (prev ? { ...prev, ...patch } : prev));
    setErrors((prev) => {
      const next = { ...prev };
      if ("name" in patch) delete next.name;
      if ("code" in patch) delete next.code;
      if ("startDate" in patch || "endDate" in patch) delete next.period;
      if ("actors" in patch) delete next.actors;
      return next;
    });
    if (submit.phase === "failed") setSubmit({ phase: "idle" });
  };

  const close = useCallback(() => {
    clearUnsavedGuard(UNSAVED_MESSAGE);
    navigate("/projects");
  }, [navigate]);

  // 데모 생성 화면과 같이 Esc로 닫는다. 만드는 중에는 닫지 않는다.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && submit.phase !== "submitting") close();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [close, submit.phase]);

  const checkCode = async () => {
    if (!form || codeCheck.phase === "checking") return;
    const found = validateCreateForm(form);
    if (found.code) {
      setErrors((prev) => ({ ...prev, code: found.code }));
      return;
    }
    actionController.current?.abort();
    const controller = new AbortController();
    actionController.current = controller;
    setCodeCheck({ phase: "checking" });
    const result = await checkProjectCode({ code: form.code, signal: controller.signal });
    if (controller.signal.aborted) return;
    if (result.ok === true) setCodeCheck({ phase: "done", ...result.data });
    else setCodeCheck({ phase: "error", message: lookupFailureMessage(result.failure) });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form || !options || submitting || blockers.length > 0) return;
    const found = validateCreateForm(form);
    setErrors(found);
    const input = toCreateInput(form);
    if (Object.keys(found).length > 0 || !input) return;

    actionController.current?.abort();
    const controller = new AbortController();
    actionController.current = controller;
    setSubmit({ phase: "submitting" });
    const result = await createProject({ input, signal: controller.signal });
    if (controller.signal.aborted) return;
    if (result.ok === false) {
      const { message, field } = interpretCreateFailure(result.failure);
      if (field) setErrors((prev) => ({ ...prev, [field]: message }));
      setSubmit(field ? { phase: "idle" } : { phase: "failed", message });
      return;
    }
    // 서버가 만든 프로젝트를 바로 화면 목록에 넣고, 목록 화면에서 서버 목록을 다시 받는다.
    syncServerProjectDetail({ detail: result.data, phases: null, members: null });
    clearUnsavedGuard(UNSAVED_MESSAGE);
    const state: ProjectCreatedState = { projectCreated: { id: result.data.id, name: result.data.name } };
    navigate("/projects", { state });
  };

  const renderBody = () => {
    if (optionsState.phase === "loading") {
      return (
        <p role="status" className="py-10 text-center text-[12.5px] text-foreground-500">
          {PROJECT_CREATE_TEXT.loadingOptions}
        </p>
      );
    }
    if (optionsState.phase === "error" || !options || !form) {
      return (
        <div role="alert" className="py-10 text-center">
          <p className="text-[12.5px] font-medium text-foreground-900">{PROJECT_CREATE_TEXT.optionsFailed}</p>
          {optionsState.phase === "error" && optionsState.message && (
            <p className="mt-1 text-[11.5px] text-foreground-600">{optionsState.message}</p>
          )}
          <button type="button" className="btn-outline mt-3" onClick={loadOptions}>
            {BUTTON_TEXT.retry}
          </button>
        </div>
      );
    }
    const actors = selectableActors(options);
    const methodologies = selectableMethodologies(options);
    const features = selectableFeatures(options, form.methodology);
    const fieldError = (key: keyof CreateErrors) =>
      errors[key] ? (
        <p id={`server-create-${key}-error`} role="alert" className="mt-1 text-[11px] text-rose-600">
          {errors[key]}
        </p>
      ) : null;

    return (
      <div className="space-y-5">
        {blockers.length > 0 && (
          <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-[11.5px] leading-5 text-rose-700">
            <p className="font-semibold">{PROJECT_CREATE_TEXT.blockedTitle}</p>
            <ul className="mt-1 list-disc pl-4">
              {blockers.map((blocker) => (
                <li key={blocker}>{blocker}</li>
              ))}
            </ul>
          </div>
        )}

        <Section title={PROJECT_CREATE_TEXT.basicSection}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <label htmlFor="server-create-name" className="mb-1 block text-[11.5px] font-medium text-foreground-800">
                {PROJECT_CREATE_TEXT.name}
              </label>
              <input
                id="server-create-name"
                className={`field text-[12.5px] ${errors.name ? "border-rose-300" : ""}`}
                value={form.name}
                maxLength={100}
                placeholder={PROJECT_CREATE_TEXT.namePlaceholder}
                disabled={submitting}
                onChange={(event) => update({ name: event.target.value })}
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? "server-create-name-error" : undefined}
              />
              {fieldError("name")}
            </div>
            <div className="md:col-span-2">
              <label htmlFor="server-create-code" className="mb-1 block text-[11.5px] font-medium text-foreground-800">
                {PROJECT_CREATE_TEXT.code}
              </label>
              <div className="flex gap-2">
                <input
                  id="server-create-code"
                  className={`field font-mono text-[12.5px] ${errors.code ? "border-rose-300" : ""}`}
                  value={form.code}
                  maxLength={20}
                  spellCheck={false}
                  autoComplete="off"
                  disabled={submitting}
                  onChange={(event) => {
                    update({ code: event.target.value });
                    setCodeCheck({ phase: "idle" });
                  }}
                  aria-invalid={Boolean(errors.code)}
                  aria-describedby={errors.code ? "server-create-code-error" : "server-create-code-hint"}
                />
                <button type="button" className="btn-outline shrink-0" onClick={checkCode} disabled={submitting || codeCheck.phase === "checking"}>
                  {codeCheck.phase === "checking" ? PROJECT_CREATE_TEXT.checkingCode : PROJECT_CREATE_TEXT.checkCode}
                </button>
              </div>
              {fieldError("code")}
              {!errors.code && (
                <p id="server-create-code-hint" className="mt-1 text-[11px] text-foreground-500">
                  {PROJECT_CREATE_TEXT.codeHint}
                </p>
              )}
              {codeCheck.phase === "done" && (
                <p role="status" className={`mt-1 text-[11px] ${codeCheck.available ? "text-emerald-700" : "text-rose-600"}`}>
                  {formatLabel(codeCheck.available ? PROJECT_CREATE_TEXT.codeAvailable : PROJECT_CREATE_TEXT.codeTaken, { code: codeCheck.code })}
                </p>
              )}
              {codeCheck.phase === "error" && (
                <p role="alert" className="mt-1 text-[11px] text-rose-600">
                  {codeCheck.message}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="server-create-start" className="mb-1 block text-[11.5px] font-medium text-foreground-800">
                {PROJECT_CREATE_TEXT.startDate}
              </label>
              <input
                id="server-create-start"
                type="date"
                className="field text-[12.5px]"
                value={form.startDate}
                disabled={submitting}
                onChange={(event) => update({ startDate: event.target.value })}
              />
            </div>
            <div>
              <label htmlFor="server-create-end" className="mb-1 block text-[11.5px] font-medium text-foreground-800">
                {PROJECT_CREATE_TEXT.endDate}
              </label>
              <input
                id="server-create-end"
                type="date"
                className={`field text-[12.5px] ${errors.period ? "border-rose-300" : ""}`}
                value={form.endDate}
                disabled={submitting}
                onChange={(event) => update({ endDate: event.target.value })}
                aria-invalid={Boolean(errors.period)}
                aria-describedby={errors.period ? "server-create-period-error" : undefined}
              />
            </div>
            <div className="md:col-span-2">
              {fieldError("period")}
              {!errors.period && <p className="text-[11px] text-foreground-500">{PROJECT_CREATE_TEXT.periodHint}</p>}
            </div>
            <div>
              <label htmlFor="server-create-visibility" className="mb-1 block text-[11.5px] font-medium text-foreground-800">
                {PROJECT_CREATE_TEXT.visibility}
              </label>
              <select
                id="server-create-visibility"
                className="field text-[12.5px]"
                value={form.visibility}
                disabled={submitting}
                onChange={(event) => update({ visibility: event.target.value as Visibility })}
              >
                {VISIBILITIES.map((visibility) => (
                  <option key={visibility} value={visibility}>
                    {VISIBILITY_LABEL[visibility]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Section>

        <Section title={PROJECT_CREATE_TEXT.structureSection}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label htmlFor="server-create-template" className="mb-1 block text-[11.5px] font-medium text-foreground-800">
                {PROJECT_CREATE_TEXT.template}
              </label>
              <select
                id="server-create-template"
                className="field text-[12.5px]"
                value={form.template ?? ""}
                disabled={submitting}
                onChange={(event) => setForm((prev) => (prev ? applyTemplate(prev, event.target.value as ProjectTemplate, options) : prev))}
              >
                {options.templates.map(({ value }) => (
                  <option key={value} value={value}>
                    {PROJECT_TEMPLATE_LABEL[value]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="server-create-methodology" className="mb-1 block text-[11.5px] font-medium text-foreground-800">
                {PROJECT_CREATE_TEXT.methodology}
              </label>
              <select
                id="server-create-methodology"
                className="field text-[12.5px]"
                value={form.methodology ?? ""}
                disabled={submitting}
                onChange={(event) => setForm((prev) => (prev ? changeMethodology(prev, event.target.value as MethodKey, options) : prev))}
              >
                {options.methodologies.map(({ value, enabled }) => (
                  <option key={value} value={value} disabled={!enabled || !methodologies.includes(value)}>
                    {METHODOLOGY_LABEL[value]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Section>

        <Section title={PROJECT_CREATE_TEXT.actorsSection}>
          <fieldset aria-describedby={errors.actors ? "server-create-actors-error" : "server-create-actors-hint"}>
            <legend className="sr-only">{PROJECT_CREATE_TEXT.actorsSection}</legend>
            <div className="flex flex-wrap gap-2">
              {actors.map(({ value, required }) => {
                const checked = form.actors.includes(value);
                return (
                  <label key={value} className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-background-300 px-2.5 text-[12px]">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary-600"
                      checked={checked}
                      disabled={required || submitting}
                      onChange={() => update({ actors: checked ? form.actors.filter((actor) => actor !== value) : [...form.actors, value] })}
                    />
                    {actorLabel(value)}
                  </label>
                );
              })}
            </div>
          </fieldset>
          {fieldError("actors")}
          {!errors.actors && (
            <p id="server-create-actors-hint" className="text-[11px] text-foreground-500">
              {PROJECT_CREATE_TEXT.actorsHint}
            </p>
          )}
        </Section>

        <Section title={PROJECT_CREATE_TEXT.featuresSection}>
          <div className="flex flex-wrap gap-2">
            {features.map((feature: ProjectFeature) => {
              const checked = form.features.includes(feature);
              return (
                <label key={feature} className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-background-300 px-2.5 text-[12px]">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary-600"
                    checked={checked}
                    disabled={submitting}
                    onChange={() => update({ features: checked ? form.features.filter((item) => item !== feature) : [...form.features, feature] })}
                  />
                  {PROJECT_FEATURE_LABEL[feature]}
                </label>
              );
            })}
          </div>
          <p className="text-[11px] text-foreground-500">{PROJECT_CREATE_TEXT.featuresHint}</p>
        </Section>

        <Section title={PROJECT_CREATE_TEXT.pmSection}>
          <p className="rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-[12px] text-foreground-900">
            {formatLabel(PROJECT_CREATE_TEXT.pmSelf, { name: account?.name ?? "-" })}
          </p>
        </Section>

        {!SERVER_DIRECTORY.departments.available && (
          <UnavailableItem title={PROJECT_CREATE_TEXT.departmentsSection} reason={SERVER_DIRECTORY.departments.reason()} />
        )}
        {!SERVER_DIRECTORY.users.available && (
          <>
            <UnavailableItem title={PROJECT_CREATE_TEXT.membersSection} reason={SERVER_DIRECTORY.users.reason()} />
            <UnavailableItem title={PROJECT_CREATE_TEXT.approverSection} reason={PROJECT_DIRECTORY_TEXT.approverUnavailable} />
          </>
        )}

        {submit.phase === "failed" && (
          <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[11.5px] leading-5 text-rose-700">
            {submit.message}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-foreground-950/70 backdrop-blur-[2px] sm:items-center sm:p-4 md:p-6">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="server-create-title"
        noValidate
        onSubmit={handleSubmit}
        aria-busy={submitting}
        className="dialog-enter flex max-h-[94vh] w-full flex-col overflow-hidden rounded-t-2xl border border-background-200 bg-background-50 shadow-panel sm:max-h-[90vh] sm:max-w-[760px] sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-background-200 px-5 py-4 md:px-6">
          <div className="min-w-0">
            <h2 id="server-create-title" className="text-[17px] font-semibold text-foreground-950">
              {PROJECT_CREATE_TEXT.title}
            </h2>
            <p className="mt-1 text-[11.5px] leading-5 text-foreground-500">{PROJECT_CREATE_TEXT.description}</p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label={BUTTON_TEXT.close}
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-foreground-500 hover:bg-background-200 hover:text-foreground-900"
          >
            <i className="ri-close-line text-[17px]" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 md:px-6">{renderBody()}</div>
        <div className="flex items-center justify-end gap-2 border-t border-background-200 px-5 py-4 md:px-6">
          <button type="button" className="btn-outline whitespace-nowrap" onClick={close} disabled={submitting}>
            {PROJECT_CREATE_TEXT.cancel}
          </button>
          <button
            type="submit"
            className="btn-primary whitespace-nowrap"
            disabled={!options || blockers.length > 0 || submitting}
          >
            <i className="ri-add-circle-line" aria-hidden="true" />
            {submitting ? PROJECT_CREATE_TEXT.submitting : PROJECT_CREATE_TEXT.submit}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ServerProjectCreateWizard;
