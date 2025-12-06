/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  // add more VITE_… vars here later if you want
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
