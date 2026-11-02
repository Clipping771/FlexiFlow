# TICKET LF-016: IELTS Academic Reading & Listening Engine Implementation

**Phase:** Phase 3 — Reading & Listening Engine  
**Status:** In Progress  
**Role:** Builder Session  
**Branch:** `feat/lf-016-ielts-reading-listening`  

---

## 1. Context & Objective
In accordance with **PRODUCT.md (Section 3.3: IELTS Academic)** and official Cambridge/IDP rubrics, implement scoring algorithms, band calculators, and deterministic validation for IELTS Reading and Listening tasks:
- **IELTS Reading:**
  1. `True / False / Not Given` and `Yes / No / Not Given` (Factual & claim identification, distinction between False and Not Given)
  2. `Matching Headings` (Paragraph main idea alignment)
  3. `Sentence & Summary Completion` (Word limit compliance: NO MORE THAN TWO WORDS)
  4. Standard IELTS Academic Reading Band Scale (0.0 to 9.0 in 0.5 increments based on raw 40-question score conversion table)
- **IELTS Listening:**
  1. `Form & Note Completion` (Exact spelling, numerical and date conventions)
  2. `Multiple Choice` (Single and Multiple answers)
  3. `Map & Plan Labeling`
  4. Standard IELTS Listening Band Scale (0.0 to 9.0 in 0.5 increments based on raw 40-question score conversion table)

---

## 2. Inflexible Rules Compliance
1. **Strict Exam Engine Isolation (AGENTS.md Rule 3):**
   - Code inside `exams/ielts/` must NEVER import, touch, or reference `exams/pte/`.
2. **"LexiFlow estimate" Labeling (AGENTS.md Rule 8):**
   - Every evaluated result must bear the mandatory badge `"LexiFlow estimate"`.
3. **Deterministic First Rule:**
   - Raw score mapping to official band tables executed 100% deterministically.
