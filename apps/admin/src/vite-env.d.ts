/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ADMIN_API_BASE_URL: string;
  readonly VITE_ADMIN_WS_URL: string;
  readonly VITE_ADMIN_ROUTE_BASE: string;
  readonly VITE_ADMIN_LOGIN_USERNAME: string;
  readonly VITE_ADMIN_LOGIN_PASSWORD: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
