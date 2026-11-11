# TICKET LF-012: Speaking Practice Dashboard View & Simulator UI

**Phase:** Phase 2 — Speaking Engine  
**Status:** In Progress  
**Role:** Builder Session  
**Branch:** `feat/lf-012-speaking-practice-simulator`  

---

## 1. Context & Objective
Provide an interactive, authentic Speaking Exam Simulator in the LexiFlow Dashboard.
Learners can practice:
- **PTE Academic:** Read Aloud (prep countdown + recording), Repeat Sentence, Describe Image, Answer Short Question.
- **IELTS Academic:** Part 1 Interview, Part 2 Cue Card (with 1-minute prep countdown), Part 3 Discussion.

---

## 2. Inflexible Rules & Acceptance Criteria
1. **Mandatory "LexiFlow estimate" Labeling (AGENTS.md Rule 8):**
   - Every evaluated speaking score in the UI must display the badge **"LexiFlow estimate"**.
2. **Authentic Prep & Recording Timers:**
   - Prep timer (35s for PTE RA, 60s for IELTS P2) with audio recording simulator.
3. **Speech-to-Text & Pronunciation Diagnostics:**
   - Displays recognized transcript, calculated WPM speech rate, trait scores (Pronunciation, Fluency, Content / FC, LR, GRA, PR), and detected mistake codes.
4. **Mobile Responsive:**
   - Renders cleanly on mobile viewports (375px/390px) and desktop without horizontal overflow.
