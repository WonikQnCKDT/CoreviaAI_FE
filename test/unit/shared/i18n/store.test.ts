import { afterEach, describe, expect, it } from "vitest";
import {
  applyLabels,
  currentLanguage,
  formatLabel,
  isCurrentBundle,
  resetLabels,
  sanitizeLabels,
  translate,
} from "@/shared/i18n/store";
import { normalizeLanguage } from "@/shared/i18n/language";
import { defineLabelMap, defineLabels, labelConflicts } from "@/shared/i18n/defineLabels";
import { STAGES, TASK_STATUS_LABEL } from "@/utils/ui";

afterEach(() => resetLabels());

describe("translate", () => {
  it("묶음에 키가 없으면 한국어 기본 문구를 쓴다 (API 미연결·라벨 미등록)", () => {
    expect(translate("button.save", "저장")).toBe("저장");
  });

  it("묶음에 있으면 그 문구를 쓴다", () => {
    applyLabels({ language: "en", labels: { "button.save": "Save" } });
    expect(translate("button.save", "저장")).toBe("Save");
    expect(currentLanguage()).toBe("en");
  });

  it("빈 문구는 누락으로 보고 기본 문구를 쓴다", () => {
    applyLabels({ language: "en", labels: { "button.save": "" } });
    expect(translate("button.save", "저장")).toBe("저장");
  });

  it("프로토타입 키(constructor·__proto__)가 함수나 객체를 돌려주지 않는다", () => {
    applyLabels({ language: "en", labels: {} });
    expect(translate("constructor", "기본")).toBe("기본");
    expect(translate("__proto__", "기본")).toBe("기본");
    expect(translate("toString", "기본")).toBe("기본");
  });
});

describe("sanitizeLabels", () => {
  it("문자열 값만 남긴다", () => {
    const labels = sanitizeLabels({ a: "A", b: 1, c: null, d: { x: 1 }, e: ["x"], f: "" });
    expect({ ...labels }).toEqual({ a: "A", f: "" });
  });

  it.each([null, undefined, "text", 3, ["a"]])("객체가 아니면(%j) 빈 묶음이다", (raw) => {
    expect(Object.keys(sanitizeLabels(raw))).toEqual([]);
  });

  it("결과에 프로토타입이 없어 'constructor' 키 조회가 안전하다", () => {
    expect(Object.getPrototypeOf(sanitizeLabels({}))).toBeNull();
  });
});

describe("isCurrentBundle", () => {
  it("언어와 문구가 모두 같아야 같은 묶음이다", () => {
    applyLabels({ language: "en", labels: { a: "A" } });
    expect(isCurrentBundle({ language: "en", labels: { a: "A" } })).toBe(true);
    expect(isCurrentBundle({ language: "ko", labels: { a: "A" } })).toBe(false);
    expect(isCurrentBundle({ language: "en", labels: { a: "B" } })).toBe(false);
  });

  it("새 묶음에서 빠진 키가 있어도 다른 묶음으로 본다", () => {
    applyLabels({ language: "en", labels: { a: "A", b: "B" } });
    expect(isCurrentBundle({ language: "en", labels: { a: "A" } })).toBe(false);
  });
});

describe("formatLabel", () => {
  it("이름 자리에 값을 넣는다", () => {
    expect(formatLabel("{name} 계정을 {status} 상태로 바꿨습니다.", { name: "홍길동", status: "비활성" })).toBe(
      "홍길동 계정을 비활성 상태로 바꿨습니다.",
    );
  });

  it("값을 주지 않은 자리는 그대로 남긴다", () => {
    expect(formatLabel("{count}건 · {missing}", { count: 0 })).toBe("0건 · {missing}");
  });

  it("값은 글자 그대로 넣고 HTML이나 다른 자리 표시로 해석하지 않는다", () => {
    expect(formatLabel("{name}", { name: "<img src=x onerror=alert(1)> {count}" })).toBe("<img src=x onerror=alert(1)> {count}");
  });
});

describe("normalizeLanguage", () => {
  it.each([
    ["ko", "ko"],
    ["EN", "en"],
    ["zh-TW", "zh-TW"],
    ["zh_tw", "zh-TW"],
    ["zh-Hant", "zh-TW"],
    ["zh-HK", "zh-TW"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeLanguage(input)).toBe(expected);
  });

  it.each(["ja", "zh", "zh-CN", "", "../en", "en;q=1", null, undefined, 1])("지원하지 않는 값(%j)은 null", (input) => {
    expect(normalizeLanguage(input)).toBeNull();
  });
});

describe("defineLabels", () => {
  it("읽을 때마다 현재 언어의 문구를 주고, 없으면 기본 문구를 준다", () => {
    const TEXT = defineLabels("test.sample", { hello: "안녕", bye: "잘 가" });
    expect(TEXT.hello).toBe("안녕");
    applyLabels({ language: "en", labels: { "test.sample.hello": "Hello" } });
    expect(TEXT.hello).toBe("Hello");
    expect(TEXT.bye).toBe("잘 가");
  });

  it("Object.keys·entries가 원래 키로 동작하고, 정의하지 않은 속성은 undefined다", () => {
    const TEXT: Record<string, string> = defineLabels("test.keys", { a: "가", b: "나" });
    expect(Object.keys(TEXT)).toEqual(["a", "b"]);
    expect(TEXT.missing).toBeUndefined();
  });

  it("같은 키에 다른 기본 문구를 정의하면 충돌로 기록한다", () => {
    defineLabels("test.conflict", { a: "하나" });
    defineLabels("test.conflict", { a: "둘" });
    expect(labelConflicts()).toContainEqual({ key: "test.conflict.a", first: "하나", second: "둘" });
  });

  it("defineLabelMap은 항목마다 정한 키를 쓴다 (서버 공통 코드 키)", () => {
    const MAP = defineLabelMap("테스트", { todo: ["test.code.TODO", "대기"] });
    applyLabels({ language: "en", labels: { "test.code.TODO": "To do" } });
    expect(MAP.todo).toBe("To do");
  });

  it("업무 상태는 BE 시드 키(code.TASK_STATUS.*)를 쓴다", () => {
    applyLabels({ language: "en", labels: { "code.TASK_STATUS.IN_PROGRESS": "In progress" } });
    expect(TASK_STATUS_LABEL.progress).toBe("In progress");
  });

  it("배열에 담은 문구(getter)도 언어를 바꾸면 새 문구가 된다", () => {
    expect(STAGES[0].label).toBe("분석");
    applyLabels({ language: "en", labels: { "status.stage.analysis": "Analysis" } });
    expect(STAGES[0].label).toBe("Analysis");
  });

  it("부분 번역 묶음(en·zh-TW)에서는 번역된 키만 바뀌고 누락·빈 문자열 키는 한국어 기본값으로 폴백된다", () => {
    const SAMPLE = defineLabels("test.fallback", {
      title: "제목",
      empty: "비어 있음",
      missing: "누락된 문구",
    });
    applyLabels({
      language: "zh-TW",
      labels: {
        "test.fallback.title": "標題",
        "test.fallback.empty": "",
      },
    });
    expect(SAMPLE.title).toBe("標題");
    expect(SAMPLE.empty).toBe("비어 있음");
    expect(SAMPLE.missing).toBe("누락된 문구");
  });
});
