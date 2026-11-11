# Pull Request: [LF-007] IELTS Academic Writing Engine (Task 1 & Task 2)

**Branch:** `feat/lf-007-ielts-writing-engine`  
**Base:** `feature/lexiflow-2.0`  
**Session Role:** Builder Session  
**Phase:** Phase 1 — Writing Engine  
**Ticket:** [LF-007](file:///c:/Innovation/Lexiflow/tickets/LF-007_ielts_writing_engine.md)  

---

## 1. Description & Rationale
This PR implements the official **IELTS Academic Writing Engine** for:
1. **Writing Task 1 (Academic Report):** Min 150 words, describing visual trends and comparative data.
2. **Writing Task 2 (Academic Discursive Essay):** Min 250 words, opinion and discussion argumentation.

Strict adherence to:
- **AGENTS.md Rule 3 (Strict Exam Engine Isolation):** Code resides entirely in `exams/ielts/` with zero imports or references to `exams/pte/`.
- **AGENTS.md Rule 8 ("LexiFlow estimate" Labeling):** All band scores prominently bear `scoreLabel: "LexiFlow estimate"`.
- **AGENTS.md Rule 9 (Deterministic First Rule):** Underlength word count penalties (150 words for Task 1, 250 words for Task 2) and trivial text short-circuiting (<30 words $\rightarrow$ Band 1.0) execute deterministically before invoking any AI model.
- **AGENTS.md Rule 2 (Zod Validation on AI Outputs):** Evaluator validates criteria scores and feedback markdown against `IeltsEvaluationZodSchema`.

---

## 2. Changes Made
- **Deterministic Rules (`exams/ielts/writing/deterministicRules.ts`):**
  - Word counter and underlength penalty evaluator for Task 1 and Task 2.
  - Paragraph structure detector (flags essays lacking paragraph breaks and applies Coherence & Cohesion band ceiling of 5.0).
- **Official IELTS Rubrics & Rounding (`exams/ielts/writing/rubrics.ts`):**
  - Implements the official British Council / IDP IELTS band rounding algorithm (nearest 0.5 band, fractional part $<0.25 \rightarrow$ down, $\ge 0.25$ and $< 0.75 \rightarrow$ half band, $\ge 0.75 \rightarrow$ up).
  - Overall writing band aggregator with Task 2 weighted 2x: $(\mathrm{Task1} + 2 \times \mathrm{Task2}) / 3$.
- **IELTS Writing Evaluator (`exams/ielts/writing/evaluator.ts`):**
  - Orchestrates deterministic check $\rightarrow$ AI evaluation $\rightarrow$ Zod validation $\rightarrow$ underlength adjustment $\rightarrow$ paragraph coherence adjustment $\rightarrow$ mandatory "LexiFlow estimate" labeling.
- **Unit Tests (`exams/ielts/writing/__tests__/ieltsWriting.test.ts`):**
  - 8 automated tests covering underlength penalties, paragraph detection, rounding logic, Task 2 2x weighting, and evaluator orchestration.

---

## 3. Verification & Proof of Quality
- `npm run check:isolation`: Passed (0 cross-engine references, 0 secrets).
- `npm run typecheck`: Passed (0 errors).
- `npx vitest run exams/ielts/writing/__tests__/ieltsWriting.test.ts`: 8 tests passed.
