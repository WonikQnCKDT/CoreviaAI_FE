import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import AutoImport from "unplugin-auto-import/vite";

const base = process.env.BASE_PATH || "/";

/**
 * 화면 모드(VITE_AUTH_MODE)는 빌드할 때 번들에 고정된다. authContext는 "api"가 아니면 모두 demo로 보므로,
 * 오타가 나면 배포본이 조용히 데모 화면이 된다. 빌드할 때 검사한다.
 * - 허용값이 아니면 빌드 실패
 * - 비어 있으면 경고만(로컬·CI 검증 빌드는 값 없이 돌린다). 배포 이미지는 Dockerfile이 api를 넣는다
 */
const AUTH_MODES = ["api", "demo"];
const checkAuthMode = function (value: string | undefined) {
  if (value === undefined || value === "") {
    console.warn("[vite] VITE_AUTH_MODE가 비어 있어 demo 모드로 빌드합니다. 서버에 연결하려면 VITE_AUTH_MODE=api로 빌드하세요.");
    return;
  }
  if (!AUTH_MODES.includes(value)) {
    throw new Error(`VITE_AUTH_MODE는 api 또는 demo여야 합니다(받은 값: "${value}").`);
  }
  if (value === "demo") console.warn("[vite] VITE_AUTH_MODE=demo 로 빌드합니다. 서버에 연결하지 않는 데모 화면입니다.");
};
// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  if (command === "build") checkAuthMode(env.VITE_AUTH_MODE);
  // 개발 서버에서 /api 요청을 백엔드로 넘긴다. 같은 출처가 되어 HttpOnly 인증 쿠키가 그대로 동작한다.
  const apiProxyTarget = env.VITE_API_PROXY_TARGET;
  return {
  define: {
    __BASE_PATH__: JSON.stringify(base),
  },
  plugins: [
    react(),
    AutoImport({
      imports: [
        {
          react: [
            ["default", "React"],
            "useState",
            "useEffect",
            "useContext",
            "useReducer",
            "useCallback",
            "useMemo",
            "useRef",
            "useImperativeHandle",
            "useLayoutEffect",
            "useDebugValue",
            "useDeferredValue",
            "useId",
            "useInsertionEffect",
            "useSyncExternalStore",
            "useTransition",
            "startTransition",
            "lazy",
            "memo",
            "forwardRef",
            "createContext",
            "createElement",
            "cloneElement",
            "isValidElement",
          ],
        },
        {
          "react-router-dom": [
            "useNavigate",
            "useLocation",
            "useParams",
            "useSearchParams",
            "Link",
            "NavLink",
            "Navigate",
            "Outlet",
          ],
        },
      ],
      dts: true,
    }),
  ],
  base,
  build: {
    sourcemap: true,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
    host: "0.0.0.0",
    proxy: apiProxyTarget ? { "/api": { target: apiProxyTarget, changeOrigin: true } } : undefined,
  },
  };
});
