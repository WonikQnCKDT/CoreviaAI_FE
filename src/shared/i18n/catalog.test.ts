import { describe, expect, it } from "vitest";
import { labelConflicts, registeredLabels, type LabelDefinition } from "@/shared/i18n/defineLabels";

/**
 * 모든 라벨 정의를 모아 검사하고, BE 등록용 목록 문서(docs/i18n/label-keys.md)가 코드와 같은지 확인한다.
 * 규칙: defineLabels·defineLabelMap은 src/**\/i18n/ 아래 파일에서만 부른다.
 * 문서 갱신: UPDATE_LABEL_DOC=1 npm test
 */
import.meta.glob(["/src/**/i18n/**/*.ts", "!/src/**/*.test.ts"], { eager: true });

/** BE 라벨 키 규칙 (I18nLabel.LABEL_KEY_PATTERN, 100자 이하) */
const LABEL_KEY_PATTERN = /^(?=.{1,100}$)[A-Za-z][A-Za-z0-9_-]*(\.[A-Za-z0-9_-]+)*$/;
const MAX_TEXT_LENGTH = 500;
// eslint-disable-next-line no-control-regex -- BE TEXT_PATTERN(제어 문자 금지)과 같은 검사
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/;

/** BE V9 마이그레이션이 이미 시드한 키 (공통 코드 라벨) */
const SEEDED_PREFIXES = ["code.", "codeGroup."];

/**
 * 앱 tsconfig에는 Node 타입(@types/node)이 없다. 의존성을 늘리지 않으려고 이 테스트에서 필요한 부분만 선언하고
 * 모듈 이름을 변수로 넘겨 동적으로 불러온다(Vitest는 Node에서 돈다).
 */
interface NodeFs {
  readFileSync: (path: string, encoding: "utf8") => string;
  writeFileSync: (path: string, data: string, encoding: "utf8") => void;
}
const nodeProcess = (globalThis as unknown as { process: { cwd: () => string; env: Record<string, string | undefined> } }).process;
const FS_MODULE = "node:fs";
const loadFs = () => import(/* @vite-ignore */ FS_MODULE) as Promise<NodeFs>;
const DOC_PATH = `${nodeProcess.cwd()}/docs/i18n/label-keys.md`;

/** 표 칸 안에서 Markdown으로 해석되는 글자(|, *)를 글자 그대로 보이게 한다. */
const escapeCell = (text: string) => text.replace(/([|*])/g, "\\$1");

const renderDoc = function (labels: LabelDefinition[]) {
  const seeded = labels.filter(({ key }) => SEEDED_PREFIXES.some((prefix) => key.startsWith(prefix)));
  const toRegister = labels.filter((label) => !seeded.includes(label));
  const rows = (items: LabelDefinition[]) =>
    items.map(({ key, ko, group }) => `| \`${key}\` | ${escapeCell(ko)} | ${escapeCell(group)} |`).join("\n");
  return [
    "# FE 다국어 라벨 키 목록",
    "",
    "> 자동 생성 문서입니다. 직접 고치지 말고 FE에서 `UPDATE_LABEL_DOC=1 npm test`로 다시 만드세요.",
    "> 원본: `src/**/i18n/` 의 `defineLabels`·`defineLabelMap` 정의 (Confluence 02-4. 다국어 라벨, FR-ADM-06)",
    "",
    "## 사용 방법 (BE 담당자)",
    "",
    "- 아래 **등록 필요** 표의 키를 `i18n_labels`에 시드하거나 관리 화면(시스템 관리 › 다국어 라벨)에서 등록합니다.",
    "- `text_ko`는 표의 한국어 기본 문구를 그대로 쓰면 화면이 지금과 같게 보입니다. `text_en`·`text_zh_tw`는 번역이 준비되면 채웁니다(비우면 한국어로 표시).",
    "- 등록하지 않은 키도 FE는 한국어 기본 문구로 표시하므로 화면이 깨지지 않습니다.",
    "- `{name}`처럼 중괄호로 감싼 부분은 FE가 값을 넣는 자리입니다. 번역문에도 같은 이름으로 남겨 주세요.",
    "",
    `## 등록 필요 (${toRegister.length}개)`,
    "",
    "| 라벨 키 | 한국어 기본 문구 | 구분 |",
    "| --- | --- | --- |",
    rows(toRegister),
    "",
    `## BE에 이미 시드됨 (${seeded.length}개, V9 공통 코드 라벨)`,
    "",
    "FE가 공통 코드와 같은 값을 표시할 때 이 키를 그대로 씁니다. 등록할 필요가 없습니다.",
    "",
    "| 라벨 키 | 한국어 기본 문구 | 구분 |",
    "| --- | --- | --- |",
    rows(seeded),
    "",
  ].join("\n");
};

describe("다국어 라벨 카탈로그", () => {
  const labels = registeredLabels();

  it("라벨이 정의되어 있다", () => {
    expect(labels.length).toBeGreaterThan(0);
  });

  it("같은 키에 다른 한국어 문구를 정의하지 않는다", () => {
    expect(labelConflicts()).toEqual([]);
  });

  it("모든 키가 BE 라벨 키 형식(영문자 시작, 점 구분, 100자 이하)을 따른다", () => {
    expect(labels.filter(({ key }) => !LABEL_KEY_PATTERN.test(key)).map(({ key }) => key)).toEqual([]);
  });

  it("모든 한국어 기본 문구가 비어 있지 않고 500자 이하이며 제어 문자가 없다", () => {
    const invalid = labels.filter(
      ({ ko }) => !ko.trim() || ko.length > MAX_TEXT_LENGTH || CONTROL_CHARACTER.test(ko),
    );
    expect(invalid.map(({ key }) => key)).toEqual([]);
  });

  it("BE 등록용 목록 문서가 코드와 같다 (다르면 UPDATE_LABEL_DOC=1 npm test)", async () => {
    const { readFileSync, writeFileSync } = await loadFs();
    const expected = renderDoc(labels);
    if (nodeProcess.env.UPDATE_LABEL_DOC === "1") writeFileSync(DOC_PATH, expected, "utf8");
    const actual = readFileSync(DOC_PATH, "utf8").replace(/\r\n/g, "\n");
    expect(actual).toBe(expected);
  });
});
