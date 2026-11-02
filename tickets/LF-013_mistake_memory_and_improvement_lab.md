# TICKET LF-013: Mistake Memory & Improvement Lab Dashboard View
**Phase:** Core Learning System  
**Depends on:** LF-002, LF-008, LF-012  
**Assigned Agent:** Builder Agent  
**Status:** In Progress  

---

## 1. Context & Reference Reading
- **Read First:**
  - `PRODUCT.md` §3.1 (Mistake Memory & Improvement Lab)
  - `ARCHITECTURE.md` §1 & §4 (Mistake Memory State Machine: New -> Practising -> Improving -> Mastered -> Reopened)
  - `AGENTS.md` §2.7 & §2.8 (Taxonomy immutability & "LexiFlow estimate" labeling)
  - `taxonomy/errors.yaml` & `src/services/taxonomy/catalog.ts`

---

## 2. Goal
Complete the core pedagogical promise of LexiFlow:
1. **Mistake Memory Dashboard (`src/dashboard/components/MistakeMemoryView.tsx`)**:
   - Visualize learner's active mistakes across all 5 mastery states: `New`, `Practising`, `Improving`, `Mastered`, `Reopened`.
   - Category filtering (`GRA`, `VOC`, `MEC`, `PTE`, `IELTS`) and severity indicators.
   - Comprehensive error cards detailing description, incorrect vs correct examples, and native context.
2. **Improvement Lab Interactive Drill Mode**:
   - Guided re-write and correction drills allowing learners to actively practice fixing errors.
   - Advances error state machine (`Practising` -> `Improving` -> `Mastered` after 2 consecutive successful attempts).
   - Generates FSRS spaced retrieval schedules (1, 3, 7, 21 days).
3. **End-to-End Exam Engine Integration**:
   - Automatically records detected error codes from `WritingPracticeView` and `SpeakingPracticeView` into Mistake Memory.
   - Clickable error badges directly open the specific error inside the Improvement Lab.

---

## 3. Acceptance Criteria
- [ ] `MistakeMemoryView` component displays state distribution and full error list.
- [ ] Category tabs and search allow quick filtering by taxonomy category and severity.
- [ ] Interactive Improvement Lab drill executes correction tests and updates mastery state.
- [ ] Writing & Speaking evaluation results auto-save detected error codes to Mistake Memory.
- [ ] Automated tests cover view rendering, state filtering, drill progression, and exam engine integration.
- [ ] Passes all 8 criteria in `DEFINITION_OF_DONE.md`.
