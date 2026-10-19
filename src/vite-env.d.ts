/// <reference types="vite/client" />

/** True in dev/test builds: enables the offline mock fallback when no extension runtime exists. */
declare const __LEXIFLOW_DEMO__: boolean;

declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}
