# Pull Request: [LF-011] IELTS Academic Speaking Engine (Part 1, Part 2, Part 3)

**Branch:** `feat/lf-011-ielts-speaking-engine`  
**Base:** `feature/lexiflow-2.0`  
**Session Role:** Builder Session  
**Phase:** Phase 2 — Speaking Engine  
**Ticket:** [LF-011](file:///c:/Innovation/Lexiflow/tickets/LF-011_ielts_speaking_engine.md)  

---

## 1. Description & Rationale
This PR implements the official **IELTS Academic Speaking Engine** covering the three interview parts:
1. **Part 1 (Introduction & Interview):** Familiar questions with 15–45s conversational responses.
2. **Part 2 (Individual Long Turn / Cue Card):** 1-minute prep, 2-minute sustained speaking on a cue card with bullet points.
3. **Part 3 (Two-Way Discussion):** In-depth abstract questions with sustained analytical responses.

Evaluated against the 4 official IELTS criteria:
- Fluency & Coherence (FC)
- Lexical Resource (LR)
- Grammatical Range and Accuracy (GRA)
- Pronunciation (PR)
Overall band score calculated using the official IELTS rounding rule to the nearest 0.5 band.

Strict adherence to:
- **AGENTS.md Rule 3 (Strict Exam Engine Isolation):** Code resides entirely in `exams/ielts/` with zero imports or references to `exams/pte/`.
- **AGENTS.md Rule 8 ("LexiFlow estimate" Labeling):** All band scores prominently bear `scoreLabel: "LexiFlow estimate"`.
- **AGENTS.md Rule 9 (Deterministic First Rule):** Trivial audio (< 3s) short-circuits deterministically to Band 1.0 without LLM cost; Part 2 under-time (< 60s) penalty and WPM speech rate ceilings are applied deterministically.
- **AGENTS.md Rule 2 (Zod Validation on AI Outputs):** Evaluator validates criteria scores and feedback markdown against `IeltsSpeakingAiZodSchema`.

---

## 2. Changes Made
- **Deterministic Rules (`exams/ielts/speaking/deterministicRules.ts`):**
  - Audio duration validator and Part 2 under-time penalty evaluator.
  - WPM speech rate calculator and fluency band ceiling evaluator.
- **Official IELTS Speaking Rubrics (`exams/ielts/speaking/rubrics.ts`):**
  - Implements the official British Council / IDP IELTS band rounding algorithm to nearest 0.5 band.
- **IELTS Speaking Evaluator (`exams/ielts/speaking/evaluator.ts`):**
  - Evaluators for Part 1, Part 2 (Cue Card), and Part 3.
  - Attaches mandatory "LexiFlow estimate" disclosure and error codes (`IELTS.AUDIO_TOO_SHORT`, `IELTS.PART2_UNDER_TIME`, `IELTS.FLUENCY_HESITATION`).
- **Unit Tests (`exams/ielts/speaking/__tests__/ieltsSpeaking.test.ts`):**
  - 5 automated tests covering duration checks, WPM calculations, IELTS band rounding, and AI evaluation with Zod validation.

---

## 3. Verification & Proof of Quality
- `npm run check:isolation`: Passed (0 cross-engine references, 0 secrets).
- `npm run typecheck`: Passed (0 errors).
- `npx vitest run exams/ielts/speaking/__tests__/ieltsSpeaking.test.ts`: 5 tests passed.
