# TICKET LF-018: Full-Length Timed Mock Exam Simulator

**Phase:** Phase 4 — Mock Simulation & Calibration  
**Status:** In Progress  
**Role:** Builder Session  
**Branch:** `feat/lf-018-full-mock-exam-simulation`  

---

## 1. Context & Objective
In accordance with **PRODUCT.md (Section 3: Product Architecture)**, LexiFlow provides complete exam simulation reproducing authentic test conditions:
- **PTE Academic Full Mock**: Timed flow encompassing Speaking & Writing, Reading, and Listening.
- **IELTS Academic Full Mock**: Timed flow encompassing Listening, Reading, Writing, and Speaking.
- Continuous stage progression, timed auto-submission, sectional breakdown, and composite score report:
  - Official Cambridge rounding rules for IELTS (0.5 increments: averages with .25 round up to .5, .75 round up to next whole band).
  - Pearson 10–90 scale across communicative skills.
  - Mandatory **"LexiFlow estimate"** badge.
  - One-click bulk synchronization of all detected errors into **Mistake Memory**.

---

## 2. Inflexible Rules Compliance
1. **Mandatory "LexiFlow estimate" Labeling (AGENTS.md Rule 8):** Rendered prominently on all aggregate and sectional scores.
2. **Mistake Memory Integration:** Automatically queues and registers all session error codes.
3. **Mobile Responsive:** Full test experience operates smoothly across both desktop and mobile viewports.
