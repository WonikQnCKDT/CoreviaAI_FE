import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  checkProjectCode, createProject, fetchCreationOptions,
  type CreationOptions, type DepartmentType, type ProjectActor,
} from "@/features/project/api/projectApi";
import { PROJECT_ACTOR_LABEL, UNSAVED_PROJECT_MESSAGE, projectApiError } from "@/features/project/i18n/ko";
import { STEP_META } from "@/features/project/types";
import { hasServerProjectDraft, positiveServerId, validServerProjectCode } from "@/features/project/utils/serverProjectInput";
import { clearUnsavedGuard, setUnsavedGuard } from "@/utils/navGuard";
import { VISIBILITY_LABEL } from "@/utils/ui";
import type { MethodKey, Visibility } from "@/types";

interface InitialMember {
  userId: number;
  actor: ProjectActor;
}

export default function ServerProjectCreateWizard({ creatorId, creatorName }: { creatorId: number; creatorName: string }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [options, setOptions] = useState<CreationOptions | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [basic, setBasic] = useState({ name: "", code: "", startDate: "", endDate: "", department: "", visibility: "company" as Visibility });
  const [methodology, setMethodology] = useState<MethodKey | null>(null);
  const [departmentType, setDepartmentType] = useState<DepartmentType | null>(null);
  const [actors, setActors] = useState<ProjectActor[]>([]);
  const [members, setMembers] = useState<InitialMember[]>([]);
  const [memberId, setMemberId] = useState("");
  const [memberActor, setMemberActor] = useState<ProjectActor | "">("");
  const [approver, setApprover] = useState<number | null>(null);
  const pending = useRef<AbortController | null>(null);

  const hasDraft = hasServerProjectDraft({
    basic, methodology, departmentType, memberCount: members.length, memberId, memberActor, approver,
  });

  useEffect(() => {
    if (!hasDraft) return;
    setUnsavedGuard(UNSAVED_PROJECT_MESSAGE);
    return () => clearUnsavedGuard(UNSAVED_PROJECT_MESSAGE);
  }, [hasDraft]);

  const leaveForList = () => {
    if (hasDraft && !window.confirm(UNSAVED_PROJECT_MESSAGE)) return;
    clearUnsavedGuard(UNSAVED_PROJECT_MESSAGE);
    navigate("/projects");
  };

  useEffect(() => {
    const controller = new AbortController();
    void fetchCreationOptions({ signal: controller.signal }).then((result) => {
      if (controller.signal.aborted) return;
      if (result.ok === true) setOptions(result.data);
      else setLoadError(projectApiError(result.failure));
    });
    return () => controller.abort();
  }, [attempt]);

  useEffect(() => () => pending.current?.abort(), []);

  const departmentOptions = options?.departmentTypes.find(({ value }) => value === departmentType);
  const invitedRoles = actors.filter((actor) => actor !== "pm");
  const changeDepartmentType = (value: DepartmentType) => {
    setDepartmentType(value);
    setActors(options?.departmentTypes.find((entry) => entry.value === value)?.actors
      .filter((actor) => actor.enabled && actor.required).map((actor) => actor.value) ?? []);
    setMembers([]);
    setMemberActor("");
    setApprover(null);
  };

  const next = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending.current) return;
    setError("");
    const departmentId = positiveServerId(basic.department);
    if (step === 1 && (!basic.name.trim() || !validServerProjectCode(basic.code) || !departmentId ||
      !basic.startDate || !basic.endDate || basic.endDate < basic.startDate)) {
      setError("이름, 식별 코드, 부서 ID와 시작일·종료일을 확인해 주세요.");
      return;
    }
    if (step === 2 && (!methodology || !departmentType)) {
      setError("운영 방식과 부서 유형을 선택해 주세요.");
      return;
    }
    if (step === 3) {
      const retained = members.filter((member) => actors.includes(member.actor));
      setMembers(retained);
      if (!retained.some(({ userId }) => userId === approver)) setApprover(null);
    }
    if (step > 1 && step < 5) {
      setStep(step + 1);
      return;
    }

    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    try {
      if (step === 1) {
        const result = await checkProjectCode({ code: basic.code, signal: controller.signal });
        if (controller.signal.aborted) return;
        if (result.ok === false) setError(projectApiError(result.failure));
        else if (!result.data.available) setError("이미 사용 중인 프로젝트 코드입니다.");
        else setStep(2);
        return;
      }
      if (!departmentId || !methodology || !departmentType) return;
      const result = await createProject({
        input: {
          name: basic.name, code: basic.code, startDate: basic.startDate, endDate: basic.endDate,
          departmentId, visibility: basic.visibility, methodology, departmentType, actors, members,
          gateApproverUserId: approver,
        },
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (result.ok === true) {
        clearUnsavedGuard(UNSAVED_PROJECT_MESSAGE);
        navigate(`/projects/${result.data.id}`, { replace: true });
      }
      else setError(projectApiError(result.failure));
    } finally {
      pending.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  };

  const addMember = () => {
    const userId = positiveServerId(memberId);
    if (!userId || userId === creatorId || !memberActor || !invitedRoles.some((actor) => actor === memberActor) ||
      members.length >= 100 || members.some((member) => member.userId === userId)) {
      setError("생성자와 중복 ID를 제외하고, 사용자 ID와 지정한 역할을 입력해 주세요. 최대 100명까지 초대할 수 있습니다.");
      return;
    }
    setError("");
    setMembers([...members, { userId, actor: memberActor }]);
    setMemberId("");
  };

  return (
    <section className="card mx-auto max-w-3xl space-y-4" aria-labelledby="server-project-create">
      <h2 id="server-project-create" className="text-lg font-semibold">프로젝트 생성 · {STEP_META[step].title}</h2>
      {!options && (
        <>
          <p role={loadError ? "alert" : "status"}>{loadError || "생성 옵션을 불러오는 중입니다."}</p>
          {loadError && <button type="button" className="btn-outline" onClick={() => { setLoadError(""); setAttempt(attempt + 1); }}>다시 시도</button>}
          <Link className="btn-outline" to="/projects">목록</Link>
        </>
      )}
      {options && (
        <form className="space-y-4" onSubmit={next}>
          <fieldset disabled={busy} className="space-y-3">
            {step === 1 && (
              <>
                <label className="block">프로젝트명<input className="field" required maxLength={100} value={basic.name} onChange={(e) => setBasic({ ...basic, name: e.target.value })} /></label>
                <label className="block">식별 코드<input className="field" required maxLength={20} value={basic.code} onChange={(e) => setBasic({ ...basic, code: e.target.value })} /></label>
                <label className="block">주관 부서 ID<input className="field" required inputMode="numeric" value={basic.department} onChange={(e) => setBasic({ ...basic, department: e.target.value })} /></label>
                <p className="text-sm">PM은 생성자 {creatorName}으로 지정됩니다.</p>
                <label className="block">시작일<input className="field" required type="date" value={basic.startDate} onInput={(e) => setBasic({ ...basic, startDate: e.currentTarget.value })} /></label>
                <label className="block">종료일<input className="field" required type="date" min={basic.startDate} value={basic.endDate} onInput={(e) => setBasic({ ...basic, endDate: e.currentTarget.value })} /></label>
                <label className="block">공개 범위<select className="field" value={basic.visibility} onChange={(e) => setBasic({ ...basic, visibility: e.target.value as Visibility })}>
                  {Object.entries(VISIBILITY_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select></label>
              </>
            )}
            {step === 2 && (
              <>
                <label className="block">운영 방식<select className="field" value={methodology ?? ""} onChange={(e) => setMethodology(e.target.value as MethodKey)}>
                  <option value="" disabled>선택</option>
                  {options.methodologies.map(({ value, enabled }) => <option key={value} value={value} disabled={!enabled}>{value === "waterfall" ? "폭포수" : "애자일"}</option>)}
                </select></label>
                <label className="block">부서 유형<select className="field" value={departmentType ?? ""} onChange={(e) => changeDepartmentType(e.target.value as DepartmentType)}>
                  <option value="" disabled>선택</option>
                  {options.departmentTypes.map(({ value, enabled }) => <option key={value} value={value} disabled={!enabled}>{value === "sw" ? "SW" : "제조"}</option>)}
                </select></label>
              </>
            )}
            {step === 3 && departmentOptions?.actors.map(({ value, enabled, required }) => (
              <label key={value} className="flex items-center gap-2">
                <input type="checkbox" checked={actors.includes(value)} disabled={!enabled || required}
                  onChange={(e) => setActors(e.target.checked ? [...actors, value] : actors.filter((actor) => actor !== value))} />
                {PROJECT_ACTOR_LABEL[value]}
              </label>
            ))}
            {step === 4 && (
              <>
                {invitedRoles.length > 0 ? (
                  <>
                    <label className="block">초대할 사용자 ID<input className="field" inputMode="numeric" value={memberId} onChange={(e) => setMemberId(e.target.value)} /></label>
                    <label className="block">초대 역할<select className="field" value={memberActor} onChange={(e) => setMemberActor(e.target.value as ProjectActor)}>
                      <option value="">선택</option>
                      {invitedRoles.map((actor) => <option key={actor} value={actor}>{PROJECT_ACTOR_LABEL[actor]}</option>)}
                    </select></label>
                    <button type="button" className="btn-outline" onClick={addMember}>초대 대상 추가</button>
                    <ul>{members.map(({ userId, actor }) => (
                      <li key={userId} className="flex items-center gap-2 py-1">{userId} · {PROJECT_ACTOR_LABEL[actor]}
                        <button type="button" className="btn-outline" onClick={() => {
                          setMembers(members.filter((member) => member.userId !== userId));
                          if (approver === userId) setApprover(null);
                        }}>제외</button>
                      </li>
                    ))}</ul>
                  </>
                ) : <p>초대할 멤버 역할을 지정하려면 이전 단계로 돌아가세요.</p>}
              </>
            )}
            {step === 5 && (
              <label className="block">게이트 승인자<select className="field" value={approver ?? ""} onChange={(e) => setApprover(positiveServerId(e.target.value))}>
                <option value="">미지정</option>
                {members.map(({ userId, actor }) => <option key={userId} value={userId}>사용자 {userId} · {PROJECT_ACTOR_LABEL[actor]}</option>)}
              </select></label>
            )}
          </fieldset>
          {error && <p role="alert" className="text-rose-700">{error}</p>}
          <div className="flex gap-2">
            {step === 1 && <button type="button" className="btn-outline" onClick={leaveForList}>목록</button>}
            {step > 1 && <button type="button" className="btn-outline" disabled={busy} onClick={() => { setError(""); setStep(step - 1); }}>이전</button>}
            <button type="submit" className="btn-primary" disabled={busy}>{busy ? "처리 중" : step === 5 ? "프로젝트 생성" : "다음"}</button>
          </div>
        </form>
      )}
    </section>
  );
}
