# TICKET LF-005: Phase 1 Staged Database Migration & Zod Schemas

**Phase:** Phase 1 — Writing Engine  
**Status:** In Progress  
**Role:** Builder Session  
**Branch:** `feat/lf-005-phase1-db-schemas`  

---

## 1. Context & Objective
According to **Final Execution Plan v1.1** (Section 3: Staged Database Entities), Phase 1 requires adding the core entities for test practice and scoring:
- `Question`: Question prompts, metadata, source, author, difficulty, answer key, content version.
- `Response`: Learner submissions, word count, timing, draft/submitted status.
- `Evaluation`: AI & deterministic scoring records, trait scores, feedback, error codes (linking to Mistake Memory), rubric versions, and mandatory "LexiFlow estimate" labeling.
- `ContentAsset`: Images (charts for IELTS Task 1) and question media assets with R2 storage paths and 90-day retention metadata.

Adheres strictly to **AGENTS.md Rule 1 (Schema Change Rule)**: All SQL migrations and Zod/TypeScript validation models must be shipped in the exact same PR.

---

## 2. Requirements & Acceptance Criteria
1. **D1 / SQLite Migration (`server/migrations/0005_phase1_writing.sql`):**
   - Creates `questions`, `responses`, `evaluations`, and `content_assets` tables with foreign keys and indexes.
   - Idempotent (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`).
2. **TypeScript Types & Zod Schemas:**
   - Server schemas in `server/src/lib/schemas/writing.ts` validating inputs and outputs with Zod.
   - Client shared types in `src/types/writing.ts`.
3. **Automated Testing:**
   - D1 in-memory integration tests in `server/test/writingMigration.test.ts` verifying table creation, foreign keys, cascades, and inserts.
   - Schema validation tests in `server/test/writingSchemas.test.ts` validating happy and failure paths.
4. **CI Passing:**
   - `npm run ci` and `npm --prefix server run ci` pass with 100%.
