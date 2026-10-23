# LexiFlow Cloud — Backend Proxy, লগইন ও Usage Limit ডিজাইন

Status: Draft (2026-10-23) · Scope: Phase 1 (ব্যবসা চালুর জন্য ন্যূনতম backend)

---

## ১. লক্ষ্য

1. ইউজারকে আর নিজের API key দিতে হবে না। লগইন করলেই AI কাজ করবে।
2. AI key শুধু সার্ভারে থাকবে, extension-এ কখনো না।
3. প্রতিটা ইউজারের দৈনিক ব্যবহার সার্ভারে গোনা হবে, আর Free/Pro প্ল্যান অনুযায়ী লিমিট বসবে।
4. AI খরচ নিয়ন্ত্রণে থাকবে: cache, input-এর দৈর্ঘ্য সীমা, rate limit আর global kill switch দিয়ে।
5. বর্তমান BYOK (নিজের key) আর Ollama মোড "Advanced" অপশন হিসেবে থেকে যাবে।

**এই ধাপের বাইরে:** পেমেন্ট ইন্টিগ্রেশন, cloud sync আর শিক্ষক ড্যাশবোর্ড। তবে ডেটা মডেলে `plan` ও `plan_expires_at` রাখা হয়েছে, যাতে পরে পেমেন্ট সহজে যুক্ত করা যায়।

---

## ২. সামগ্রিক আর্কিটেকচার

```
┌────────────── Chrome Extension ──────────────┐
│ content script / popup / dashboard           │
│        │ chrome.runtime.sendMessage          │
│        ▼                                     │
│ background (service worker)                  │
│   AIService.getProvider()                    │
│     ├─ 'lexiflow' → CloudProvider ───────────┼──► HTTPS (Bearer JWT)
│     ├─ 'gemini'/'openai'/'anthropic' (BYOK)  │
│     ├─ 'ollama'                              │
│     └─ 'mock' (offline)                      │
│   AuthService (token store, refresh)         │
└──────────────────────────────────────────────┘
                                                      │
┌──────────── Cloudflare Worker: api.lexiflow.app ────▼─────────┐
│ 1. CORS: শুধু chrome-extension://<EXTENSION_ID>               │
│ 2. Auth: JWT যাচাই → userId, plan                            │
│ 3. Validate: Zod দিয়ে input, দৈর্ঘ্যের সীমা                   │
│ 4. Rate limit: প্রতি ইউজার প্রতি মিনিটে (D1, ১ মিনিটের window)  │
│ 5. Quota reserve: D1-তে atomic UPDATE                         │
│ 6. Shared cache lookup (KV) ──hit──► সরাসরি উত্তর             │
│ 7. Prompt build (shared prompts module) → Gemini API          │
│ 8. Zod দিয়ে output যাচাই → cache-এ রাখা → উত্তর                │
│ 9. ব্যর্থ হলে quota refund                                    │
└───────────────────────────────────────────────────────────────┘
        D1 (users, refresh_tokens, usage_daily)   KV (response cache)
```

### প্ল্যাটফর্ম: Cloudflare Workers + D1 + KV (প্রস্তাবিত)

| বিষয় | Cloudflare Workers | Supabase (বিকল্প) |
|---|---|---|
| শুরুর খরচ | ফ্রি টিয়ারে অনেকদূর যাওয়া যায় | ফ্রি টিয়ার আছে, তবে নিষ্ক্রিয় প্রজেক্ট pause হয়ে যায় |
| Latency (বাংলাদেশ) | Edge, কাছের PoP থেকে চলে | একটা নির্দিষ্ট region থেকে চলে |
| Auth | নিজে বানাতে হবে (এই ডকে ডিজাইন করা আছে) | বিল্ট-ইন Auth পাওয়া যায় |
| ভাষা | TypeScript, এই প্রজেক্টের Zod schema সরাসরি ব্যবহার করা যায় | TypeScript (Deno) |

Workers বেছে নেওয়ার কারণ: খরচ কম, latency কম, আর `src/services/ai/schemas.ts` ও prompt কোড একই TypeScript-এ শেয়ার করা যায়। যদি নিজে auth বানাতে না চান, তাহলে Supabase Auth আর Edge Functions দিয়েও একই ডিজাইন চলবে। শুধু অনুচ্ছেদ ৪ বদলাবে।

---

## ৩. মূল ডিজাইন সিদ্ধান্ত

### ৩.১ সার্ভার "task API" দেবে, কোনো সাধারণ LLM proxy নয়

Extension কখনো raw prompt পাঠাবে না। এটা পাঠাবে `{ text, contextSentence }`-এর মতো কাঠামোবদ্ধ ডেটা, আর prompt বানাবে সার্ভার। কারণগুলো:

- কেউ আপনার endpoint চুরি করে ফ্রি ChatGPT হিসেবে ব্যবহার করতে পারবে না।
- Prompt বদলালে বা উন্নত করলে নতুন extension রিলিজ লাগবে না।
- প্রতিটা কাজের খরচ জানা থাকে, তাই credit হিসাব করা সহজ।

### ৩.২ Prompt কোড শেয়ার হবে

এখন prompt-গুলো প্রতিটা provider-এর ভেতরে আলাদা করে লেখা (যেমন `geminiProvider.ts`-এর `analyzeStageA`-তে `systemPrompt`)। এগুলো একটা আলাদা মডিউলে সরিয়ে নিতে হবে:

```
src/services/ai/prompts/
  stageA.ts       buildStageAPrompt(text, ctx, paragraph, lang) → { system, user, maxTokens }
  stageB.ts
  sentence.ts
  ...
  version.ts      export const PROMPT_VERSION = 'v1'
```

BYOK provider আর সার্ভার, দুজনেই এই মডিউল import করবে। এতে দুই জায়গায় একই মানের উত্তর আসবে।

### ৩.৩ Quota শেষ হলে mock দিয়ে চুপচাপ উত্তর দেওয়া যাবে না

এখন key না থাকলে `getProvider()` নিঃশব্দে `MockAIProvider`-এ চলে যায়। Cloud মোডে quota শেষ হলে এমন করা যাবে না, কারণ ইউজার ভুয়া উত্তরকে আসল ভাববে (`e308e5a` commit-এ dummy placeholder সরানোর কাজটাও এই কারণেই করা হয়েছিল)। এর বদলে popup-এ পরিষ্কার একটা "আজকের লিমিট শেষ" কার্ড দেখাতে হবে, সাথে আপগ্রেড বাটন আর রিসেটের সময়। Free Dictionary API-এর সাধারণ সংজ্ঞা তখনও দেখানো যাবে, কারণ সেটা আসল ডেটা।

---

## ৪. লগইন (Authentication)

### ৪.১ পদ্ধতি: Google Sign-In, `chrome.identity.launchWebAuthFlow` দিয়ে

`getAuthToken`-এর বদলে `launchWebAuthFlow` বেছে নেওয়ার কারণ: এটা Edge, Brave আর Chrome-এ সাইন-ইন না করা প্রোফাইলেও কাজ করে।

```
১. ইউজার "Google দিয়ে লগইন" বাটনে চাপ দেয় (dashboard বা popup)
২. background একটা nonce বানায়, তারপর:
   launchWebAuthFlow({ url: https://accounts.google.com/o/oauth2/v2/auth
       ?client_id=<WEB_CLIENT_ID>
       &response_type=id_token
       &redirect_uri=https://<EXTENSION_ID>.chromiumapp.org/
       &scope=openid email profile
       &nonce=<nonce>, interactive: true })
৩. redirect URL-এর fragment থেকে id_token বের করা হয়
৪. POST /v1/auth/google { idToken, nonce }
৫. সার্ভার যা যাচাই করে:
   - Google JWKS দিয়ে signature
   - aud == WEB_CLIENT_ID, iss == accounts.google.com, exp, nonce
   - email_verified == true
   তারপর google_sub দিয়ে user খোঁজে, না পেলে নতুন user বানায়
৬. সার্ভারের উত্তর: { accessToken (JWT, ১ ঘণ্টা), refreshToken (opaque, ৩০ দিন), user }
```

### ৪.২ Token কোথায় থাকবে

| Token | কোথায় | কেন |
|---|---|---|
| accessToken | `chrome.storage.session` | ব্রাউজার বন্ধ করলে মুছে যায়, আর content script থেকে পড়া যায় না |
| refreshToken | `chrome.storage.local` | পরের বার আবার লগইন করতে হবে না |

- Token শুধু background-এ থাকবে। content script বা popup কখনো token দেখবে না, তারা background-কে message পাঠাবে।
- সার্ভারে refreshToken-এর শুধু SHA-256 hash রাখা হবে।
- **Refresh rotation:** প্রতিবার refresh করলে পুরোনো token বাতিল হবে আর নতুন token দেওয়া হবে। কেউ পুরোনো token দিয়ে আবার চেষ্টা করলে বোঝা যাবে token চুরি হয়েছে, তখন ওই user-এর সব session বাতিল হবে।
- accessToken-এর মেয়াদ ৫ মিনিটের কম বাকি থাকলে, বা 401 এলে, AuthService নিজে থেকেই একবার refresh করে request আবার পাঠাবে।

### ৪.৩ Access JWT-এর claim

```json
{ "sub": "usr_8f3a…", "plan": "free", "planExp": null, "iat": …, "exp": … }
```

এখানে `plan` আছে শুধু UI দ্রুত দেখানোর জন্য। Quota যাচাইয়ের সময় সার্ভার সবসময় D1 থেকে আসল plan পড়বে, যাতে আপগ্রেড বা মেয়াদ শেষ সঙ্গে সঙ্গে কার্যকর হয়।

---

## ৫. Usage Limit (Quota)

### ৫.১ Credit পদ্ধতি

সব কাজের AI খরচ সমান না, তাই প্রতিটা কাজের একটা credit ওজন থাকবে:

| Endpoint | কাজ | Credit |
|---|---|---|
| `stage-a` | শব্দের দ্রুত অর্থ (popup-এর প্রথম অংশ) | 1 |
| `stage-b` | বিস্তারিত vocabulary | 1 |
| `analyze` | phrase বা সাধারণ বিশ্লেষণ | 1 |
| `follow-up` | AI chat-এ প্রশ্ন | 1 |
| `explain-sentence` | Sentence X-Ray | 2 |
| `compare-words` | Word Difference | 2 |
| `evaluate-usage` | Usage Coach | 2 |
| `assist-writing` | লেখায় সাহায্য | 3 |
| `highlights` | পেজ হাইলাইট | 3 |
| `article` | আর্টিকেল বিশ্লেষণ, প্রতি chunk (১২০০ শব্দ) | 5 |

### ৫.২ প্ল্যানের লিমিট (শুরুর প্রস্তাব, পরে আসল খরচ দেখে ঠিক করবেন)

| প্ল্যান | দৈনিক credit | প্রতি মিনিটে request | Input সীমা | Article |
|---|---|---|---|---|
| `free` | 30 | 10 | বাক্য ৬০০ অক্ষর | মাসে ৩টা |
| `pro` | 600 (fair use) | 30 | বাক্য ২০০০ অক্ষর | আনলিমিটেড (দৈনিক credit-এর ভেতরে) |

- **দিন হিসাব হবে Asia/Dhaka (UTC+6) সময়ে।** রিসেট হবে রাত ১২টায়, আর ইউজারকে "রাত ১২টায় রিসেট" দেখানো হবে।
- লিমিটগুলো কোডে hardcode না করে `plans` কনফিগে (Worker env বা D1 টেবিল) রাখুন, যাতে deploy ছাড়াই বদলানো যায়।
- **Rate limit বাস্তবায়ন (M4):** Durable Object বা KV-র বদলে D1-এর `rate_limits` টেবিলে প্রতি ইউজারের ১ মিনিটের fixed window গোনা হয় (একটা atomic UPSERT)। Quota-র জন্য D1-এ এমনিতেই লিখতে হয়, তাই নতুন কোনো সার্ভিস লাগেনি। ট্রাফিক অনেক বাড়লে Durable Object-এ সরানো যাবে।

### ৫.৩ Reserve → Commit/Refund (race condition এড়াতে)

একসাথে অনেক request এলেও লিমিট যেন পার না হয়, তাই একটা atomic SQL ব্যবহার হবে:

```sql
-- reserve
INSERT INTO usage_daily (user_id, day, credits_used) VALUES (?1, ?2, 0)
  ON CONFLICT DO NOTHING;
UPDATE usage_daily
   SET credits_used = credits_used + ?3
 WHERE user_id = ?1 AND day = ?2 AND credits_used + ?3 <= ?4;
-- changes() == 0  →  402 QUOTA_EXCEEDED
```

- AI call ব্যর্থ হলে (provider error, timeout, schema validation fail) `credits_used - ?3` করে refund দেওয়া হবে। ইউজার ব্যর্থ উত্তরের জন্য টাকা দেবে না।
- **Cache hit:** কাজটা একই, তাই credit কাটা হবে, তবে AI খরচ শূন্য। এতে নিয়ম সহজ থাকে, আর লাভ বাড়ে।
- লোকাল cache (`TwoStageCacheService` / `CacheManager`) আগের মতো চলবে। লোকাল hit হলে সার্ভারে request-ই যাবে না, তাই credit-ও কাটবে না।

### ৫.৪ খরচের নিরাপত্তা

- **Global kill switch:** KV-তে `daily_spend_estimate` রাখা হবে (প্রতিটা response-এর token usage থেকে)। সীমা পার হলে free ইউজারদের AI সাময়িক বন্ধ হবে, pro চলবে, আর আপনার কাছে alert যাবে।
- **Per-IP signup limit:** একই IP থেকে দিনে ৫টার বেশি নতুন অ্যাকাউন্ট খোলা যাবে না। এতে ফ্রি credit-এর জন্য বারবার অ্যাকাউন্ট খোলা কঠিন হবে।
- Output-এর `maxTokens` প্রতিটা endpoint-এ নির্দিষ্ট থাকবে (এখনকার prompt-এর মতোই, যেমন stageA 550)।

---

## ৬. Shared Response Cache

| Endpoint | Cache key | শেয়ার করা যাবে? |
|---|---|---|
| `stage-b` | `sb:{PROMPT_VERSION}:{lang}:{lemma}:{pos}` | হ্যাঁ। শব্দ-ভিত্তিক, ব্যক্তিগত কিছু নেই। **সবচেয়ে বেশি সাশ্রয় এখানে।** |
| `stage-a` | `sa:{v}:{lang}:{text}:{hash(contextSentence)}` | হ্যাঁ, শুধু hash রাখা হবে, বাক্য না |
| `compare-words` | `cw:{v}:{lang}:{sorted(a,b)}` | হ্যাঁ |
| `explain-sentence`, `article`, `follow-up`, `evaluate-usage`, `assist-writing` | — | না। এগুলোতে ইউজারের ব্যক্তিগত লেখা থাকতে পারে |

- KV-তে TTL ৩০ দিন। `PROMPT_VERSION` বদলালে পুরোনো cache নিজে থেকেই অকেজো হয়ে যাবে।
- "ভুল অর্থ রিপোর্ট" (`REPORT_WRONG_MEANING`) এলে ওই key-টা cache থেকে মুছে দেওয়ার endpoint থাকবে (Phase 1.5)।

---

## ৭. API স্পেসিফিকেশন

Base URL: `https://api.lexiflow.app/v1`

### Auth
| Method | Path | Body | উত্তর |
|---|---|---|---|
| POST | `/auth/google` | `{ idToken, nonce }` | `{ accessToken, refreshToken, user }` |
| POST | `/auth/refresh` | `{ refreshToken }` | `{ accessToken, refreshToken }` |
| POST | `/auth/logout` | `{ refreshToken }` | `204` |
| GET | `/me` | — | `{ user, plan, planExpiresAt, usage: { used, limit, resetAt } }` |
| DELETE | `/me` | — | অ্যাকাউন্ট ও সব ডেটা মুছে ফেলা (Web Store আর privacy-র জন্য দরকার) |

### AI (সবগুলোতে `Authorization: Bearer <accessToken>` লাগবে)
| Path | Body (এখনকার background message-এর payload-এর মতো) | উত্তরের type |
|---|---|---|
| `/ai/stage-a` | `{ text, contextSentence?, paragraphContext?, targetLang }` | `StageAExplanation` |
| `/ai/stage-b` | `{ lemma, partOfSpeech?, contextualSenseId?, targetLang }` | `StageBDetailedVocabulary` |
| `/ai/analyze` | `{ text, selectionType, contextSentence?, paragraphContext?, targetLang }` | `LinguisticAnalysisResult` |
| `/ai/explain-sentence` | … | … |
| `/ai/compare-words` | … | … |
| `/ai/evaluate-usage` | … | … |
| `/ai/assist-writing` | `{ text, goal, targetLang }` | `WritingAssistResult` |
| `/ai/follow-up` | `{ text, context, question, targetLang }` | `FollowUpResponse` |
| `/ai/highlights` | `{ rawText, pageTitle?, targetLang }` | `HighlightExtractionResult` |
| `/ai/article` | `{ rawText, title?, mode?, targetLang }` | `ArticleAnalysisResult` |

সফল উত্তরের রূপ:
```json
{ "data": { … }, "usage": { "used": 12, "limit": 30, "resetAt": "2026-10-24T00:00:00+06:00" }, "cached": true }
```

### Error code
| HTTP | `error.code` | Extension কী করবে |
|---|---|---|
| 401 | `AUTH_EXPIRED` | একবার refresh করে আবার চেষ্টা করবে, তাতেও না হলে লগইন কার্ড দেখাবে |
| 401 | `AUTH_REQUIRED` | লগইন কার্ড দেখাবে |
| 402 | `QUOTA_EXCEEDED` | "আজকের লিমিট শেষ" কার্ড দেখাবে, সাথে `resetAt` আর `upgradeUrl` |
| 403 | `PLAN_REQUIRED` | Pro-only ফিচারে তালা আর আপগ্রেড বাটন দেখাবে |
| 413 | `INPUT_TOO_LONG` | ছোট করে নির্বাচন করতে বলবে, `maxChars` দেখাবে |
| 429 | `RATE_LIMITED` | `Retry-After` অনুযায়ী অপেক্ষা করে আবার চেষ্টা করবে |
| 503 | `AI_UNAVAILABLE` | "কিছুক্ষণ পর চেষ্টা করুন" দেখাবে, credit refund হয়ে যাবে |
| 400 | `INVALID_REQUEST` | Body ভুল বা অসম্পূর্ণ। এটা extension-এর bug, ইউজারের কিছু করার নেই |
| 503 | `SERVICE_UNAVAILABLE` | Google-এর key আনা যায়নি বা সার্ভার সাময়িক বন্ধ। "কিছুক্ষণ পর চেষ্টা করুন" দেখাবে, লগইন অবস্থা মুছবে না |

---

## ৮. ডেটা মডেল (D1 / SQLite)

```sql
CREATE TABLE users (
  id               TEXT PRIMARY KEY,          -- 'usr_' + random
  google_sub       TEXT UNIQUE NOT NULL,
  email            TEXT NOT NULL,
  name             TEXT,
  plan             TEXT NOT NULL DEFAULT 'free',   -- 'free' | 'pro'
  plan_expires_at  TEXT,                          -- ISO, NULL = মেয়াদ নেই
  created_at       TEXT NOT NULL,
  signup_ip_hash   TEXT
);

CREATE TABLE refresh_tokens (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   TEXT UNIQUE NOT NULL,
  family_id    TEXT NOT NULL,          -- rotation-এর সময় চুরি ধরার জন্য
  expires_at   TEXT NOT NULL,
  revoked_at   TEXT
);

CREATE TABLE usage_daily (
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day           TEXT NOT NULL,         -- 'YYYY-MM-DD' (Asia/Dhaka)
  credits_used  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);

CREATE TABLE usage_events (            -- অ্যানালিটিক্স; ইউজারের লেখা এখানে রাখা হবে না
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT NOT NULL,
  endpoint    TEXT NOT NULL,
  credits     INTEGER NOT NULL,
  cached      INTEGER NOT NULL,
  tokens_in   INTEGER, tokens_out INTEGER,
  latency_ms  INTEGER,
  status      TEXT NOT NULL,           -- 'ok' | 'refunded' | 'rejected'
  created_at  TEXT NOT NULL
);
```

`usage_events` থেকে জানা যাবে কোন ফিচার বেশি ব্যবহার হয় আর একজন ইউজারের গড় খরচ কত। দাম ঠিক করতে এই তথ্যটাই লাগবে।

---

## ৯. Extension-এ যা যা বদলাতে হবে

| ফাইল | পরিবর্তন |
|---|---|
| `src/types/index.ts` | `UserSettings.aiProvider`-এ `'lexiflow'` যোগ হবে। নতুন ইনস্টলে এটাই default |
| `src/services/auth/authService.ts` (নতুন) | `login()`, `logout()`, `getAccessToken()` (auto-refresh), `getAccount()` |
| `src/services/ai/cloudProvider.ts` (নতুন) | `AIProvider` implement করবে। প্রতিটা method-এর জন্য একটা `fetch`, আর error হলে টাইপড `CloudError` |
| `src/services/ai/prompts/*` (নতুন) | Provider-গুলো থেকে prompt এখানে সরানো হবে (৩.২) |
| `src/services/ai/index.ts` | `getProvider()`-এ `case 'lexiflow'` যোগ হবে। Cloud মোডে quota বা auth error হলে mock-এ যাবে না (৩.৩) |
| `src/background/index.ts` | নতুন message: `AUTH_LOGIN`, `AUTH_LOGOUT`, `GET_ACCOUNT`। AI error-এর `code` UI পর্যন্ত পৌঁছাবে |
| `src/content/popupView.ts` | লিমিট-শেষ কার্ড, লগইন কার্ড, আর ছোট একটা quota meter ("আজ ১২/৩০") |
| `src/dashboard/` | Settings-এ "অ্যাকাউন্ট" সেকশন থাকবে (লগইন, প্ল্যান, ব্যবহার)। BYOK যাবে "Advanced"-এর নিচে |
| `manifest.json` | `"identity"` permission, `host_permissions`-এ `https://api.lexiflow.app/*`, আর extension ID স্থির রাখতে `"key"` |
| `PRIVACY.md` | কী সার্ভারে যায় (নির্বাচিত লেখা, context বাক্য), কী রাখা হয় (শুধু hash আর গণনা), কত দিন রাখা হয় |

---

## ১০. নিরাপত্তা চেকলিস্ট

- [ ] AI key আর JWT secret শুধু `wrangler secret`-এ থাকবে, repo-তে কখনো না
- [ ] CORS-এ `Origin` == `chrome-extension://<EXTENSION_ID>` ছাড়া সব reject হবে (এটা পুরো নিরাপত্তা না, শুধু প্রথম বাধা। আসল সুরক্ষা আসে auth আর quota থেকে)
- [ ] সব input Zod দিয়ে যাচাই হবে, দৈর্ঘ্যের সীমা সার্ভারে প্রয়োগ হবে
- [ ] AI output-ও Zod দিয়ে যাচাই হবে (বর্তমান `validation.ts` আবার ব্যবহার করা যাবে)। যাচাই ব্যর্থ হলে refund
- [ ] Log-এ ইউজারের লেখা থাকবে না, শুধু endpoint, দৈর্ঘ্য আর latency
- [ ] Refresh token rotation আর চুরি ধরা (৪.২)
- [ ] অ্যাকাউন্ট মোছার endpoint (`DELETE /me`)

---

## ১১. বাস্তবায়নের ধাপ

| Milestone | কাজ | শেষ হয়েছে বোঝার উপায় |
|---|---|---|
| **M1: Prompt আলাদা করা** | `prompts/` মডিউল বানানো, Gemini provider সেটা ব্যবহার করবে | বর্তমান সব টেস্ট পাস করে, BYOK আগের মতো চলে |
| **M2: Worker skeleton** | `server/` ফোল্ডার, Hono router, D1 migration, `/me`, health check | `wrangler dev`-এ চলে |
| **M3: Auth** | `/auth/google`, `/auth/refresh`, `/auth/logout`, extension-এ AuthService ও লগইন UI | Extension থেকে লগইন করে `/me` দেখা যায় |
| **M4: AI endpoint + quota** | `stage-a` আর `stage-b` প্রথমে, তারপর বাকিগুলো। reserve/refund, rate limit | ৩০ credit শেষ হলে 402 আসে, popup-এ সঠিক কার্ড দেখায় |
| **M5: Cache + খরচ সুরক্ষা** | KV cache, kill switch, `usage_events` | একই শব্দ দ্বিতীয়বার খুঁজলে `cached: true` আসে |
| **M6: প্রকাশের প্রস্তুতি** | PRIVACY.md, Web Store disclosure, staging ও prod environment | Staging-এ পুরো flow চলে |

### টেস্ট পরিকল্পনা
- **Worker unit test:** quota reserve-এর race (একসাথে ১০টা request, লিমিট ৩), refund, JWT মেয়াদ শেষ, refresh token reuse ধরা।
- **Extension test:** `cloudProvider` প্রতিটা error code-কে সঠিক UI state-এ রূপান্তর করে কিনা। 402 এলে mock-এ যায় না, এটা নিশ্চিত করা।
- **ম্যানুয়াল:** Chrome আর Edge-এ লগইন, ব্রাউজার বন্ধ করে খোলার পর নিজে থেকে refresh।

---

## ১২. যে সিদ্ধান্তগুলো আপনাকে নিতে হবে

1. **প্ল্যাটফর্ম:** Cloudflare Workers (প্রস্তাবিত) নাকি Supabase?
2. **লগইন:** শুধু Google, নাকি email OTP-ও লাগবে? যাদের Google অ্যাকাউন্ট নেই, তাদের জন্য পরে email OTP যোগ করা যায়।
3. **লগইন ছাড়া ট্রায়াল:** লগইন ছাড়াই প্রথম ১০টা lookup ফ্রি দেবেন কি? এতে প্রথম অভিজ্ঞতা ভালো হয়, কিন্তু অপব্যবহার ঠেকানো কঠিন হয়ে যায়।
4. **Domain নাম:** `api.lexiflow.app` এখানে উদাহরণ হিসেবে ধরা হয়েছে।
5. **সার্ভারের AI model:** Gemini Flash জাতীয় সস্তা model প্রস্তাবিত। দাম ঠিক করার আগে M5-এর `usage_events` থেকে প্রতি credit-এর আসল খরচ মেপে নিন।
