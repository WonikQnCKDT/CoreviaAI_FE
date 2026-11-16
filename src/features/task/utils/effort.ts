/**
 * 공수(작업량) 표기 공통 규칙.
 * 값과 진척률 계산은 그대로 두고, 화면에 보이는 표현만 다듬습니다.
 */

export const EFFORT_TOOLTIP =
  "1인일은 1명이 하루 동안 수행하는 작업량입니다. 여러 명이 나누어 수행하면 달력상 소요기간은 달라질 수 있습니다.";

/** 숫자만 정리합니다. (3.0 → "3", 2.5 → "2.5") */
export function formatEffortValue(value: number | null | undefined): string {
  const safe = Number.isFinite(value as number) ? Number(value) : 0;
  return safe.toFixed(1).replace(/\.0$/, "");
}

/** "3 인일" 처럼 단위를 붙인 표기 */
export function effortUnitText(value: number | null | undefined): string {
  return `${formatEffortValue(value)} 인일`;
}

/** 상세 설명용 표기: "1명 기준 3일 분량" */
export function effortDetailText(value: number | null | undefined): string {
  return `1명 기준 ${formatEffortValue(value)}일 분량`;
}