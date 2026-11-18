export function positiveServerId(value: string): number | null {
  if (!/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

export function validServerProjectCode(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9-]{1,19}$/.test(value.trim());
}

export function hasServerProjectDraft({
  basic, methodology, departmentType, memberCount, memberId, memberActor, approver,
}: {
  basic: { name: string; code: string; startDate: string; endDate: string; department: string; visibility: string };
  methodology: string | null;
  departmentType: string | null;
  memberCount: number;
  memberId: string;
  memberActor: string;
  approver: number | null;
}): boolean {
  const { name, code, startDate, endDate, department, visibility } = basic;
  return Boolean(name || code || startDate || endDate || department || visibility !== "company" ||
    methodology || departmentType || memberCount > 0 || memberId || memberActor || approver !== null);
}
