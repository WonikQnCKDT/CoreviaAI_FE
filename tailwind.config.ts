/** @type {import('tailwindcss').Config} */
const role = (name: string) => ({
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

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: role("background"),
        foreground: role("foreground"),
        primary: role("primary"),
        accent: role("accent"),
        secondary: role("secondary"),
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