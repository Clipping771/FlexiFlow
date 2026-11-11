# TICKET LF-010: PTE Academic Speaking Engine (RA, RS, DI, RL, ASQ)

**Phase:** Phase 2 — Speaking Engine  
**Status:** In Progress  
**Role:** Builder Session  
**Branch:** `feat/lf-010-pte-speaking-engine`  

---

## 1. Context & Objective
Implement the PTE Academic Speaking engine covering the official Pearson speaking inventory:
1. **Read Aloud (RA):** Content (0–5), Pronunciation (0–5), Oral Fluency (0–5).
2. **Repeat Sentence (RS):** Content (0–3: 100%, $\ge 50\%$, $< 50\%$), Pronunciation (0–5), Oral Fluency (0–5).
3. **Describe Image (DI):** Content (0–5), Pronunciation (0–5), Oral Fluency (0–5).
4. **Re-tell Lecture (RL):** Content (0–5), Pronunciation (0–5), Oral Fluency (0–5).
5. **Answer Short Question (ASQ):** Vocabulary / Content (0–1).
6. **Personal Introduction:** Unscored introduction recording.

---

## 2. Inflexible Rules & Acceptance Criteria
1. **Deterministic First Rule (AGENTS.md Rule 9):**
   - Detects silence or <1.5s audio deterministically $\rightarrow$ returns baseline 10 without calling LLM.
   - Text matching ratio for RA and RS calculated deterministically via normalized word token alignment.
   - Initial pause >3 seconds triggers Pearson microphone auto-stop penalty.
2. **Strict Exam Engine Isolation (AGENTS.md Rule 3):**
   - Code resides inside `exams/pte/` and must NEVER import or reference `exams/ielts/`.
3. **Mandatory "LexiFlow estimate" Labeling (AGENTS.md Rule 8):**
   - Every evaluated result must bear `scoreLabel: "LexiFlow estimate"`.
4. **Zod Validation on AI Outputs (AGENTS.md Rule 2):**
   - Validates AI responses against Zod schema.
5. **Taxonomy Linking:**
   - Maps errors to canonical taxonomy codes (`PTE.PRON_PHONEME`, `PTE.FLUENCY_PAUSE`, `PTE.RS_OMISSION`, etc.).
