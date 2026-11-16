import { useEffect, useRef, useState, type FormEvent } from "react";
import Modal from "@/components/ui/Modal";
import {
  createAdminDepartment,
  updateAdminDepartment,
  type AdminDepartment,
} from "@/features/admin/api/adminApi";
import { descendantIds, type DepartmentNode } from "@/features/admin/hooks/useDepartments";
import { ADMIN_TEXT } from "@/features/admin/i18n/ko";
import { adminErrorMessage, failureCode } from "@/features/admin/utils/adminFormat";

export type DepartmentFormMode =
  | { kind: "create"; parentId: number | null }
  | { kind: "edit"; department: AdminDepartment };

interface DepartmentFormDialogProps {
  mode: DepartmentFormMode | null;
  departments: AdminDepartment[];
  tree: DepartmentNode[];
  onClose: () => void;
  onSaved: (args: { department: AdminDepartment; created: boolean }) => void;
  /** 409 동시 수정·404처럼 목록이 낡았을 때 */
  onStale: () => void;
}

type SubmitState = { phase: "idle" } | { phase: "submitting" } | { phase: "failed"; message: string };

const MAX_LENGTH = 50;
const TOP_LEVEL = "";

const DepartmentFormDialog = function ({ mode, departments, tree, onClose, onSaved, onStale }: DepartmentFormDialogProps) {
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState(TOP_LEVEL);
  const [nameError, setNameError] = useState("");
  const [submit, setSubmit] = useState<SubmitState>({ phase: "idle" });
  const controllerRef = useRef<AbortController | null>(null);
  const creating = mode?.kind === "create";
  const submitting = submit.phase === "submitting";

  useEffect(() => {
    controllerRef.current?.abort();
    if (!mode) return;
    if (mode.kind === "create") {
      setName("");
      setParentId(mode.parentId === null ? TOP_LEVEL : String(mode.parentId));
    } else {
      setName(mode.department.name);
      setParentId(mode.department.parentId === null ? TOP_LEVEL : String(mode.department.parentId));
    }
    setNameError("");
    setSubmit({ phase: "idle" });
  }, [mode]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  // 상위 부서로는 활성 부서만 고를 수 있고, 수정할 때는 자기 자신과 하위 부서를 뺀다.
  const blocked = mode?.kind === "edit" ? descendantIds(departments, mode.department.id) : new Set<number>();
  const parentOptions = tree.filter(({ department }) => department.status === "active" && !blocked.has(department.id));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!mode || submitting) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError(ADMIN_TEXT.departmentNameRequired);
      return;
    }
    if (trimmed.length > MAX_LENGTH) {
      setNameError(ADMIN_TEXT.departmentNameTooLong);
      return;
    }

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setSubmit({ phase: "submitting" });
    const input = { name: trimmed, parentId: parentId === TOP_LEVEL ? null : Number(parentId) };
    const result =
      mode.kind === "create"
        ? await createAdminDepartment({ input, signal: controller.signal })
        : await updateAdminDepartment({ departmentId: mode.department.id, input, signal: controller.signal });
    if (controller.signal.aborted) return;

    if (result.ok === true) {
      setSubmit({ phase: "idle" });
      onSaved({ department: result.data, created: mode.kind === "create" });
      return;
    }
    const code = failureCode(result.failure);
    const message = adminErrorMessage(result.failure);
    if (code === "CONCURRENT_MODIFICATION" || code === "DEPARTMENT_NOT_FOUND" || code === "INVALID_DEPARTMENT_PARENT") onStale();
    if (code === "DUPLICATE_DEPARTMENT_NAME") {
      setNameError(message);
      setSubmit({ phase: "idle" });
      return;
    }
    setSubmit({ phase: "failed", message });
  };

  return (
    <Modal
      open={Boolean(mode)}
      title={creating ? ADMIN_TEXT.addDepartment : ADMIN_TEXT.editDepartment}
      description={creating ? "같은 상위 부서 안에서는 이름이 겹칠 수 없습니다." : "이름을 바꾸거나 다른 상위 부서 밑으로 옮깁니다."}
      onClose={() => {
        if (!submitting) onClose();
      }}
      footer={
        <>
          <button type="button" className="btn-outline" onClick={onClose} disabled={submitting}>
            {ADMIN_TEXT.cancel}
          </button>
          <button type="submit" form="admin-department-form" className="btn-primary" disabled={submitting}>
            {submitting ? (
              <>
                <i className="ri-loader-4-line animate-spin motion-reduce:animate-none" aria-hidden="true" />
                {ADMIN_TEXT.saving}
              </>
            ) : creating ? (
              "추가"
            ) : (
              ADMIN_TEXT.save
            )}
          </button>
        </>
      }
    >
      <form id="admin-department-form" className="space-y-3" onSubmit={handleSubmit} noValidate aria-busy={submitting}>
        <div>
          <label htmlFor="department-name" className="mb-1 block text-xs font-medium text-foreground-800">
            부서 이름
          </label>
          <input
            id="department-name"
            className={`field text-sm ${nameError ? "border-rose-300" : ""}`}
            value={name}
            maxLength={MAX_LENGTH}
            disabled={submitting}
            onChange={(event) => {
              setName(event.target.value);
              setNameError("");
              if (submit.phase === "failed") setSubmit({ phase: "idle" });
            }}
            aria-invalid={Boolean(nameError)}
            aria-describedby={nameError ? "department-name-error" : undefined}
          />
          {nameError && (
            <p id="department-name-error" role="alert" className="mt-1 text-xs text-rose-600">
              {nameError}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="department-parent" className="mb-1 block text-xs font-medium text-foreground-800">
            상위 부서
          </label>
          <select
            id="department-parent"
            className="field text-sm"
            value={parentId}
            disabled={submitting}
            onChange={(event) => setParentId(event.target.value)}
            aria-describedby="department-parent-hint"
          >
            <option value={TOP_LEVEL}>{ADMIN_TEXT.topLevel}</option>
            {parentOptions.map(({ department, path }) => (
              <option key={department.id} value={department.id}>
                {path}
              </option>
            ))}
          </select>
          <p id="department-parent-hint" className="mt-1 text-xs text-foreground-500">
            활성 부서만 상위 부서로 고를 수 있습니다{creating ? "" : ". 자기 자신과 하위 부서 밑으로는 옮길 수 없습니다"}.
          </p>
        </div>
        {submit.phase === "failed" && (
          <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700">
            {submit.message}
          </p>
        )}
      </form>
    </Modal>
  );
};

export default DepartmentFormDialog;
