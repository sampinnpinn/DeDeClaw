/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DESKTOP_PORT: string;
  readonly VITE_API_BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
