# TICKET LF-002: Error Taxonomy Loader & Mistake Memory Core
**Phase:** 0 (Foundation)  
**Depends on:** LF-001  
**Assigned Agent:** Builder Agent  
**Status:** In Progress  

---

## 1. Context & Reference Reading
- **Read First:**
  - `PRODUCT.md` §3.1 (Mistake Memory & Error Taxonomy v1)
  - `ARCHITECTURE.md` §4 (Mistake Memory State Machine)
  - `AGENTS.md` §2.7 (Taxonomy Immutability & Backward Compatibility)
  - `taxonomy/errors.yaml` (30 high-frequency canonical error codes)

---

## 2. Goal
Implement the central engine of LexiFlow's pedagogical value:
1. **Taxonomy Loader:** Loads, validates, and queries canonical error definitions from `taxonomy/errors.yaml`.
2. **Mistake Memory State Machine:** Tracks every detected error through its strict mastery lifecycle:
   `New` $\rightarrow$ `Practising` $\rightarrow$ `Improving` $\rightarrow$ `Mastered` $\rightarrow$ `Reopened` (relapse).
3. **FSRS Spaced Review Scheduler:** Automatically calculates and schedules spaced retrieval reviews at 1, 3, 7, and 21 day intervals upon progression.

---

## 3. Must Have (Acceptance Criteria)
- [ ] `TaxonomyService`:
  - Parses `taxonomy/errors.yaml` with Zod validation.
  - Exposes `getError(code: string)`, `getByCategory(category: string)`, and `listAll()`.
  - Rejects invalid/unknown error codes deterministically.
- [ ] `MistakeMemoryService` (State Machine):
  - `recordOccurrence(userId, errorCode, taskId, evidenceText, contextSnippet)`:
    - Creates `error_occurrences` entry.
    - If first time: initializes `mistake_memories` with state `New`.
    - If previously `Mastered`: relapses to state `Reopened`.
    - If in progress (`Practising` / `Improving`): increments count, updates `last_seen_at`.
  - `startPractice(userId, errorCode)`:
    - Transitions from `New` or `Reopened` to `Practising`.
  - `recordPracticeAttempt(userId, errorCode, isCorrect)`:
    - If correct: transitions to `Improving`, increments `successful_corrections`.
    - When `successful_corrections >= 2`: transitions to `Mastered`.
    - Schedules/updates next due date in `review_schedules` (1, 3, 7, 21 days via FSRS).
  - `getLearnerMistakes(userId, filterState?)`:
    - Returns summary counts (by category, severity, mastery state) and active due reviews.

---

## 4. Tests
- **Automated Lifecycle Tests (`server/test/mistakeMemory.test.ts` & `src/services/mistake/__tests__/mastery.test.ts`):**
  1. `happy_path_lifecycle`: Complete end-to-end fake error flow:
     `New` $\rightarrow$ `Practising` $\rightarrow$ `Improving` $\rightarrow$ `Mastered` $\rightarrow$ `Reopened`.
  2. `relapse_detection`: A learner commits an error after mastering it $\rightarrow$ status immediately flips from `Mastered` to `Reopened`.
  3. `taxonomy_validation`: Attempting to record an unknown error code (e.g. `UNKNOWN.ERR`) throws validation error.
  4. `fsrs_schedule_generation`: Advancing to `Improving` generates valid `review_schedules` due dates (1, 3, 7, 21 days).

---

## 5. Out of Scope
- AI LLM evaluation prompts (Deferred to Phase 1).
- Frontend UI practice cards (This ticket focuses on the backend & core service layer; UI view comes in LF-003).

---

## 6. Done When
- [ ] Passes all 8 criteria in `DEFINITION_OF_DONE.md`.
- [ ] Fake error mastery flow passes 100% end-to-end (fulfilling Phase 0 exit gate requirement).
- [ ] 0 type errors on `npm run typecheck`.
- [ ] Full CI suite passes.
