# TICKET LF-015: PTE Academic Reading & Listening Engine Implementation

**Phase:** Phase 3 — Reading & Listening Engine  
**Status:** In Progress  
**Role:** Builder Session  
**Branch:** `feat/lf-015-pte-reading-listening`  

---

## 1. Context & Objective
In accordance with **PRODUCT.md (Section 3.2: PTE Academic)** and official Pearson rubrics, implement scoring algorithms, trait adapters, and deterministic validation for PTE Reading and Listening tasks:
- **PTE Reading:**
  1. `Reading & Writing: Fill in the Blanks` (Collocation, grammar, and vocabulary context)
  2. `Re-order Paragraphs` (Pair adjacency scoring: 1 point per correctly adjacent pair)
  3. `Multiple Choice (Multiple)` (Partial credit with negative marking for incorrect options, minimum 0)
  4. `Reading: Fill in the Blanks` (Drag and drop vocabulary blanks)
  5. `Multiple Choice (Single)` (1 point correct, 0 incorrect)
- **PTE Listening:**
  1. `Summarize Spoken Text` (Content, Form 50-70 words, Grammar, Vocabulary, Spelling: 0-10 raw, scaled to 10-90)
  2. `Highlight Incorrect Words` (Positive and negative marking for misidentified words)
  3. `Write from Dictation` (1 point for every correctly spelled word in exact order/presence)

---

## 2. Inflexible Rules Compliance
1. **Strict Exam Engine Isolation (AGENTS.md Rule 3):**
   - Code inside `exams/pte/` must NEVER import, touch, or reference `exams/ielts/`.
2. **"LexiFlow estimate" Labeling (AGENTS.md Rule 8):**
   - Every evaluated result must bear the mandatory badge `"LexiFlow estimate"`.
3. **Deterministic First Rule:**
   - Pair matching, word counting, negative marking, and token overlap logic executed 100% deterministically.
