# Pull Request: [LF-015] PTE Academic Reading & Listening Engine
**Branch:** `feat/lf-015-pte-reading-listening`  
**Base:** `feature/lexiflow-2.0`  
**Session Role:** Builder Session  
**Phase:** Phase 3 — Reading & Listening Engine  
**Ticket:** [LF-015](file:///c:/Innovation/Lexiflow/tickets/LF-015_pte_reading_and_listening_engine.md)  

---

## 1. Description & Rationale
Implements official Pearson scoring algorithms and deterministic validation for PTE Academic Reading and Listening modules:
1. `exams/pte/reading/scorer.ts`:
   - Re-order Paragraphs: pair adjacency sequencing (+1 per correctly matched pair).
   - Multiple Choice (Multiple): +1 correct, -1 incorrect option (floor at 0).
   - Fill in Blanks (R&W and R): 1 point per blank, error mapping to `PTE.READING_COLLOCATION_MISMATCH`.
2. `exams/pte/listening/scorer.ts`:
   - Write from Dictation: exact word-order presence matching.
   - Highlight Incorrect Words: +1 for discrepancy, -1 for false alarm (floor at 0).
   - Summarize Spoken Text: 10-point trait scoring with strict word count form boundaries (50-70 words).
3. Score scale: maps to 10–90 Pearson scale with mandatory "LexiFlow estimate" label.

---

## 2. Inflexible Rules Compliance
1. **Strict Exam Engine Isolation (AGENTS.md Rule 3):** Verified 0 cross-imports with `exams/ielts/`.
2. **"LexiFlow estimate" Labeling (AGENTS.md Rule 8):** Guaranteed on all outputs.
3. **Deterministic First Rule:** All tokenization, pair adjacency, and negative marking computed deterministically.

---

## 3. Verification & Proof of Quality
- `node scripts/check-exam-isolation.mjs`: Passed cleanly.
- `npx vitest run exams/pte/reading/__tests__/pteReading.test.ts exams/pte/listening/__tests__/pteListening.test.ts`: 6/6 tests passed.
