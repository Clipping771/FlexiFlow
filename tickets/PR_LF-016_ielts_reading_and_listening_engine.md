# Pull Request: [LF-016] IELTS Academic Reading & Listening Engine
**Branch:** `feat/lf-016-ielts-reading-listening`  
**Base:** `feature/lexiflow-2.0`  
**Session Role:** Builder Session  
**Phase:** Phase 3 — Reading & Listening Engine  
**Ticket:** [LF-016](file:///c:/Innovation/Lexiflow/tickets/LF-016_ielts_reading_and_listening_engine.md)  

---

## 1. Description & Rationale
Implements official Cambridge/IDP scoring models and band converters for IELTS Academic Reading and Listening:
1. `exams/ielts/reading/scorer.ts`:
   - True/False/Not Given: distinguishes between contradiction (`IELTS.READING_FACTUAL_CONTRADICTION`) and unmentioned claims (`IELTS.READING_TF_CONFUSION`).
   - Matching Headings: aligns paragraph main ideas.
   - Raw score conversion: maps 0–40 points to the official 0.0–9.0 band scale with 0.5 increments.
2. `exams/ielts/listening/scorer.ts`:
   - Form & Note Completion: validates exact spelling and strictly enforces word count limits (e.g. `NO MORE THAN TWO WORDS`).
   - Mistake taxonomy mapping: flags `IELTS.LISTENING_WORD_LIMIT_EXCEEDED` and `IELTS.LISTENING_SPELLING_SLIP`.
   - Raw score conversion: maps 0–40 points to official Listening band scale.
3. Labeling: All outputs guarantee the mandatory `"LexiFlow estimate"` badge.

---

## 2. Inflexible Rules Compliance
1. **Strict Exam Engine Isolation (AGENTS.md Rule 3):** Verified 0 cross-imports with `exams/pte/`.
2. **"LexiFlow estimate" Labeling (AGENTS.md Rule 8):** Prominently labeled on all score predictions.
3. **Deterministic First Rule:** Official band conversions and word counting computed 100% deterministically.

---

## 3. Verification & Proof of Quality
- `node scripts/check-exam-isolation.mjs`: Passed cleanly.
- `npx vitest run exams/ielts/reading/__tests__/ieltsReading.test.ts exams/ielts/listening/__tests__/ieltsListening.test.ts`: 6/6 tests passed.
