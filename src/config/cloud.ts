// LexiFlow Cloud endpoints (server/ in this repo), chosen at build time by scripts/build.mjs:
//   npm run build:dev       development  → `wrangler dev` on localhost
//   npm run build:staging   staging      → server/wrangler.toml [env.staging]
//   npm run build           production   → server/wrangler.toml [env.production]
// Written as conditionals on the build-time constant so each bundle only contains its own environment.
export type CloudEnvironment = 'development' | 'staging' | 'production';

export const CLOUD_ENVIRONMENT: CloudEnvironment = __LEXIFLOW_CLOUD_ENV__;

export const CLOUD_API_BASE_URL =
  __LEXIFLOW_CLOUD_ENV__ === 'production'
    ? 'https://api.lexiflow.app'
    : __LEXIFLOW_CLOUD_ENV__ === 'staging'
      ? 'https://api-staging.lexiflow.app'
      : 'http://localhost:8787';

// Google OAuth "Web application" client id; must match GOOGLE_CLIENT_ID in that environment's wrangler.toml section.
export const GOOGLE_OAUTH_CLIENT_ID =
  __LEXIFLOW_CLOUD_ENV__ === 'production'
    ? 'REPLACE_WITH_CLIENT_ID.apps.googleusercontent.com'
    : __LEXIFLOW_CLOUD_ENV__ === 'staging'
      ? 'REPLACE_WITH_CLIENT_ID.apps.googleusercontent.com'
      : 'REPLACE_WITH_CLIENT_ID.apps.googleusercontent.com';
