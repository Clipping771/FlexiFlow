# TICKET LF-009: Speaking Architecture Decision & Phase 2 Staged Database Migration

**Phase:** Phase 2 — Speaking Engine  
**Status:** In Progress  
**Role:** Builder Session  
**Branch:** `feat/lf-009-speaking-architecture-db`  

---

## 1. Context & Objective
In accordance with **Final Execution Plan v1.1 (Section 3: Staged Database Entities)** and **ADR-007**, Phase 2 requires adding the staged speaking entities:
- `Recording`: Audio recording metadata, duration, mime type, sample rate, R2 storage key, 90-day retention expiration timestamp.
- `Transcript`: Recognized text, language, confidence score, recognizer model used.
- `WordTimestamp`: Granular millisecond-level word timing (`start_ms`, `end_ms`, `confidence`, `word`) to calculate Words Per Minute (WPM) and hesitation pauses.
- `PronunciationEvaluation`: Overall score (PTE 10–90 or IELTS 0.0–9.0 band), mandatory "LexiFlow estimate" label, fluency score, pronunciation score, content accuracy, pause statistics, phoneme error breakdown, and taxonomy error codes.

Adheres strictly to **AGENTS.md Rule 1 (Schema Change Rule)**: All SQL migrations and Zod/TypeScript validation models must be shipped in the exact same PR.

---

## 2. Requirements & Acceptance Criteria
1. **D1 / SQLite Migration (`server/migrations/0006_phase2_speaking.sql`):**
   - Tables: `recordings`, `transcripts`, `word_timestamps`, `pronunciation_evaluations`.
   - Foreign keys with `ON DELETE CASCADE`, check constraints, and performance indexes.
2. **TypeScript Types & Zod Schemas:**
   - Server schemas in `server/src/lib/schemas/speaking.ts`.
   - Client shared types in `src/types/speaking.ts`.
3. **Automated Testing:**
   - In-memory D1 integration tests in `server/test/speakingMigration.test.ts`.
   - Zod schema validation tests in `server/test/speakingSchemas.test.ts`.
4. **CI Passing:**
   - `npm run ci` and `npm --prefix server run ci` pass cleanly.
