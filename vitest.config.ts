import { resolve } from "node:path";
import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config.ts";

/**
 * Vitest 테스트 설정 (CoreviaAI_BE와 동일하게 unit / integration 분리)
 * - unit        : test/unit/**        (node 환경, 순수 도메인 규칙·유틸·API 계약)
 * - integration : test/integration/** (jsdom 환경, 화면·컴포넌트·라우터·스토어·fetch 통합)
 * - support     : test/support/**     (공통 하네스·픽스처, `@test/support/*`로 import)
 */
export default defineConfig((env) =>
  mergeConfig(
    viteConfig(env),
    defineConfig({
      resolve: {
        alias: {
          "@": resolve(import.meta.dirname, "./src"),
          "@test": resolve(import.meta.dirname, "./test"),
        },
      },
      test: {
        coverage: {
          provider: "v8",
          reporter: ["text", "json-summary", "json", "lcov", "html"],
          reportsDirectory: "./coverage",
          include: ["src/**/*.{ts,tsx}"],
          exclude: ["src/mocks/**", "src/**/*.d.ts", "src/main.tsx"],
          thresholds: {
            statements: 55,
            branches: 50,
            functions: 48,
            lines: 55,
          },
        },
        projects: [
          {
            extends: true,
            test: {
              name: "unit",
              include: ["test/unit/**/*.test.{ts,tsx}"],
              environment: "node",
            },
          },
          {
            extends: true,
            test: {
              name: "integration",
              include: ["test/integration/**/*.test.{ts,tsx}"],
              environment: "jsdom",
            },
          },
        ],
      },
    }),
  ),
);
