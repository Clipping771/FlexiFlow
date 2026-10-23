# LexiFlow Cloud API

Cloudflare Worker (Hono + D1) that will hold the AI keys, accounts and usage limits for the extension.
Design: [CLOUD_BACKEND_DESIGN.md](../CLOUD_BACKEND_DESIGN.md). Done so far: M2 (skeleton, schema, health, `/v1/me`) M3 (Google sign-in, refresh rotation, logout) M4 (metered Stage A/B AI endpoints) and M5 (shared cache, kill switch, cost report).

## Local development

```bash
npm install                         # also run `npm install` in the repo root: the AI routes import the
                                    # extension's shared prompts, validators and zod from ../src
cp .dev.vars.example .dev.vars      # then set JWT_SECRET and GEMINI_API_KEY
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
| POST | `/v1/ai/stage-a` | Bearer JWT | `{ text, contextSentence?, paragraphContext?, targetLang }` → `{ data, usage, cached }`. 1 credit |
| POST | `/v1/ai/stage-b` | Bearer JWT | `{ lemma, partOfSpeech?, contextualSenseId?, targetLang }` → `{ data, usage, cached }`. 1 credit |

Errors always use `{ error: { code, message } }` with the codes in design §7.
A session is `{ accessToken, refreshToken, expiresIn, user, plan }`; access tokens last one hour.

AI requests run: plan lookup → input limits (`413 INPUT_TOO_LONG`) → per-minute rate limit (`429`, `Retry-After`)
→ shared KV cache → on a miss, the kill switch (`503 AI_PAUSED`) → atomic credit reservation (`402 QUOTA_EXCEEDED`)
→ Gemini, with one retry that feeds validation errors back → commit, or refund and `503 AI_UNAVAILABLE`.
Cache hits are charged like any answer (`cached: true`) but cost no model call, and are served even while paused. Only built-in target languages are accepted. `usage_events` records
counts, tokens and latency, never the text.

## Running costs

- **Cache.** Stage A/B answers are cached in KV for 30 days under keys that include `PROMPT_VERSION`; Stage A keys
  hold only a hash of the reader's sentence. Bump `PROMPT_VERSION` after changing prompt text to retire old entries.
- **Budget.** Every model call adds its estimated cost to `spend_daily` (failed attempts included). When Free-plan
  spend reaches `FREE_DAILY_BUDGET_USD`, new Free lookups pause until Dhaka midnight and `ALERT_WEBHOOK_URL` is
  notified once. Keep `GEMINI_*_USD_PER_MTOK` in `wrangler.toml` in line with the model's current prices.
- **Manual kill switch.** Pause without a deploy, and resume by deleting the key:

  ```bash
  npx wrangler kv key put --remote --binding CACHE control:kill_switch free   # or: all
  npx wrangler kv key delete --remote --binding CACHE control:kill_switch
  ```

- **Cost report.** `npm run report:costs` (local D1) or `npm run report:costs -- --remote --days 30` prints requests,
  cache hit rate, refunds, credits and estimated model cost per endpoint and day. *Cost per charged credit* is the
  number to compare with what a credit earns in each plan before setting prices.

## Google sign-in setup

1. In Google Cloud Console, create an OAuth 2.0 client of type **Web application**.
2. Add `https://<EXTENSION_ID>.chromiumapp.org/` as an authorized redirect URI. Keep the extension ID stable
   with a `key` in `manifest.json`, or the redirect changes on every unpacked install.
3. Put the client id in `GOOGLE_CLIENT_ID` (`wrangler.toml`, `.dev.vars`) and in
   `GOOGLE_OAUTH_CLIENT_ID` (`src/config/cloud.ts` in the extension).

## First deploy

```bash
npx wrangler d1 create lexiflow           # put the printed id in wrangler.toml
npx wrangler kv namespace create CACHE    # put the printed id in wrangler.toml
npx wrangler secret put JWT_SECRET
npx wrangler secret put GEMINI_API_KEY
npm run db:migrate:remote
npm run deploy
```

Set `ALLOWED_ORIGINS` in `wrangler.toml` to `chrome-extension://<EXTENSION_ID>` before deploying.
