# Pull Request: [LF-017] Reading & Listening Practice Dashboard Views
**Branch:** `feat/lf-017-reading-listening-views`  
**Base:** `feature/lexiflow-2.0`  
**Session Role:** Builder Session  
**Phase:** Phase 3 — Reading & Listening Engine  
**Ticket:** [LF-017](file:///c:/Innovation/Lexiflow/tickets/LF-017_reading_and_listening_practice_views.md)  

---

## 1. Description & Rationale
Implements interactive, mobile-responsive practice interfaces in the LexiFlow Dashboard for Reading and Listening:
1. `src/dashboard/components/ReadingPracticeView.tsx`:
   - Split-view layout displaying long-form academic passages on the left/top and question forms on the right/bottom.
   - Interactive tasks for PTE (Fill in Blanks R&W, Re-order Paragraphs, Multiple Choice Multiple) and IELTS (True/False/Not Given, Matching Headings).
   - Live timer, instant scoring feedback, item-by-item breakdown, and mandatory "LexiFlow estimate" badge.
   - Automatic recording of error codes to Mistake Memory with "→ Drill in Lab" deep-linking.
2. `src/dashboard/components/ListeningPracticeView.tsx`:
   - Audio prompt player simulating official exam delivery.
   - Tasks for PTE (Write from Dictation, Summarize Spoken Text, Highlight Incorrect Words) and IELTS (Form Completion).
   - Immediate scoring, item diagnostics, and Mistake Memory logging.
3. Navigation integration:
   - Added `reading_practice` and `listening_practice` to `Navbar.tsx` and `App.tsx`.

---

## 2. Inflexible Rules Compliance
1. **Mandatory "LexiFlow estimate" Labeling (AGENTS.md Rule 8):** Prominently rendered on all score badges.
2. **Mistake Memory Auto-Recording:** Detected errors saved to `MistakeMemoryClient`.
3. **Mobile Responsive:** Verified responsive flex/grid layouts with zero horizontal clipping.

---

## 3. Verification & Proof of Quality
- `node scripts/check-exam-isolation.mjs`: Passed cleanly.
- `npx vitest run src/dashboard/components/__tests__/readingPracticeView.test.tsx src/dashboard/components/__tests__/listeningPracticeView.test.tsx`: 6/6 tests passed.
