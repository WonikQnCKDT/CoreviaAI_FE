import { useEffect, useRef, useState, type FormEvent } from "react";
import Modal from "@/components/ui/Modal";
import {
  createAdminUser,
  updateAdminUserProfile,
  type AdminUser,
} from "@/features/admin/api/adminApi";
import type { DepartmentNode } from "@/features/admin/hooks/useDepartments";
import { ADMIN_TEXT, SYSTEM_ROLE_TEXT } from "@/features/admin/i18n/ko";
import {
  interpretCreateUserFailure,
  interpretUpdateProfileFailure,
  type UserFormField,
} from "@/features/admin/utils/adminUserFailure";
import type { SystemRole } from "@/types";
import { BUTTON_TEXT } from "@/shared/i18n/catalog/button";
import { formatLabel } from "@/shared/i18n/store";

export type UserFormMode = { kind: "create" } | { kind: "edit"; user: AdminUser };

interface UserFormDialogProps {
  mode: UserFormMode | null;
  departments: DepartmentNode[];
  onClose: () => void;
  onSaved: (args: { user: AdminUser; created: boolean; temporaryPassword?: string | null }) => void;
  /** 409 동시 수정 등으로 최신 값을 다시 받아야 할 때 */
  onStale: (userId: number) => void;
}

type FieldKey = UserFormField;
type FieldErrors = Partial<Record<FieldKey, string>>;
type SubmitState = { phase: "idle" } | { phase: "submitting" } | { phase: "failed"; message: string };

interface FormValues {
  loginId: string;
  name: string;
  systemRole: SystemRole;
  departmentId: string;
  jobTitle: string;
}

const MAX_LENGTH = 50;
const LOGIN_ID_PATTERN = /^[A-Za-z0-9._-]{1,50}$/;
const ROLES: SystemRole[] = ["user", "exec", "admin"];

const EMPTY: FormValues = { loginId: "", name: "", systemRole: "user", departmentId: "", jobTitle: "" };

const valuesFrom = function (mode: UserFormMode | null): FormValues {
  if (!mode || mode.kind === "create") return EMPTY;
  const { loginId, name, systemRole, departmentId, jobTitle } = mode.user;
  return {
    loginId,
    name,
    systemRole,
    departmentId: departmentId === null ? "" : String(departmentId),
    jobTitle: jobTitle ?? "",
  };
};

const UserFormDialog = function ({ mode, departments, onClose, onSaved, onStale }: UserFormDialogProps) {
  const [values, setValues] = useState<FormValues>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submit, setSubmit] = useState<SubmitState>({ phase: "idle" });
  const controllerRef = useRef<AbortController | null>(null);
  const creating = mode?.kind === "create";
  const submitting = submit.phase === "submitting";
  const editingUser = mode?.kind === "edit" ? mode.user : null;

  useEffect(() => {
    controllerRef.current?.abort();
    setValues(valuesFrom(mode));
    setErrors({});
    setSubmit({ phase: "idle" });
  }, [mode]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  // 비활성 부서에는 새로 배치할 수 없다. 단, 수정 중인 사용자의 현재 부서는 그대로 보여준다.
  const departmentOptions = departments.filter(
    ({ department }) => department.status === "active" || String(department.id) === values.departmentId,
  );
  const needsDepartment = values.systemRole !== "admin";

  const update = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (key in errors) setErrors((prev) => ({ ...prev, [key]: undefined }));
    if (submit.phase === "failed") setSubmit({ phase: "idle" });
  };

  const validate = (): FieldErrors => {
    const { loginId, name, departmentId, jobTitle } = values;
    const found: FieldErrors = {};
    if (creating) {
      if (!loginId.trim()) found.loginId = ADMIN_TEXT.loginIdRequired;
      else if (!LOGIN_ID_PATTERN.test(loginId.trim())) found.loginId = ADMIN_TEXT.loginIdFormat;
    }
    if (!name.trim()) found.name = ADMIN_TEXT.nameRequired;
    else if (name.trim().length > MAX_LENGTH) found.name = ADMIN_TEXT.nameTooLong;
    if (needsDepartment && !departmentId) found.departmentId = ADMIN_TEXT.departmentRequired;
    if (jobTitle.trim().length > MAX_LENGTH) found.jobTitle = ADMIN_TEXT.jobTitleTooLong;
    return found;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!mode || submitting) return;
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setSubmit({ phase: "submitting" });

    const { loginId, name, systemRole, departmentId, jobTitle } = values;
    const department = departmentId ? Number(departmentId) : null;
    if (mode.kind === "create") {
      const result = await createAdminUser({
        input: { loginId, name, systemRole, departmentId: department, jobTitle },
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (result.ok === true) {
        setSubmit({ phase: "idle" });
        onSaved({
          user: result.data.user,
          created: true,
          temporaryPassword: result.data.temporaryPassword,
        });
        return;
      }
      const { message, field } = interpretCreateUserFailure(result.failure);
      if (field) {
        setErrors({ [field]: message });
        setSubmit({ phase: "idle" });
        return;
      }
      setSubmit({ phase: "failed", message });
      return;
    }

    const result = await updateAdminUserProfile({
      userId: mode.user.id,
      input: { name, departmentId: department, jobTitle },
      signal: controller.signal,
    });
    if (controller.signal.aborted) return;

    if (result.ok === true) {
      setSubmit({ phase: "idle" });
      onSaved({ user: result.data, created: false });
      return;
    }

    const { message, field, stale } = interpretUpdateProfileFailure(result.failure);
    if (stale) onStale(mode.user.id);
    if (field) {
      setErrors({ [field]: message });
      setSubmit({ phase: "idle" });
      return;
    }
    setSubmit({ phase: "failed", message });
  };

  const fieldClass = (key: FieldKey) => `field text-sm ${errors[key] ? "border-rose-300" : ""}`;
  const describedBy = (key: FieldKey) => (errors[key] ? `user-${key}-error` : undefined);
  const errorText = (key: FieldKey) =>
    errors[key] ? (
      <p id={`user-${key}-error`} role="alert" className="mt-1 text-xs text-rose-600">
        {errors[key]}
      </p>
    ) : null;

  return (
    <Modal
      open={Boolean(mode)}
      title={creating ? ADMIN_TEXT.addUser : ADMIN_TEXT.editUser}
      description={creating ? ADMIN_TEXT.userCreateDescription : ADMIN_TEXT.userEditDescription}
      onClose={() => {
        if (!submitting) onClose();
      }}
      footer={
        <>
          <button type="button" className="btn-outline" onClick={onClose} disabled={submitting}>
            {ADMIN_TEXT.cancel}
          </button>
          <button type="submit" form="admin-user-form" className="btn-primary" disabled={submitting}>
            {submitting ? (
              <>
                <i className="ri-loader-4-line animate-spin motion-reduce:animate-none" aria-hidden="true" />
                {ADMIN_TEXT.saving}
              </>
            ) : creating ? (
              BUTTON_TEXT.add
            ) : (
              ADMIN_TEXT.save
            )}
          </button>
        </>
      }
    >
      <form id="admin-user-form" className="grid grid-cols-1 gap-3 sm:grid-cols-2" onSubmit={handleSubmit} noValidate aria-busy={submitting}>
        <div className="min-w-0">
          <label htmlFor="user-loginId" className="mb-1 block text-xs font-medium text-foreground-800">
            {ADMIN_TEXT.fieldLoginId}
          </label>
          <input
            id="user-loginId"
            className={fieldClass("loginId")}
            value={values.loginId}
            maxLength={MAX_LENGTH}
            autoComplete="off"
            disabled={!creating || submitting}
            onChange={(event) => update("loginId", event.target.value)}
            aria-invalid={Boolean(errors.loginId)}
            aria-describedby={describedBy("loginId")}
          />
          {errorText("loginId")}
        </div>
        <div className="min-w-0">
          <label htmlFor="user-name" className="mb-1 block text-xs font-medium text-foreground-800">
            {ADMIN_TEXT.fieldName}
          </label>
          <input
            id="user-name"
            className={fieldClass("name")}
            value={values.name}
            maxLength={MAX_LENGTH}
            disabled={submitting}
            onChange={(event) => update("name", event.target.value)}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={describedBy("name")}
          />
          {errorText("name")}
        </div>
        {creating && (
          <div className="min-w-0">
            <label htmlFor="user-role" className="mb-1 block text-xs font-medium text-foreground-800">
              {ADMIN_TEXT.colSystemRole}
            </label>
            <select
              id="user-role"
              className="field text-sm"
              value={values.systemRole}
              disabled={submitting}
              onChange={(event) => update("systemRole", event.target.value as SystemRole)}
            >
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {SYSTEM_ROLE_TEXT[role]}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="min-w-0">
          <label htmlFor="user-departmentId" className="mb-1 block text-xs font-medium text-foreground-800">
            {needsDepartment ? ADMIN_TEXT.colDepartment : ADMIN_TEXT.fieldDepartmentOptional}
          </label>
          <select
            id="user-departmentId"
            className={fieldClass("departmentId")}
            value={values.departmentId}
            disabled={submitting}
            onChange={(event) => update("departmentId", event.target.value)}
            aria-invalid={Boolean(errors.departmentId)}
            aria-describedby={describedBy("departmentId")}
          >
            <option value="">{needsDepartment ? ADMIN_TEXT.fieldDepartmentSelect : ADMIN_TEXT.none}</option>
            {departmentOptions.map(({ department, path }) => (
              <option key={department.id} value={department.id}>
                {path}
                {department.status === "inactive" ? ADMIN_TEXT.inactiveSuffix : ""}
              </option>
            ))}
          </select>
          {errorText("departmentId")}
        </div>
        <div className="min-w-0">
          <label htmlFor="user-jobTitle" className="mb-1 block text-xs font-medium text-foreground-800">
            {ADMIN_TEXT.fieldJobTitleOptional}
          </label>
          <input
            id="user-jobTitle"
            className={fieldClass("jobTitle")}
            value={values.jobTitle}
            maxLength={MAX_LENGTH}
            disabled={submitting}
            onChange={(event) => update("jobTitle", event.target.value)}
            aria-invalid={Boolean(errors.jobTitle)}
            aria-describedby={describedBy("jobTitle")}
          />
          {errorText("jobTitle")}
        </div>
        {editingUser && (
          <p className="text-xs text-foreground-500 sm:col-span-2">
            {formatLabel(ADMIN_TEXT.loginIdFixedNote, { loginId: editingUser.loginId })}
          </p>
        )}
        {submit.phase === "failed" && (
          <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700 sm:col-span-2">
            {submit.message}
          </p>
        )}
      </form>
    </Modal>
  );
};

export default UserFormDialog;
