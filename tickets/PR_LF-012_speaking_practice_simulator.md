# Pull Request: [LF-012] Speaking Practice Dashboard View & Audio Recording Simulator

**Branch:** `feat/lf-012-speaking-practice-simulator`  
**Base:** `feature/lexiflow-2.0`  
**Session Role:** Builder Session  
**Phase:** Phase 2 — Speaking Engine  
**Ticket:** [LF-012](file:///c:/Innovation/Lexiflow/tickets/LF-012_speaking_practice_simulator_view.md)  

---

## 1. Description & Rationale
This PR implements the interactive **Speaking Exam Simulator & Studio UI** in the LexiFlow Dashboard. It enables learners to practice authentic speaking tasks with official preparation countdowns, live recording timers, speech transcript evaluation, and detailed criteria breakdowns displaying prominent **"LexiFlow estimate"** badges.

Supported Tasks:
- **PTE Academic:**
  - Read Aloud (35s prep, 40s speak).
  - Repeat Sentence (audio recall).
  - Describe Image (25s prep, 40s speak).
  - Answer Short Question (quick vocabulary recall).
- **IELTS Academic:**
  - Part 1 (Introduction & Interview).
  - Part 2 (Cue Card Long Turn with 1-minute prep countdown).
  - Part 3 (Two-Way Discussion).

---

## 2. Changes Made
- **SpeakingPracticeView (`src/dashboard/components/SpeakingPracticeView.tsx`):**
  - Task tab switcher dynamically filtered by learner profile (PTE vs IELTS).
  - Preparation timer countdown (e.g. 35s for RA, 60s for IELTS Part 2) with skip-prep action.
  - Recording countdown timer with dynamic waveform pill indicators.
  - Speech-to-text transcript input and review panel.
  - Evaluation results card displaying overall score, mandatory **"LexiFlow estimate"** badge, trait breakdown (Content, Pronunciation, Fluency / FC, LR, GRA, PR), feedback markdown, and error code badges linking to Mistake Memory.
- **Navigation Integration:**
  - `src/dashboard/components/Navbar.tsx`: Added `speaking_practice` to `DashboardTab` and added "Speaking Engine" nav button.
  - `src/dashboard/App.tsx`: Added `speaking_practice` to `TAB_TITLES` and routed to `SpeakingPracticeView`.
- **Automated Tests (`src/dashboard/components/__tests__/speakingPracticeView.test.tsx`):**
  - 4 tests verifying PTE and IELTS task views, preparation countdown, recording toggle, evaluation trigger, and "LexiFlow estimate" badge presence.

---

## 3. Verification & Proof of Quality
- `npm run check:isolation`: Passed (0 cross-engine references, 0 secrets).
- `npm run typecheck`: Passed (0 errors).
- `npm --prefix server run typecheck`: Passed (0 errors).
- `npx vitest run src/dashboard/components/__tests__/speakingPracticeView.test.tsx`: 4 tests passed.
