/// <reference types="vite/client" />

/** True in dev/test builds: enables the offline mock fallback when no extension runtime exists. */
declare const __LEXIFLOW_DEMO__: boolean;

/** Which LexiFlow Cloud the build talks to (scripts/build.mjs --cloud=…); see src/config/cloud.ts. */
declare const __LEXIFLOW_CLOUD_ENV__: 'development' | 'staging' | 'production';

declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}
