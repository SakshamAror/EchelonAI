/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USE_DEMO?: string;
  readonly VITE_BYPASS_DEMO_PROGRESS?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
