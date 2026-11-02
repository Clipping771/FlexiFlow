# TICKET LF-011: IELTS Academic Speaking Engine (Part 1, Part 2, Part 3)

**Phase:** Phase 2 — Speaking Engine  
**Status:** In Progress  
**Role:** Builder Session  
**Branch:** `feat/lf-011-ielts-speaking-engine`  

---

## 1. Context & Objective
Implement the IELTS Academic Speaking evaluation engine covering the three official parts:
1. **Part 1 (Introduction & Interview):** Short conversational responses (15–45s).
2. **Part 2 (Individual Long Turn / Cue Card):** 1-minute prep, 2-minute sustained speaking on a cue card with bullet points.
3. **Part 3 (Two-Way Discussion):** Abstract, analytical, and speculative responses (30–60s).

Evaluated across the 4 official IELTS criteria:
- Fluency & Coherence (FC)
- Lexical Resource (LR)
- Grammatical Range and Accuracy (GRA)
- Pronunciation (PR)
Overall band score calculated using the official IELTS rounding rule to the nearest 0.5 band.

---

## 2. Inflexible Rules & Acceptance Criteria
1. **Deterministic First Rule (AGENTS.md Rule 9):**
   - Duration checks (Part 2 underlength < 60s penalty; silence < 5s) evaluated deterministically before LLM invocation.
   - Speech rate (WPM) calculated deterministically from timestamps or word count / duration.
2. **Strict Exam Engine Isolation (AGENTS.md Rule 3):**
   - Code resides inside `exams/ielts/` and must NEVER import or reference `exams/pte/`.
3. **Mandatory "LexiFlow estimate" Labeling (AGENTS.md Rule 8):**
   - Every evaluated result must bear `scoreLabel: "LexiFlow estimate"`.
4. **Zod Validation on AI Outputs (AGENTS.md Rule 2):**
   - AI outputs validated with `IeltsSpeakingAiZodSchema`.
5. **Taxonomy Linking:**
   - Maps errors to canonical taxonomy codes (`IELTS.FLUENCY_HESITATION`, `IELTS.PRON_INACCURATE`, `GRA.*`, `VOC.*`).
