# Pull Request: [LF-014] Phase 3 Reading & Listening Database Migration & Schemas
**Branch:** `feat/lf-014-reading-listening-db`  
**Base:** `feature/lexiflow-2.0`  
**Session Role:** Builder Session  
**Phase:** Phase 3 — Reading & Listening Engine  
**Ticket:** [LF-014](file:///c:/Innovation/Lexiflow/tickets/LF-014_reading_listening_db_and_schemas.md)  

---

## 1. Description & Rationale
This PR establishes the persistence layer and Zod runtime validation schemas for Phase 3: Reading & Listening Engines across PTE Academic and IELTS Academic.

Entities added:
1. `passages`: Stores long-form reading passages and listening audio transcripts.
2. `reading_listening_questions`: Stores structured items, multiple-choice options, answer keys, explanations, and point allocations.
3. `reading_listening_attempts`: Tracks learner responses, deterministic scoring, scaled test band predictions with mandatory "LexiFlow estimate" label, and taxonomy error mappings.

---

## 2. Inflexible Rules Compliance
1. **Schema Change Rule (AGENTS.md Rule 1):** SQL migration `0007_phase3_reading_listening.sql` shipped alongside server Zod schemas and client TypeScript interfaces in the exact same PR.
2. **"LexiFlow estimate" Labeling (AGENTS.md Rule 8):** Guaranteed at schema level via `scoreDisplayLabel: 'LexiFlow estimate'`.
3. **Deterministic First Rule:** Question evaluations and raw scores computed deterministically.

---

## 3. Verification & Proof of Quality
- `npm --prefix server test`: 16 test files passed, 136 tests passing (100% pass rate).
- `server/test/readingListeningMigration.test.ts`: Passed (3/3 tests).
- `server/test/readingListeningSchemas.test.ts`: Passed (3/3 tests).
- `npm run check:isolation`: Passed (0 cross-engine imports).
