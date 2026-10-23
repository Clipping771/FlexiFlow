# LexiFlow Cloud API

Cloudflare Worker (Hono + D1) that will hold the AI keys, accounts and usage limits for the extension.
Design: [CLOUD_BACKEND_DESIGN.md](../CLOUD_BACKEND_DESIGN.md). Done so far: M2 (skeleton, schema, health, `/v1/me`) M3 (Google sign-in, refresh rotation, logout) M4 (metered Stage A/B AI endpoints) M5 (shared cache, kill switch, cost report), and the remaining AI endpoints.

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
| POST | `/v1/ai/analyze` | Bearer JWT | `{ text, selectionType, contextSentence?, paragraphContext?, targetLang }`. Word/phrase 1 credit (cached), sentence (Sentence X-Ray) 2, paragraph 3 |
| POST | `/v1/ai/compare-words` | Bearer JWT | `{ wordA, wordB, targetLang }` → `{ wordA, wordB }` analyses. 2 credits; each word uses the analyze cache |
| POST | `/v1/ai/evaluate-usage` | Bearer JWT | `{ targetWord, sentence, targetLang }` → Usage Coach verdict and 0-100 collocation score. 2 credits |
| POST | `/v1/ai/assist-writing` | Bearer JWT | `{ text, goal, targetLang }`. 3 credits |
| POST | `/v1/ai/follow-up` | Bearer JWT | `{ text, context?, question, targetLang }`. 1 credit |
| POST | `/v1/ai/highlights` | Bearer JWT | `{ rawText, pageTitle?, targetLang }`. 3 credits; page text is never cached |

Errors always use `{ error: { code, message } }` with the codes in design §7.
A session is `{ accessToken, refreshToken, expiresIn, user, plan }`; access tokens last one hour.

AI requests run: plan lookup → input limits (`413 INPUT_TOO_LONG`) → per-minute rate limit (`429`, `Retry-After`)
→ shared KV cache → on a miss, the kill switch (`503 AI_PAUSED`) → atomic credit reservation (`402 QUOTA_EXCEEDED`)
→ Gemini, with one retry that feeds validation errors back → commit, or refund and `503 AI_UNAVAILABLE`.
Cache hits are charged like any answer (`cached: true`) but cost no model call, and are served even while paused.
The shared zod schemas fill missing fields with defaults, so each endpoint also requires its answer-bearing fields
(and Bengali script for `bn`) in the raw model output; an empty or filler answer is retried once, then refunded.
Article analysis has no endpoint: the extension runs its built-in pipeline for every provider. Only built-in target languages are accepted. `usage_events` records
counts, tokens and latency, never the text.

## Running costs

- **Paid plans are off.** `MONETIZATION_ENABLED = "false"` in every `wrangler.toml` section keeps upgrade links out
  of responses, and `MONETIZATION_ENABLED = false` in `src/config/features.ts` hides the PRO badge, Free/Pro labels,
  credit wording and upgrade prompts in the extension. Turn both on together once payments exist. Daily limits,
  rate limits and the budget kill switch stay on regardless: they protect AI costs, and users see them as a plain
  daily limit.

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
2. Add `https://<EXTENSION_ID>.chromiumapp.org/` as an authorized redirect URI for **every** extension ID that
   signs in (your unpacked dev build, the staging build, the Web Store build). Keep each ID stable with a `key`
   in `manifest.json`, or the redirect changes on every unpacked install.
3. Put the client id in `GOOGLE_CLIENT_ID` in each `wrangler.toml` section (and `.dev.vars`), and in
   `GOOGLE_OAUTH_CLIENT_ID` in `src/config/cloud.ts` for the matching environment.
4. Publish the OAuth consent screen with the privacy policy URL (see [WEB_STORE_DISCLOSURE.md](../WEB_STORE_DISCLOSURE.md)).

## Environments

| | Development | Staging | Production |
|---|---|---|---|
| Worker | `wrangler dev` (never deployed) | `lexiflow-api-staging` | `lexiflow-api` |
| URL | `http://localhost:8787` | `https://api-staging.lexiflow.app` | `https://api.lexiflow.app` |
| D1 / KV | local only | `lexiflow-staging` / own namespace | `lexiflow-production` / own namespace |
| Extension build | `npm run build:dev` | `npm run build:staging` ("LexiFlow (Staging)") | `npm run build` (Web Store) |
| Free daily budget | $5 | $1 | $5 |

Each environment has its own database, cache, secrets and Google redirect URI, so testing on staging never
touches production data. Every section of `wrangler.toml` lists its own vars and bindings (Wrangler does not
inherit them). `npm run check:config` dry-runs both deployed environments and fails on a broken config.

### One-time setup (per environment, shown for staging; repeat with `production`)

```bash
npx wrangler d1 create lexiflow-staging                 # put the id in [[env.staging.d1_databases]]
npx wrangler kv namespace create CACHE --env staging    # put the id in [[env.staging.kv_namespaces]]
npx wrangler secret put JWT_SECRET --env staging        # a new random value per environment
npx wrangler secret put GEMINI_API_KEY --env staging
npx wrangler secret put ALERT_WEBHOOK_URL --env staging # optional
```

Also set `ALLOWED_ORIGINS` and `GOOGLE_CLIENT_ID` in that environment's vars, and add the custom domain's zone
(`lexiflow.app`) to the Cloudflare account so the `routes` entry can attach.

### Releasing

```bash
npm run db:migrate:staging        # apply new migrations first; they must work with the running code
npm run deploy:staging            # runs the tests, then deploys
# test with the staging extension build, then:
npm run db:migrate:production
npm run deploy:production
```

The daily retention job (`[triggers]`, 02:30 Asia/Dhaka) runs in staging and production. Roll back with
`npx wrangler rollback --env production`; D1 migrations do not roll back, so keep them additive.
