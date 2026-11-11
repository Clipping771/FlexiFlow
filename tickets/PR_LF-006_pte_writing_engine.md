# Pull Request: [LF-006] PTE Academic Writing Engine (WE & SWT)

**Branch:** `feat/lf-006-pte-writing-engine`  
**Base:** `feature/lexiflow-2.0`  
**Session Role:** Builder Session  
**Phase:** Phase 1 — Writing Engine  
**Ticket:** [LF-006](file:///c:/Innovation/Lexiflow/tickets/LF-006_pte_writing_engine.md)  

---

## 1. Description & Rationale
This PR implements the official **PTE Academic Writing Engine** for the two scored PTE writing tasks:
1. **Write Essay (WE):** 200–300 words, strict 20 minutes countdown, 7 Pearson scoring traits (Content, Form, Grammar, Vocabulary, Spelling, Linguistic Range, Coherence), mapped to 10–90 Pearson scale.
2. **Summarize Written Text (SWT):** 5–75 words, strict 10 minutes limit, strict single-sentence rule, 4 Pearson scoring traits (Content, Form, Grammar, Vocabulary), mapped to 10–90 Pearson scale.

Strictly adheres to:
- **AGENTS.md Rule 3 (Strict Exam Engine Isolation):** Code resides entirely in `exams/pte/` and has zero references or imports to `exams/ielts/`.
- **AGENTS.md Rule 8 ("LexiFlow estimate" Labeling):** All score outputs prominently bear the `scoreLabel: "LexiFlow estimate"`.
- **AGENTS.md Rule 9 (Deterministic First Rule):** Form evaluation, sentence counting, uppercase detection, and word counts are executed deterministically before invoking any LLM, immediately returning fatal zeros for out-of-bounds submissions without token cost.
- **AGENTS.md Rule 2 (Zod Validation on All AI Outputs):** All AI-generated evaluation traits and feedback are validated against `PteEvaluationZodSchema`.

---

## 2. Changes Made
- **Deterministic Rules (`exams/pte/writing/deterministicRules.ts`):**
  - Robust word counting and abbreviation-safe sentence boundary detection.
  - Essay form scoring (200–300 words $\rightarrow$ 2; 120–199 / 301–380 $\rightarrow$ 1; <120 / >380 / all-caps $\rightarrow$ 0).
  - SWT form scoring (5–75 words AND single sentence $\rightarrow$ 1; multi-sentence or out-of-bounds $\rightarrow$ 0).
- **Pearson Rubrics Mapping (`exams/pte/writing/rubrics.ts`):**
  - Official Pearson score calculation mapping trait totals to 10–90 scale.
  - Enforces official Pearson fatal zero rules: if Form is 0 or Content is 0, overall score is baseline 10.
- **PTE Writing Evaluator (`exams/pte/writing/evaluator.ts`):**
  - Orchestrates deterministic check $\rightarrow$ AI evaluation $\rightarrow$ Zod validation $\rightarrow$ score calculation $\rightarrow$ mandatory "LexiFlow estimate" label and taxonomy error code tagging.
- **Unit Tests (`exams/pte/writing/__tests__/pteWriting.test.ts`):**
  - 9 automated test cases covering deterministic word counts, abbreviation safety, form boundaries, Pearson mapping, fatal zero short-circuits, and AI evaluation with Zod validation.

---

## 3. Verification & Proof of Quality
- `npm run check:isolation`: Passed (0 cross-engine references, 0 secrets).
- `npm run typecheck`: Passed (0 errors).
- `npx vitest run exams/pte/writing/__tests__/pteWriting.test.ts`: 9 tests passed.
