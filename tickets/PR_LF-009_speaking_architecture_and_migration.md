# Pull Request: [LF-009] Speaking Architecture Decision (ADR-007) & Phase 2 Staged Database Migration

**Branch:** `feat/lf-009-speaking-architecture-db`  
**Base:** `feature/lexiflow-2.0`  
**Session Role:** Builder Session  
**Phase:** Phase 2 — Speaking Engine  
**Ticket:** [LF-009](file:///c:/Innovation/Lexiflow/tickets/LF-009_speaking_architecture_and_migration.md)  

---

## 1. Description & Rationale
In accordance with **Final Execution Plan v1.1 (Section 3: Staged Database Entities)** and **AGENTS.md Rule 1 (Schema Change Rule)**, this PR implements the architectural decision record ([ADR-007](file:///c:/Innovation/Lexiflow/DECISIONS.md#adr-007-speech-to-text--pronunciation-assessment-pipeline-selection)) and the Phase 2 speaking database entities and validation schemas:
1. `recordings`: Audio recording metadata, duration, audio format, size, R2 storage URL, and 90-day retention auto-deletion expiration timestamp.
2. `transcripts`: Speech-to-text output, confidence score, and calculated Words Per Minute (WPM) speech rate.
3. `word_timestamps`: Millisecond word boundaries (`start_ms`, `end_ms`, `pause_before_ms`) for oral fluency pause detection.
4. `pronunciation_evaluations`: Acoustic pronunciation scores, fluency scores, content scores, phonemic issue breakdown, taxonomy error codes, and mandatory **"LexiFlow estimate"** labeling.

---

## 2. Changes Made
- **Architecture Decision Record (`DECISIONS.md`):**
  - Added **ADR-007** detailing the hybrid multi-tier speech pipeline (Client Web Audio $\rightarrow$ Edge STT $\rightarrow$ Phonemic Grader) with 90-day R2 retention.
- **SQL Migration (`server/migrations/0006_phase2_speaking.sql`):**
  - Staged tables with cascading foreign keys (`ON DELETE CASCADE`), check constraints (`exam_type`), and query performance indexes.
- **Zod Schemas (`server/src/lib/schemas/speaking.ts`):**
  - Schemas: `RecordingSchema`, `TranscriptSchema`, `WordTimestampSchema`, `PhonemeIssueSchema`, `PronunciationEvaluationSchema`.
  - Strict enforcement of `scoreLabel: z.literal('LexiFlow estimate')` adhering to **AGENTS.md Rule 8**.
- **Shared Client Types (`src/types/speaking.ts`):**
  - Reusable interfaces for frontend speaking components.
- **Automated Tests:**
  - `server/test/speakingMigration.test.ts`: 3 tests verifying D1 tables, constraints, foreign key cascades, and 90-day retention metadata.
  - `server/test/speakingSchemas.test.ts`: 3 tests validating happy/failure paths, zero duration rejections, and mandatory "LexiFlow estimate" label.

---

## 3. Verification & Proof of Quality
- `npm run check:isolation`: Passed (0 cross-engine references, 0 secrets).
- `npm run typecheck`: Passed (0 errors).
- `npm --prefix server run typecheck`: Passed (0 errors).
- `npm --prefix server test`: 14 test files, **130 passing tests**.
- Total passing automated tests in repository: **546 passing tests**.
