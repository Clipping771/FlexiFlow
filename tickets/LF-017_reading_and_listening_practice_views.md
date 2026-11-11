# TICKET LF-017: Reading & Listening Practice Dashboard Views

**Phase:** Phase 3 — Reading & Listening Engine  
**Status:** In Progress  
**Role:** Builder Session  
**Branch:** `feat/lf-017-reading-listening-views`  

---

## 1. Context & Objective
Provide interactive, mobile-responsive practice interfaces in the LexiFlow Dashboard for Reading and Listening:
- `ReadingPracticeView.tsx`:
  - Split-pane layout (passage text on left/top, interactive question items on right/bottom).
  - Supports PTE (Fill in Blanks, Re-order, Multiple Choice) and IELTS (True/False/Not Given, Headings).
  - Interactive timer countdown, submission button, diagnostic results, and instant explanation.
  - Mandatory **"LexiFlow estimate"** badge on scores.
  - Direct integration into Mistake Memory: detected error codes automatically recorded, with direct "→ Drill" action.
- `ListeningPracticeView.tsx`:
  - Audio playback interface with progress bar and timing.
  - Synchronized question form (PTE Dictation / SST / HIW and IELTS Form Completion).
  - Scoring breakdown and Mistake Memory auto-logging.
- Navbar navigation (`reading_practice` and `listening_practice`) in `src/dashboard/components/Navbar.tsx` and routing in `src/dashboard/App.tsx`.

---

## 2. Inflexible Rules Compliance
1. **Mandatory "LexiFlow estimate" Labeling (AGENTS.md Rule 8):** Prominently displayed on all evaluated results.
2. **Mistake Memory Integration:** Detected errors automatically saved to `MistakeMemoryClient`.
3. **Mobile Responsive:** Clean layout on 375px/390px mobile screens without horizontal scroll.
