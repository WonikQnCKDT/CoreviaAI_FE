import { translate } from "@/shared/i18n/store";

/**
 * 화면 문구의 라벨 키와 한국어 기본값을 정의한다 (FR-ADM-06: 화면 코드에는 라벨 키만 쓴다).
 *
 * 규칙: defineLabels·defineLabelMap은 `src/**\/i18n/` 아래 파일에서만 부른다.
 * 그래야 catalog 테스트가 모든 키를 모아 형식·중복을 검사하고 BE 등록용 목록(docs/i18n/label-keys.md)을 만든다.
 *
 * 돌려준 객체는 읽을 때마다 현재 언어의 문구를 준다(없으면 한국어). 그래서 모듈 상단에서 값을
 * 미리 꺼내 두면 안 된다. 배열에 담을 때는 getter(`get label() { ... }`)로 읽게 한다.
 */

export interface LabelDefinition {
  key: string;
  ko: string;
  /** 정의한 파일의 그룹 설명 (목록 문서용) */
  group: string;
}

const registry = new Map<string, LabelDefinition>();
const conflicts: { key: string; first: string; second: string }[] = [];

const register = function (definition: LabelDefinition) {
  const existing = registry.get(definition.key);
  if (existing && existing.ko !== definition.ko) {
    conflicts.push({ key: definition.key, first: existing.ko, second: definition.ko });
    return;
  }
  if (!existing) registry.set(definition.key, definition);
};

export const registeredLabels = function (): LabelDefinition[] {
  return [...registry.values()].sort((a, b) => a.key.localeCompare(b.key));
};

export const labelConflicts = function () {
  return [...conflicts];
};

const proxyOf = function <T extends Record<string, string>>(defaults: T, keyOf: (name: string) => string): T {
  return new Proxy(defaults, {
    get(target, property, receiver) {
      if (typeof property !== "string" || !Object.hasOwn(target, property)) return Reflect.get(target, property, receiver);
      return translate(keyOf(property), target[property]);
    },
  });
};

/** `${prefix}.${이름}` 키로 한 묶음을 정의한다. 예: defineLabels("button", { save: "저장" }) → button.save */
export const defineLabels = function <T extends Record<string, string>>(prefix: string, defaults: T, group = prefix): T {
  Object.entries(defaults).forEach(([name, ko]) => register({ key: `${prefix}.${name}`, ko, group }));
  return proxyOf(defaults, (name) => `${prefix}.${name}`);
};

/**
 * 항목마다 키를 직접 정한다. 공통 코드처럼 서버가 정한 키(code.TASK_STATUS.TODO 등)를 그대로 쓸 때 쓴다.
 * 예: defineLabelMap("상태", { todo: ["code.TASK_STATUS.TODO", "대기"] })
 */
export const defineLabelMap = function <K extends string>(group: string, entries: Record<K, readonly [key: string, ko: string]>) {
  const defaults = {} as Record<K, string>;
  const keys = {} as Record<K, string>;
  (Object.entries(entries) as [K, readonly [string, string]][]).forEach(([name, [key, ko]]) => {
    defaults[name] = ko;
    keys[name] = key;
    register({ key, ko, group });
  });
  return proxyOf(defaults, (name) => keys[name as K]);
};
