# TICKET LF-006: PTE Academic Writing Engine (WE & SWT)

**Phase:** Phase 1 — Writing Engine  
**Status:** In Progress  
**Role:** Builder Session  
**Branch:** `feat/lf-006-pte-writing-engine`  

---

## 1. Context & Objective
Implement the PTE Academic Writing engine for the two official writing tasks:
1. **Write Essay (WE):** 200–300 words, 20 minutes strict timing, 7 Pearson scoring traits (Content 0-3, Form 0-2, Grammar 0-2, Vocabulary 0-2, Spelling 0-2, Linguistic Range 0-2, Coherence 0-2), mapped to 10–90 Pearson scale.
2. **Summarize Written Text (SWT):** 5–75 words, 10 minutes strict timing, STRICT single-sentence rule, 4 Pearson scoring traits (Content 0-2, Form 0-1, Grammar 0-2, Vocabulary 0-2), mapped to 10–90 scale.

---

## 2. Inflexible Rules & Acceptance Criteria
1. **Deterministic First Rule (AGENTS.md Rule 9):**
   - Word count and sentence count must be executed deterministically.
   - If SWT has >1 sentence or word count is out of bounds (<5 or >75), Form score is immediately 0 deterministically without calling LLM.
   - If essay is empty or <50 words, rejects immediately with deterministic zero/minimal score.
2. **Strict Exam Engine Isolation (AGENTS.md Rule 3):**
   - Code must stay inside `exams/pte/` and must NEVER import or reference `exams/ielts/`.
3. **Mandatory "LexiFlow estimate" Labeling (AGENTS.md Rule 8):**
   - Every evaluated result must bear `scoreLabel: "LexiFlow estimate"`.
4. **Zod Validation on AI Outputs (AGENTS.md Rule 2):**
   - Every AI response is validated with Zod schemas.
5. **Taxonomy Linking:**
   - Evaluator maps detected mistakes to canonical error codes in `taxonomy/errors.yaml` (e.g. `PTE.ESSAY_OFF_TOPIC`, `PTE.SWT_MULTI_SENTENCE`, `GRA.SUBJ_VERB_AGR`, `VOC.COLLOCATION`).
