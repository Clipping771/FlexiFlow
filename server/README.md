# LexiFlow Cloud API

Cloudflare Worker (Hono + D1) that will hold the AI keys, accounts and usage limits for the extension.
Design: [CLOUD_BACKEND_DESIGN.md](../CLOUD_BACKEND_DESIGN.md). Done so far: M2 (skeleton, schema, health, `/v1/me`) and M3 (Google sign-in, refresh rotation, logout).

## Local development

```bash
npm install
cp .dev.vars.example .dev.vars      # then set JWT_SECRET
npm run db:migrate:local            # applies migrations/ to the local D1
npm run dev                         # http://localhost:8787
```

`npm run ci` runs the typecheck and the unit tests. Tests use an in-memory D1 built on sql.js
(`test/d1.ts`) that applies the same migrations.

## Endpoints

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/v1/health` | – | `200 {status:'ok', db:'ok'}`, or `503` when D1 is unreachable |
| GET | `/v1/me` | Bearer JWT | Profile, effective plan and today's usage (Asia/Dhaka day) |
| POST | `/v1/auth/google` | – | `{ idToken, nonce }` → session. Creates the account on first sign-in; max 5 new accounts per IP per 24 h |
| POST | `/v1/auth/refresh` | – | `{ refreshToken }` → new session. Each refresh token works once; replaying one revokes that device's session |
| POST | `/v1/auth/logout` | – | `{ refreshToken }` → `204`. Idempotent |

Errors always use `{ error: { code, message } }` with the codes in design §7.
A session is `{ accessToken, refreshToken, expiresIn, user, plan }`; access tokens last one hour.

## Google sign-in setup

1. In Google Cloud Console, create an OAuth 2.0 client of type **Web application**.
2. Add `https://<EXTENSION_ID>.chromiumapp.org/` as an authorized redirect URI. Keep the extension ID stable
   with a `key` in `manifest.json`, or the redirect changes on every unpacked install.
3. Put the client id in `GOOGLE_CLIENT_ID` (`wrangler.toml`, `.dev.vars`) and in
   `GOOGLE_OAUTH_CLIENT_ID` (`src/config/cloud.ts` in the extension).

## First deploy

```bash
npx wrangler d1 create lexiflow           # put the printed id in wrangler.toml
npx wrangler secret put JWT_SECRET
npm run db:migrate:remote
npm run deploy
```

Set `ALLOWED_ORIGINS` in `wrangler.toml` to `chrome-extension://<EXTENSION_ID>` before deploying.
