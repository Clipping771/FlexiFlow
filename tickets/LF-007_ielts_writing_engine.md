# TICKET LF-007: IELTS Academic Writing Engine (Task 1 Report & Task 2 Essay)

**Phase:** Phase 1 — Writing Engine  
**Status:** In Progress  
**Role:** Builder Session  
**Branch:** `feat/lf-007-ielts-writing-engine`  

---

## 1. Context & Objective
Implement the IELTS Academic Writing evaluation engine for:
1. **Writing Task 1 (Academic Report):** Min 150 words, describing visual information (charts, graphs, tables, maps, processes).
2. **Writing Task 2 (Academic Discursive Essay):** Min 250 words, opinion, discussion, problem-solution, or two-part question essay.

Both tasks evaluated against the 4 official IELTS criteria:
- Task Achievement (TA) / Task Response (TR)
- Coherence & Cohesion (CC)
- Lexical Resource (LR)
- Grammatical Range and Accuracy (GRA)
Band scores from 0.0 to 9.0 in 0.5 increments, using the official IELTS rounding rule.

---

## 2. Inflexible Rules & Acceptance Criteria
1. **Deterministic First Rule (AGENTS.md Rule 9):**
   - Word count and under-length penalty (<150 words for Task 1, <250 words for Task 2) calculated deterministically before calling LLM.
   - Empty or trivial text (<30 words) short-circuits deterministically with Band 0 or 1.0 without LLM cost.
2. **Strict Exam Engine Isolation (AGENTS.md Rule 3):**
   - Code must stay inside `exams/ielts/` and must NEVER import or reference `exams/pte/`.
3. **Mandatory "LexiFlow estimate" Labeling (AGENTS.md Rule 8):**
   - Every evaluated result must bear `scoreLabel: "LexiFlow estimate"`.
4. **Zod Validation on AI Outputs (AGENTS.md Rule 2):**
   - Every AI response is validated with Zod schemas (`IeltsEvaluationZodSchema`).
5. **Taxonomy Linking:**
   - Evaluator maps detected errors to canonical codes in `taxonomy/errors.yaml` (e.g. `IELTS.TASK2_NO_POSITION`, `IELTS.TASK1_NO_OVERVIEW`, `GRA.SUBJ_VERB_AGR`, `VOC.COLLOCATION`).
