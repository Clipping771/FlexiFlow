# TICKET LF-008: Writing Practice Dashboard View & Editor UI

**Phase:** Phase 1 — Writing Engine  
**Status:** In Progress  
**Role:** Builder Session  
**Branch:** `feat/lf-008-writing-practice-editor`  

---

## 1. Context & Objective
Provide an authentic, highly responsive Exam Writing Simulator and Practice Editor in the LexiFlow Dashboard.
Learners can choose between:
- **PTE Academic:** Write Essay (20m, 200–300 words) and Summarize Written Text (10m, 5–75 words, 1 sentence).
- **IELTS Academic:** Writing Task 1 Report (20m, 150+ words) and Writing Task 2 Essay (40m, 250+ words).

---

## 2. Inflexible Rules & Acceptance Criteria
1. **Mandatory "LexiFlow estimate" Labeling (AGENTS.md Rule 8):**
   - Every evaluated score in the UI must display the badge **"LexiFlow estimate"**.
2. **Deterministic Live Word Counter (AGENTS.md Rule 9):**
   - Real-time word counter with color indicators (amber when under length, green when optimal, orange when exceeding max).
3. **Official Countdown Timer:**
   - Accurate countdown matching official exam specifications (20 mins / 10 mins / 40 mins).
4. **Autosave Drafts:**
   - Automatically saves in-progress text to avoid loss of work.
5. **Detailed Scoring & Trait Breakdown:**
   - Displays Pearson PTE traits or IELTS 4 criteria (TA/TR, CC, LR, GRA) alongside actionable feedback and taxonomy error codes.
6. **Mobile Responsive:**
   - Renders cleanly on mobile viewports (375px/390px) and desktop without horizontal scroll.
