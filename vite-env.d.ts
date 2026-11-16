/// <reference types="vite/client" />

declare const __BASE_PATH__: string;

interface ImportMetaEnv {
  /** 인증 방식. "api"면 실제 인증 서버, 그 외는 데모 로그인 */
  readonly VITE_AUTH_MODE?: string;
  /** 백엔드 API 기본 주소. 기본값 "/api" */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
