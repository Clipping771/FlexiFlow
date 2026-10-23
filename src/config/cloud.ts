// LexiFlow Cloud endpoints (server/ in this repo). Dev builds (`npm run build:dev`) talk to `wrangler dev`.
export const CLOUD_API_BASE_URL = __LEXIFLOW_DEMO__ ? 'http://localhost:8787' : 'https://api.lexiflow.app';

// Google OAuth "Web application" client id; must match GOOGLE_CLIENT_ID in server/wrangler.toml.
export const GOOGLE_OAUTH_CLIENT_ID = 'REPLACE_WITH_CLIENT_ID.apps.googleusercontent.com';
