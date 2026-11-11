# LexiFlow AI — Architecture Decision Records (DECISIONS.md)

**Product:** One Learning System, Two Exam Engines (PTE Academic + IELTS Academic)  
**Status:** Living Document  
**Maintained by:** Founder + Antigravity Agents  

---

## ADR Index
- [ADR-001: Core Tech Stack, Hosting & Runtime Platform](#adr-001-core-tech-stack-hosting--runtime-platform)
- [ADR-002: AI Provider Strategy, Schema Validation & Cost Logging](#adr-002-ai-provider-strategy-schema-validation--cost-logging)
- [ADR-003: Database Architecture & Staged Entity Evolution](#adr-003-database-architecture--staged-entity-evolution)
- [ADR-004: Audio Pipeline, Mobile Recording & 90-Day Retention](#adr-004-audio-pipeline-mobile-recording--90-day-retention)
- [ADR-005: Isolation of PTE and IELTS Exam Engines](#adr-005-isolation-of-pte-and-ielts-exam-engines)
- [ADR-006: Estimation Transparency & Calibration Governance](#adr-006-estimation-transparency--calibration-governance)
- [ADR-007: Speech-to-Text & Pronunciation Assessment Pipeline Selection](#adr-007-speech-to-text--pronunciation-assessment-pipeline-selection)

---

## ADR-001: Core Tech Stack, Hosting & Runtime Platform
- **Date:** 2026-11-01
- **Status:** Accepted
- **Context:**
  LexiFlow AI is transitioning from a standalone Chrome Extension to a mobile-responsive full-stack platform serving learners across South Asia (Bangladesh, India) and international test-takers. The system must operate with zero idle costs, low latency on mobile networks, and rapid developer iteration for 1 human founder + Antigravity agents.

- **Options Considered:**
  1. *Next.js + Vercel + Supabase (Postgres)*: Convenient, but Supabase free tier pauses after inactivity, higher ongoing egress/compute costs, and Next.js server runtime has cold starts.
  2. *Node.js/Express + VPS (DigitalOcean/AWS)*: High maintenance overhead, manual scaling, fixed monthly server costs even with zero traffic.
  3. *Cloudflare Workers + Hono + D1 (SQLite Edge DB) + R2 (Storage) + Vite React SPA (Accepted)*:
     - Edge deployment in 300+ cities globally; ultra-low latency in South Asia.
     - D1 provides ACID SQLite at edge with generous free tier and zero cold-start delay.
     - Single TypeScript ecosystem sharing schemas between frontend, backend, and AI workers.
     - Leverages existing work in `server/`.

- **Decision:**
  - **Frontend:** React 19 + TypeScript + Vite. Mobile-first responsive UI.
  - **Backend API:** Cloudflare Workers using Hono framework (REST JSON API).
  - **Database:** Cloudflare D1 (Serverless SQLite) with SQL migrations.
  - **Cache & Rate Limiting:** Cloudflare KV + D1 atomic windows.
  - **Asset & Audio Storage:** Cloudflare R2 (S3-compatible object storage).
  - **Hosting:** Cloudflare Pages for Web SPA; Cloudflare Workers for API (`api.lexiflow.app`).

- **Consequences:**
  - Strict adherence to edge runtime standards (Web standard APIs: `fetch`, `Request`, `Response`, `crypto`).
  - No heavy Node.js-only native C++ bindings in the backend worker.

---

## ADR-002: AI Provider Strategy, Schema Validation & Cost Logging
- **Date:** 2026-11-01
- **Status:** Accepted
- **Context:**
  AI evaluation powers writing scoring, speech assessment, and grammatical error analysis. Scoring quality, hallucination prevention, reproducibility, and financial runway are primary risks.

- **Options Considered:**
  1. *Direct client-to-LLM calls (BYOK only)*: High friction for non-technical learners; leaks prompts and proprietary rubrics.
  2. *Single vendor lock-in (e.g., OpenAI only)*: Vulnerable to price changes, rate limits, and outages.
  3. *Centralized Edge AI Gateway with Multi-Provider Abstraction (Accepted)*:
     - Backend proxy stores provider API keys securely in Cloudflare environment secrets.
     - Supported live providers: Google Gemini 2.5 Flash / Pro, Anthropic Claude 3.5 Sonnet, OpenAI GPT-4o / GPT-4o-mini, and local Ollama for development.
     - Offline deterministic `MockProvider` for CI, unit testing, and zero-cost local iteration.

- **Decision:**
  - Every AI response must pass through strict **Zod runtime schema validation** (`safeJson.ts`). If validation fails, retry with lower temperature or return `UNCERTAIN`.
  - Every AI invocation must record a `UsageRecord` row capturing: `userId`, `taskId`, `provider`, `model`, `promptTokens`, `completionTokens`, `estimatedCostUSD`, `promptVersion`, `rubricVersion`, and `taxonomyVersion`.
  - Monthly hard spending cap configured on provider dashboards.
  - Deterministic checks (word count, time limits, spelling, regex pattern checks) MUST execute in code before invoking any LLM.

- **Consequences:**
  - Zero unvalidated AI text displayed to users.
  - Complete audit trail for reproducing evaluations.

---

## ADR-003: Database Architecture & Staged Entity Evolution
- **Date:** 2026-11-01
- **Status:** Accepted
- **Context:**
  A monorepo or monolithic schema created all at once risks over-engineering entities before their actual phase requirements are proven.

- **Decision:**
  Implement a staged database schema migration strategy in `server/migrations/`:
  - **Phase 0 (Foundation):**
    - `User`: Core authentication and identity.
    - `LearnerProfile`: Educational background, target exam, target score, exam date, mother tongue.
    - `ExamProfile`: Settings specific to selected test (PTE Academic vs IELTS Academic).
    - `ErrorTaxonomy`: Canonical error codes (`ERR.xxx`), category, definition, severity.
    - `ErrorOccurrence`: Concrete instances of errors extracted from learner submissions.
    - `MistakeMemory`: Mastery state machine (`New` $\rightarrow$ `Practising` $\rightarrow$ `Improving` $\rightarrow$ `Mastered` $\rightarrow$ `Reopened`).
    - `ReviewSchedule`: FSRS interval scheduling (1, 3, 7, 21 days).
    - `UsageRecord`: Token usage, provider costs, audit metadata.
  - **Phase 1 (Writing):**
    - `Question`, `Response`, `Evaluation`, `ContentAsset`.
  - **Phase 2 (Speaking):**
    - `recording`, `transcript`, `timestamp`, `pronunciation`.
  - **Phase 3 (Reading & Listening):**
    - `answer_keys`, `scoring_records`.
  - **Phase 4 (Validation & Monetization):**
    - `subscription`, `billing`.

- **Consequences:**
  - No premature table creation.
  - Every migration is backward-compatible and tested via automated migration tests.

---

## ADR-004: Audio Pipeline, Mobile Recording & 90-Day Retention
- **Date:** 2026-11-01
- **Status:** Accepted
- **Context:**
  Speaking assessments (PTE Read Aloud, Repeat Sentence, IELTS Speaking Parts 1-3) require audio capture from smartphones and lower-end Android devices on unstable 4G networks. Audio storage has privacy and cost implications.

- **Decision:**
  - Use HTML5 `MediaRecorder` API with lightweight audio formats (`audio/webm;codecs=opus` with fallback to `audio/mp4`).
  - Mobile audio chunks stream directly to Cloudflare R2 via pre-signed upload URLs generated by Worker API.
  - **Data Retention & Privacy Rule:** All user audio recordings in R2 have an automated 90-day expiration lifecycle policy, after which they are permanently deleted.
  - Users can explicitly request immediate deletion of their recordings at any time.

- **Consequences:**
  - GDPR/privacy compliant by design.
  - Prevents runaway cloud storage costs.

---

## ADR-005: Isolation of PTE and IELTS Exam Engines
- **Date:** 2026-11-01
- **Status:** Accepted
- **Context:**
  PTE Academic and IELTS Academic have fundamentally different task structures, scoring mechanisms (PTE 10-90 scale vs IELTS 0-9 bands), timing rules, and traits. Intermingling them in shared code causes high bug rates and regressions.

- **Decision:**
  - The core learning system (Mistake Memory, Error Taxonomy, FSRS Review, User Profile, Audio Subsystem) is 100% shared.
  - The exam engines are strictly isolated:
    - `exams/pte/`: PTE tasks, timing rules, scoring adapters, and rubric configs.
    - `exams/ielts/`: IELTS tasks, timing rules, scoring adapters, and rubric configs.
  - **CI Enforced Rule:** A PR touching `exams/pte/` is rejected by CI if it touches `exams/ielts/`, and vice versa.

- **Consequences:**
  - Complete modular independence.
  - Adding future exams (e.g., TOEFL, PTE Core) requires only adding a new isolated adapter folder without modifying existing exam engines.

---

## ADR-006: Estimation Transparency & Calibration Governance
- **Date:** 2026-11-01
- **Status:** Accepted
- **Context:**
  AI scores can vary or diverge from human raters. Misleading learners regarding their official exam readiness creates legal liability and destroys trust.

- **Decision:**
  - Every score output MUST feature the prominent label: **"LexiFlow estimate"** (never displayed as an official PTE/IELTS score).
  - Scores must always present a range (e.g., "Band 6.5 – 7.0" or "62 – 68") along with confidence level, concrete evidence, and specific error codes.
  - Human calibration protocol: Double-rater calibration on an independent holdout set. If two raters disagree beyond 0.5 band, a third expert rater resolves it.
  - If a task model does not achieve $\ge 80\%$ agreement within $\pm 0.5$ band during calibration, numerical band scores are suppressed and only qualitative performance levels (e.g., *Developing*, *Competent*, *Proficient*) are displayed.

- **Consequences:**
  - Protects brand integrity and legal standing.
  - Sets realistic expectations for learners.

---

## ADR-007: Speech-to-Text & Pronunciation Assessment Pipeline Selection
- **Date:** 2026-11-01
- **Status:** Accepted
- **Context:**
  Speaking evaluation for PTE Academic and IELTS Academic requires transcribing speech, detecting word timestamps for oral fluency, and assessing phoneme-level pronunciation and prosody across non-native English accents (South Asian L1s: Bengali, Hindi, etc.) on low-cost microphones and mobile browsers.

- **Options Considered:**
  1. *OpenAI Whisper API alone*: High transcription accuracy, but lacks phonemic alignment and stress detection; relatively high latency and cost ($0.006/min) for short 3-second repetitive drills.
  2. *Single Proprietary Speech Grader (e.g. Speechace / ELSA)*: Excellent phoneme grading, but high per-seat licensing fees, vendor lock-in, and restrictive data retention limits.
  3. *Hybrid Multi-Tier Speech Engine (Accepted)*:
     - **Tier 1 (Client-side Web Audio):** Deterministic silence detection, low-amplitude rejection, audio duration check, and MIME negotiation (`audio/webm` or `audio/mp4`). Rejects silent/corrupted recordings with zero server cost.
     - **Tier 2 (Word-level Timestamped STT):** Transcribes audio with millisecond word timestamps to calculate Words Per Minute (WPM), hesitation pause durations (>3s fatal pause in PTE), and speech rate.
     - **Tier 3 (Acoustic & Phonemic Assessment):** Evaluates pronunciation clarity, vowel duration, and word stress. Maps errors directly into `taxonomy/errors.yaml` codes (`PTE.PRON_PHONEME`, `PTE.FLUENCY_PAUSE`, `IELTS.FLUENCY_HESITATION`, `IELTS.PRON_INACCURATE`).
     - **Data Lifecycle:** Audio assets stored in Cloudflare R2 with strict 90-day retention metadata and automatic lifecycle expiration.

- **Consequences:**
  - Robust against noisy environments and poor mobile microphones.
  - Fast turnaround for learners with detailed phoneme-level feedback.
  - Full compliance with 90-day privacy retention rules.
