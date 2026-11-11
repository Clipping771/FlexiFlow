# TICKET LF-014: Phase 3 Reading & Listening Database Migration & Schemas

**Phase:** Phase 3 — Reading & Listening Engine  
**Status:** In Progress  
**Role:** Builder Session  
**Branch:** `feat/lf-014-reading-listening-db`  

---

## 1. Context & Objective
In accordance with **PRODUCT.md** and **ARCHITECTURE.md**, Phase 3 expands LexiFlow into complete Reading and Listening test coverage for both PTE Academic and IELTS Academic.
This ticket implements the staged persistence layer and runtime validation models for reading passages, listening audio prompts, multi-format questions, and learner attempt tracking.

Adheres strictly to **AGENTS.md Rule 1 (Schema Change Rule)**: All SQL migrations and Zod/TypeScript validation models must be shipped in the exact same ticket.

---

## 2. Requirements & Acceptance Criteria
1. **D1 / SQLite Migration (`server/migrations/0007_phase3_reading_listening.sql`):**
   - Tables:
     - `passages`: Reading passages and listening transcript prompts (`id`, `exam_type`, `section`, `task_type`, `title`, `text_content`, `audio_url`, `duration_seconds`, `word_count`, `metadata_json`, `created_at`).
     - `reading_listening_questions`: Structured questions with deterministic answer keys (`id`, `passage_id`, `question_number`, `question_type`, `prompt`, `options_json`, `correct_answer_json`, `explanation`, `created_at`).
     - `reading_listening_attempts`: Student attempt records (`id`, `user_id`, `passage_id`, `exam_type`, `section`, `task_type`, `raw_score`, `max_score`, `scaled_score`, `raw_responses_json`, `feedback_json`, `created_at`).
   - Foreign keys with `ON DELETE CASCADE`, check constraints, and performance indexes.
2. **TypeScript Types & Zod Schemas:**
   - Server validation in `server/src/lib/schemas/readingListening.ts`.
   - Client shared types in `src/types/readingListening.ts`.
3. **Automated Testing:**
   - In-memory D1 integration tests in `server/test/readingListeningMigration.test.ts`.
   - Zod schema validation tests in `server/test/readingListeningSchemas.test.ts`.
4. **Strict Isolation & DoD:**
   - Zero cross-engine references, zero secrets, 100% test pass.
