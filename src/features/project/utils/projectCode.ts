/**
 * 프로젝트 식별 코드 발급 규칙.
 * 기존 코드 규칙(PRT-연도-일련번호)을 그대로 따르며,
 * 이미 발급된 코드는 건드리지 않고 사용 중이지 않은 다음 번호만 찾습니다.
 */

export const PROJECT_CODE_PREFIX = "PRT";

export const PROJECT_CODE_RULE_HINT = "PRT-연도-일련번호 형식으로 시스템이 자동 발급합니다.";

/**
 * @param existingCodes 이미 사용 중인 프로젝트 코드 목록
 * @param year 발급 연도 (예: 2026)
 */
export function generateProjectCode(existingCodes: string[], year: number): string {
  const prefix = `${PROJECT_CODE_PREFIX}-${year}-`;
  const used = new Set(existingCodes.map((code) => code.trim().toUpperCase()));

  let maxSequence = 0;
  used.forEach((code) => {
    if (!code.startsWith(prefix)) return;
    const sequence = Number(code.slice(prefix.length));
    if (Number.isFinite(sequence) && sequence > maxSequence) maxSequence = sequence;
  });

  let next = maxSequence + 1;
  let candidate = `${prefix}${String(next).padStart(3, "0")}`;
  while (used.has(candidate)) {
    next += 1;
    candidate = `${prefix}${String(next).padStart(3, "0")}`;
  }
  return candidate;
}

/** 오늘 날짜(연-월-일) 문자열에서 발급 연도를 구합니다. */
export function issueYear(today: string): number {
  const year = Number(today.slice(0, 4));
  return Number.isFinite(year) && year > 2000 ? year : new Date().getFullYear();
}