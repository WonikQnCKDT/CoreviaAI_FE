import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDemoStore } from "@/stores/DemoStore";
import { addDays, TODAY } from "@/utils/date";
import { generateProjectCode, issueYear } from "@/features/project/utils/projectCode";
import { clearUnsavedGuard, setUnsavedGuard } from "@/utils/navGuard";
import { canCreateProject } from "@/utils/permission";
import NoAccess from "@/components/ui/NoAccess";
import StepBasicInfo from "@/features/project/components/create/StepBasicInfo";
import StepMethod from "@/features/project/components/create/StepMethod";
import StepActors from "@/features/project/components/create/StepActors";
import StepMembers from "@/features/project/components/create/StepMembers";
import StepApprover from "@/features/project/components/create/StepApprover";
import InputSummary from "@/features/project/components/create/InputSummary";
import { STEP_META, TOTAL_STEPS, type ProjectFormState } from "@/features/project/types";
import type { RoleKey, User } from "@/types";

const UNSAVED_MESSAGE = "저장하지 않은 프로젝트 정보가 있습니다.";

function ProjectCreateWizard() {
  const navigate = useNavigate();
  const { projects, users, currentUser, createProject } = useDemoStore();

  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  // 식별 코드는 사용자가 입력하지 않고, 기존 코드 규칙으로 화면 진입 시 한 번만 발급합니다.
  const [issuedCode] = useState(() => generateProjectCode(projects.map((p) => p.code), issueYear(TODAY)));
  const bodyRef = useRef<HTMLDivElement | null>(null);

  const [form, setForm] = useState<ProjectFormState>(() => ({
    name: "",
    description: "",
    startDate: TODAY,
    endDate: addDays(TODAY, 90),
    pmId: currentUser.id,
    dept: currentUser.dept,
    visibility: "company",
    actors: ["pm", "biz", "dev", "qa"],
    members: [],
    gateApproverId: null,
  }));

  const dirty = useMemo(
    () =>
      Boolean(form.name.trim()) ||
      Boolean(form.description.trim()) ||
      step > 1 ||
      summaryOpen ||
      form.members.length > 0 ||
      Boolean(form.gateApproverId) ||
      form.visibility !== "company" ||
      form.dept !== currentUser.dept ||
      form.pmId !== currentUser.id ||
      form.startDate !== TODAY ||
      form.endDate !== addDays(TODAY, 90),
    [form, step, summaryOpen, currentUser.dept, currentUser.id],
  );

  // 앱 내부 뒤로가기가 저장하지 않은 입력을 모르고 지나가지 않도록 알려 줍니다.
  useEffect(() => {
    if (dirty) setUnsavedGuard(UNSAVED_MESSAGE);
    else clearUnsavedGuard(UNSAVED_MESSAGE);
    return () => clearUnsavedGuard(UNSAVED_MESSAGE);
  }, [dirty]);

  // 모달이 열려 있는 동안 뒤 배경이 함께 스크롤되지 않도록 고정합니다.
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  // 단계가 바뀌면 내용 상단부터 보이게 합니다.
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [step, summaryOpen]);

  const handleClose = useCallback(() => {
    if (dirty) {
      setLeaveConfirm(true);
      return;
    }
    navigate("/projects");
  }, [dirty, navigate]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (leaveConfirm) {
        setLeaveConfirm(false);
        return;
      }
      if (summaryOpen) {
        setSummaryOpen(false);
        return;
      }
      handleClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [handleClose, leaveConfirm, summaryOpen]);

  const errors = useMemo(() => {
    const result: Record<string, string> = {};
    if (!form.name.trim()) result.name = "프로젝트명을 입력해 주세요.";
    if (!form.startDate) result.startDate = "시작일을 선택해 주세요.";
    if (!form.endDate) result.endDate = "종료일을 선택해 주세요.";
    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      result.endDate = "종료일이 시작일보다 빠릅니다.";
    }
    if (!form.pmId) result.pmId = "PM을 선택해 주세요.";
    if (!form.dept) result.dept = "주관 부서를 선택해 주세요.";
    if (!form.actors.includes("pm")) result.actors = "PM 액터는 반드시 포함되어야 합니다.";
    return result;
  }, [form]);

  const basicValid = ["name", "startDate", "endDate", "pmId", "dept"].every((key) => !errors[key]);

  const handlePatch = (patch: Partial<ProjectFormState>) => {
    setForm((prev) => {
      const merged = { ...prev, ...patch };
      // PM이 바뀌면 PM은 승인자가 될 수 없으므로 승인자 지정을 해제합니다.
      if (patch.pmId && merged.gateApproverId === patch.pmId) merged.gateApproverId = null;
      return merged;
    });
  };

  const copyIssuedCode = async () => {
    try {
      await navigator.clipboard.writeText(issuedCode);
      setCodeCopied(true);
      window.setTimeout(() => setCodeCopied(false), 1600);
    } catch {
      setCodeCopied(false);
    }
  };

  const toggleActor = (key: RoleKey) => {
    if (key === "pm") return;
    setForm((prev) => {
      const removing = prev.actors.includes(key);
      const removedUserIds = removing
        ? prev.members.filter((m) => m.role === key).map((m) => m.userId)
        : [];
      return {
        ...prev,
        actors: removing ? prev.actors.filter((a) => a !== key) : [...prev.actors, key],
        members: removing ? prev.members.filter((m) => m.role !== key) : prev.members,
        gateApproverId:
          prev.gateApproverId && removedUserIds.includes(prev.gateApproverId) ? null : prev.gateApproverId,
      };
    });
  };

  const toggleMember = (userId: string) => {
    setForm((prev) => {
      if (prev.members.some((m) => m.userId === userId)) {
        return {
          ...prev,
          members: prev.members.filter((m) => m.userId !== userId),
          gateApproverId: prev.gateApproverId === userId ? null : prev.gateApproverId,
        };
      }
      const user = users.find((u) => u.id === userId);
      const roles = prev.actors.filter((a) => a !== "pm");
      const fallback = (roles.length > 0 ? roles : ["biz", "dev", "qa"]) as RoleKey[];
      const role = user && fallback.includes(user.role) ? user.role : fallback[0];
      return { ...prev, members: [...prev.members, { userId, role }] };
    });
  };

  const changeMemberRole = (userId: string, role: RoleKey) => {
    setForm((prev) => ({
      ...prev,
      members: prev.members.map((m) => (m.userId === userId ? { ...m, role } : m)),
    }));
  };

  const goNext = () => {
    setSubmitted(true);
    if (step === 1) {
      if (!basicValid) return;
      setSubmitted(false);
      setSummaryOpen(true);
      return;
    }
    if (step === 3 && !form.actors.includes("pm")) return;
    setSubmitted(false);
    setStep((prev) => Math.min(prev + 1, TOTAL_STEPS));
  };

  const goPrev = () => {
    setSubmitted(false);
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const handleCreate = () => {
    if (!basicValid) {
      setStep(1);
      setSubmitted(true);
      return;
    }
    if (!form.actors.includes("pm")) {
      setStep(3);
      setSubmitted(true);
      return;
    }
    // 생성 시점에 한 번 더 중복을 확인해, 화면을 열어 둔 사이 발급된 코드와 겹치지 않게 합니다.
    const codeTaken = projects.some((p) => p.code.toUpperCase() === issuedCode.toUpperCase());
    const finalCode = codeTaken ? generateProjectCode(projects.map((p) => p.code), issueYear(TODAY)) : issuedCode;
    const id = createProject({
      name: form.name.trim(),
      description: form.description.trim(),
      code: finalCode,
      dept: form.dept,
      startDate: form.startDate,
      endDate: form.endDate,
      pmId: form.pmId,
      visibility: form.visibility,
      actors: form.actors,
      members: form.members,
      gateApproverId: form.gateApproverId,
    });
    clearUnsavedGuard(UNSAVED_MESSAGE);
    navigate(`/projects/${id}`);
  };

  const approverMembers = useMemo(() => {
    return form.members
      .filter((m) => m.userId !== form.pmId)
      .map((m) => ({ ...m, user: users.find((u) => u.id === m.userId) }))
      .filter((m): m is { userId: string; role: RoleKey; user: User } => Boolean(m.user));
  }, [form.members, form.pmId, users]);

  const pmName = users.find((u) => u.id === form.pmId)?.name || "-";
  const meta = STEP_META[step];

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-foreground-950/70 backdrop-blur-[2px] sm:items-center sm:p-4 md:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-project-title"
        className="dialog-enter flex max-h-[94vh] w-full flex-col overflow-hidden rounded-t-2xl border border-background-200 bg-background-50 shadow-panel sm:max-h-[90vh] sm:max-w-[760px] sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-background-200 px-5 py-4 md:px-6">
          <div className="min-w-0">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-primary-600">
              새 프로젝트 · {summaryOpen ? "입력 확인" : `${step}단계`}
            </p>
            <h2 id="create-project-title" className="mt-1 truncate text-[17px] font-semibold text-foreground-950">
              {summaryOpen ? "입력 내용 확인" : meta.title}
            </h2>
            <p className="mt-1 text-[11.5px] leading-5 text-foreground-500">
              {summaryOpen ? "입력한 기본 정보를 확인한 뒤 다음 단계로 이동합니다." : meta.desc}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="닫기"
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-foreground-500 hover:bg-background-200 hover:text-foreground-900"
          >
            <i className="ri-close-line text-[17px]" aria-hidden="true" />
          </button>
        </div>

        <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-5 md:px-6">
          {summaryOpen ? (
            <InputSummary
              form={form}
              users={users}
              issuedCode={issuedCode}
              onCancel={() => {
                setSummaryOpen(false);
                setSubmitted(false);
              }}
              onConfirm={() => {
                setSummaryOpen(false);
                setSubmitted(false);
                setStep(2);
              }}
            />
          ) : (
            <>
              {step === 1 && (
                <StepBasicInfo
                  form={form}
                  users={users}
                  currentUserId={currentUser.id}
                  issuedCode={issuedCode}
                  codeCopied={codeCopied}
                  onCopyCode={copyIssuedCode}
                  onChange={handlePatch}
                  errors={errors}
                  submitted={submitted}
                />
              )}
              {step === 2 && <StepMethod />}
              {step === 3 && (
                <StepActors actors={form.actors} onToggle={toggleActor} error={errors.actors} submitted={submitted} />
              )}
              {step === 4 && (
                <StepMembers
                  users={users}
                  pmId={form.pmId}
                  members={form.members}
                  actors={form.actors}
                  onToggle={toggleMember}
                  onChangeRole={changeMemberRole}
                />
              )}
              {step === 5 && (
                <StepApprover
                  members={approverMembers}
                  pmName={pmName}
                  value={form.gateApproverId}
                  onChange={(userId) => handlePatch({ gateApproverId: userId })}
                />
              )}
            </>
          )}
        </div>

        {!summaryOpen && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-background-200 bg-background-50 px-5 py-4 md:px-6">
            <button
              type="button"
              className="btn-outline whitespace-nowrap"
              onClick={step === 1 ? handleClose : goPrev}
            >
              <i className={step === 1 ? "ri-close-line" : "ri-arrow-left-line"} aria-hidden="true" />
              {step === 1 ? "취소" : "이전"}
            </button>
            <button
              type="button"
              className="btn-primary whitespace-nowrap"
              onClick={step === TOTAL_STEPS ? handleCreate : goNext}
            >
              {step === TOTAL_STEPS ? (
                <>
                  <i className="ri-add-circle-line" aria-hidden="true" />
                  프로젝트 생성
                </>
              ) : (
                <>
                  다음 단계
                  <i className="ri-arrow-right-line" aria-hidden="true" />
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {leaveConfirm && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-foreground-950/60 px-4">
          <div className="fade-enter w-full max-w-sm rounded-2xl border border-background-200 bg-background-50 p-5 shadow-panel">
            <div className="flex items-start gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                <i className="ri-error-warning-line text-[16px]" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h3 className="text-[14px] font-semibold text-foreground-950">작성 중인 내용이 있습니다</h3>
                <p className="mt-1 text-[11.5px] leading-5 text-foreground-600">
                  저장하지 않고 닫으면 입력한 내용이 사라집니다.
                </p>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="btn-outline whitespace-nowrap"
                onClick={() => setLeaveConfirm(false)}
              >
                계속 작성
              </button>
              <button
                type="button"
                className="btn-primary whitespace-nowrap"
                onClick={() => {
                  setLeaveConfirm(false);
                  clearUnsavedGuard(UNSAVED_MESSAGE);
                  navigate("/projects");
                }}
              >
                나가기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProjectCreatePage() {
  const { currentUser } = useDemoStore();
  if (!canCreateProject(currentUser)) {
    return (
      <NoAccess
        title="프로젝트를 만들 수 없는 계정입니다"
        description="프로젝트는 활성 상태의 일반 사용자라면 누구나 만들 수 있습니다. 경영진은 프로젝트를 조회만 하고, 시스템 관리자는 프로젝트 데이터에 접근하지 않습니다."
        requiredRole="일반 사용자"
      />
    );
  }
  return <ProjectCreateWizard />;
}