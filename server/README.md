# LexiFlow Cloud API

Cloudflare Worker (Hono + D1) that will hold the AI keys, accounts and usage limits for the extension.
Design: [CLOUD_BACKEND_DESIGN.md](../CLOUD_BACKEND_DESIGN.md). This is milestone M2: skeleton, schema, `/v1/health`, `/v1/me`.

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

Errors always use `{ error: { code, message } }` with the codes in design §7.
Tokens are only issued from M3 (`/v1/auth/google`); until then, test `/v1/me` with a token signed
by `signAccessToken` in `src/lib/tokens.ts`.

## First deploy

```bash
npx wrangler d1 create lexiflow           # put the printed id in wrangler.toml
npx wrangler secret put JWT_SECRET
npm run db:migrate:remote
npm run deploy
```

Set `ALLOWED_ORIGINS` in `wrangler.toml` to `chrome-extension://<EXTENSION_ID>` before deploying.
