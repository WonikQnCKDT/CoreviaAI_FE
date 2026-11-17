/** @type {import('tailwindcss').Config} */

/**
 * 예전 palette 이름(background-*, foreground-*, primary-* …)을 Tailwind class로 쓰기 위한 연결.
 * 기존 화면 코드 호환용이며 새 코드에서는 아래 기능 이름을 쓴다. 값은 legacy-colors.css(삭제 예정)가 정한다.
 */
const legacyScale = (name: string) => ({
  50: `oklch(var(--${name}-50) / <alpha-value>)`,
  100: `oklch(var(--${name}-100) / <alpha-value>)`,
  200: `oklch(var(--${name}-200) / <alpha-value>)`,
  300: `oklch(var(--${name}-300) / <alpha-value>)`,
  400: `oklch(var(--${name}-400) / <alpha-value>)`,
  500: `oklch(var(--${name}-500) / <alpha-value>)`,
  600: `oklch(var(--${name}-600) / <alpha-value>)`,
  700: `oklch(var(--${name}-700) / <alpha-value>)`,
  800: `oklch(var(--${name}-800) / <alpha-value>)`,
  900: `oklch(var(--${name}-900) / <alpha-value>)`,
  950: `oklch(var(--${name}-950) / <alpha-value>)`,
});

/** 상태색 한 벌: text-danger · bg-danger-soft · border-danger-line */
const status = (name: string) => ({
  DEFAULT: `var(--color-${name}-text)`,
  soft: `var(--color-${name}-bg)`,
  line: `var(--color-${name}-border)`,
});

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        /* ===== semantic — 새 코드는 이것만 쓴다 (값: src/styles/tokens/colors.css) ===== */
        // 배경·면: bg-surface, bg-surface-page, bg-surface-subtle …
        surface: {
          DEFAULT: "var(--color-bg-surface)",
          page: "var(--color-bg-page)",
          hover: "var(--color-bg-surface-hover)",
          subtle: "var(--color-bg-subtle)",
          strong: "var(--color-bg-hover-strong)",
          selected: "var(--color-bg-selected)",
        },
        // 글자: text-fg(기본), text-fg-strong … text-fg-placeholder (진한 순)
        fg: {
          DEFAULT: "var(--color-text-primary)",
          strong: "var(--color-text-strong)",
          secondary: "var(--color-text-secondary)",
          muted: "var(--color-text-muted)",
          tertiary: "var(--color-text-tertiary)",
          subtle: "var(--color-text-subtle)",
          placeholder: "var(--color-text-placeholder)",
          "on-action": "var(--color-text-on-action)",
          selected: "var(--color-text-selected)",
          link: "var(--color-text-link)",
        },
        // 테두리: border-line, border-line-subtle, border-line-strong, border-line-focus
        line: {
          DEFAULT: "var(--color-border-default)",
          subtle: "var(--color-border-subtle)",
          strong: "var(--color-border-hover)",
          focus: "var(--color-border-focus)",
        },
        // 주요 동작: bg-action, hover:bg-action-hover, bg-action-soft
        action: {
          DEFAULT: "var(--color-action-primary)",
          hover: "var(--color-action-primary-hover)",
          soft: "var(--color-action-primary-soft)",
        },
        danger: status("danger"),
        warning: status("warning"),
        success: status("success"),
        info: status("info"),

        /* ===== legacy — 기존 화면 호환용. 화면을 semantic으로 옮기면 지운다 ===== */
        background: legacyScale("background"),
        foreground: legacyScale("foreground"),
        primary: legacyScale("primary"),
        accent: legacyScale("accent"),
        secondary: legacyScale("secondary"),
      },
      // 글씨 크기: body(14px)가 기준. 값은 src/styles/tokens/sizes.css
      fontSize: {
        caption: ["var(--font-size-caption)", { lineHeight: "var(--line-height-caption)" }],
        label: ["var(--font-size-label)", { lineHeight: "var(--line-height-label)" }],
        control: ["var(--font-size-control)", { lineHeight: "var(--line-height-control)" }],
        body: ["var(--font-size-body)", { lineHeight: "var(--line-height-body)" }],
        title: ["var(--font-size-title)", { lineHeight: "var(--line-height-title)" }],
        heading: ["var(--font-size-heading)", { lineHeight: "var(--line-height-heading)" }],
      },
      fontFamily: {
        sans: ["var(--font-body)"],
        body: ["var(--font-body)"],
        heading: ["var(--font-heading)"],
        label: ["var(--font-label)"],
      },
      // 값은 src/styles/tokens/sizes.css의 semantic token에서 관리한다
      borderRadius: {
        lg: "var(--radius-surface)",
        xl: "var(--radius-card)",
      },
      boxShadow: {
        card: "var(--elevation-soft)",
        panel: "var(--elevation-panel)",
      },
    },
  },
  plugins: [],
}
