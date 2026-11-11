# Pull Request: [LF-010] PTE Academic Speaking Engine (RA, RS, DI, RL, ASQ)

**Branch:** `feat/lf-010-pte-speaking-engine`  
**Base:** `feature/lexiflow-2.0`  
**Session Role:** Builder Session  
**Phase:** Phase 2 — Speaking Engine  
**Ticket:** [LF-010](file:///c:/Innovation/Lexiflow/tickets/LF-010_pte_speaking_engine.md)  

---

## 1. Description & Rationale
This PR implements the official **PTE Academic Speaking Engine** covering the scored PTE speaking task types:
1. **Read Aloud (RA):** Content (0–5), Pronunciation (0–5), Oral Fluency (0–5), mapped to 10–90 Pearson scale.
2. **Repeat Sentence (RS):** Content (0–3: 100%, $\ge 50\%$, $< 50\%$), Pronunciation (0–5), Oral Fluency (0–5).
3. **Describe Image (DI) & Re-tell Lecture (RL):** Content (0–5), Pronunciation (0–5), Oral Fluency (0–5).
4. **Answer Short Question (ASQ):** Vocabulary / Content (0–1), binary fast grading.
5. **Personal Introduction:** Unscored baseline recording.

Strict adherence to:
- **AGENTS.md Rule 3 (Strict Exam Engine Isolation):** Code resides entirely in `exams/pte/` and has zero references or imports to `exams/ielts/`.
- **AGENTS.md Rule 8 ("LexiFlow estimate" Labeling):** All score outputs prominently bear `scoreLabel: "LexiFlow estimate"`.
- **AGENTS.md Rule 9 (Deterministic First Rule):** Audio duration < 1.2s and initial silence $\ge 3$s (Pearson 3s microphone auto-stop) trigger immediate deterministic 10 score without LLM tokens. Word alignment for RA & RS is calculated deterministically before AI evaluation.
- **AGENTS.md Rule 2 (Zod Validation on AI Outputs):** Evaluator validates AI outputs against `PteSpeakingAiZodSchema`.

---

## 2. Changes Made
- **Deterministic Rules (`exams/pte/speaking/deterministicRules.ts`):**
  - Audio duration and silence timeout validator.
  - Token-level word alignment engine detecting matches, omissions, and insertions.
  - Content score calculation for Read Aloud (0–5) and Repeat Sentence (0–3).
- **Pearson Rubrics Mapping (`exams/pte/speaking/rubrics.ts`):**
  - Official Pearson score calculation mapping trait totals to 10–90 scale with fatal zero handling.
- **PTE Speaking Evaluator (`exams/pte/speaking/evaluator.ts`):**
  - Evaluators for Read Aloud, Repeat Sentence, and Answer Short Question.
  - Attaches mandatory "LexiFlow estimate" disclosure and error codes (`PTE.AUDIO_TOO_SHORT`, `PTE.RA_OMISSION`, `PTE.RS_LOW_RECALL`, `PTE.ASQ_INCORRECT`).
- **Unit Tests (`exams/pte/speaking/__tests__/pteSpeaking.test.ts`):**
  - 8 automated tests covering silence rejection, word alignment, Pearson scale mapping, and AI evaluations.

---

## 3. Verification & Proof of Quality
- `npm run check:isolation`: Passed (0 cross-engine references, 0 secrets).
- `npm run typecheck`: Passed (0 errors).
- `npx vitest run exams/pte/speaking/__tests__/pteSpeaking.test.ts`: 8 tests passed.
