/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Base URL for the JSON data bundles. Set in `.env`; see the commentary there.
   * Declared here so a typo in `data.ts` is a compile error rather than a 404 at runtime.
   */
  readonly VITE_DATA_BASE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
