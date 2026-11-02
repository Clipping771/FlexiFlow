# LexiFlow AI — Product Specification (PRODUCT.md)

**Product Vision:** One Learning System, Two Exam Engines (PTE Academic + IELTS Academic)  
**Core Promise:** Learn English. Fix your mistakes. Prepare for your test.  
**Version:** 1.1 (Production Blueprint)  
**Owner:** Founder  

---

## 1. Product Summary & Mission

Most test-preparation products are either passive question banks (dumping questions without diagnostics) or superficial AI scorers that hand out unreliable, uncalibrated scores without explaining *why* the student failed or *how* to permanently stop repeating mistakes.

**LexiFlow AI** solves this through a fundamental shift:
Instead of treating mock tests as disposable attempts, LexiFlow extracts every grammatical, lexical, acoustic, and structural error into a persistent **Mistake Memory**. The student doesn't just practice; they eliminate recurring error patterns through active spaced retrieval and targeted drills before sitting their official exam.

---

## 2. Core Target Audience & Use Case

- **Primary Persona:** International students and skilled migration applicants (predominantly South Asia, including Bangladesh and India) preparing for:
  1. **PTE Academic** (Targeting 58, 65, or 79+).
  2. **IELTS Academic** (Targeting Band 6.5, 7.0, 7.5, or 8.0+).
- **Core Pain Points:**
  - Repeatedly scoring 6.0 in IELTS Writing or 58-64 in PTE Speaking without knowing the exact structural errors holding them back.
  - Wasting money taking the $200–$250 official test multiple times without fixing core weaknesses.
  - Low-quality online mock platforms offering arbitrary, unhelpful, or inflated AI band predictions.

---

## 3. Product Architecture: One Core, Two Engines

```
┌───────────────────────────────────────────────────────────────┐
│                     LEXIFLOW CORE LEARNING SYSTEM             │
│  - Mistake Memory (State Machine: New -> Practising -> Mastered)│
│  - Error Taxonomy v1 (Canonical error codes & definitions)    │
│  - Spaced Retrieval Engine (FSRS scheduling at 1/3/7/21 days) │
│  - Active Usage Coach & Improvement Lab                       │
│  - User & Learner Profile (Mother tongue: bn, target, date)   │
└───────────────┬───────────────────────────────┬───────────────┘
                │                               │
                ▼                               ▼
 ┌─────────────────────────────┐ ┌─────────────────────────────┐
 │      EXAM ENGINE: PTE       │ │     EXAM ENGINE: IELTS      │
 │  - 22 Scored Task Types     │ │  - Writing (Task 1 & Task 2)│
 │  - 1 Unscored (Personal Int)│ │  - Speaking (Parts 1, 2, 3) │
 │  - PTE Scoring Scale (10-90)│ │  - Reading (11 Task Types)  │
 │  - Machine-scored Traits:   │ │  - Listening (7 Task Types) │
 │    Oral Fluency, Pronunc,   │ │  - Band Descriptors (0-9):  │
 │    Form, Content, Vocab     │ │    TR/TA, CC, LR, GRA       │
 └─────────────────────────────┘ └─────────────────────────────┘
```

### 3.1 The Shared Learning Core
1. **Mistake Memory**:
   - Central repository for every mistake made across any skill or test.
   - Tracks mastery states: `New` $\rightarrow$ `Practising` $\rightarrow$ `Improving` $\rightarrow$ `Mastered` $\rightarrow$ `Reopened` (if the learner relapses in a future submission).
2. **Error Taxonomy v1**:
   - Standardized catalog of high-frequency error codes (e.g., `GRA.SUBJ_VERB_AGR`, `VOC.COLLOCATION_UNNATURAL`, `PTE.ORAL_HESITATION_LONG`, `IELTS.TASK2_TR_INCOMPLETE`).
3. **FSRS Spaced Review**:
   - Evidence-based spaced repetition scheduling flashcards and error re-tests at 1, 3, 7, and 21 day intervals.
4. **Improvement Lab**:
   - Guided re-write and re-speaking exercises focused strictly on correcting identified error occurrences.

### 3.2 Exam Engine 1: PTE Academic
- Full coverage of **22 scored task types** plus 1 unscored:
  - **Speaking & Writing (9 scored + 1 unscored):** Read Aloud, Repeat Sentence, Describe Image, Re-tell Lecture, Answer Short Question, Summarize Written Text, Write Essay, Summarize Spoken Text, Write from Dictation. Unscored: Personal Introduction.
  - **Reading (5 scored):** Reading & Writing: Fill in the Blanks, Multiple Choice (Multiple), Re-order Paragraphs, Reading: Fill in the Blanks, Multiple Choice (Single).
  - **Listening (8 scored):** Summarize Spoken Text, Multiple Choice (Multiple), Fill in the Blanks, Highlight Correct Summary, Multiple Choice (Single), Select Missing Word, Highlight Incorrect Words, Write from Dictation.
- Precise alignment with Pearson timing and trait scoring rubrics.

### 3.3 Exam Engine 2: IELTS Academic
- Full coverage of Academic modules:
  - **Writing:** Task 1 (Academic visual report) and Task 2 (Discursive essay). Evaluated on 4 official criteria: Task Achievement/Response (TA/TR), Coherence & Cohesion (CC), Lexical Resource (LR), and Grammatical Range & Accuracy (GRA).
  - **Speaking:** Part 1 (Introduction & Interview), Part 2 (Individual Long Turn / Cue Card), Part 3 (Two-way Discussion). Evaluated on Fluency & Coherence, Lexical Resource, Grammatical Range & Accuracy, and Pronunciation.
  - **Reading:** 11 standard academic task types.
  - **Listening:** 4 sections across 7 task types.

---

## 4. Estimation & Scoring Transparency Policy

1. **Mandatory Estimate Label:** All score outputs are labeled explicitly as **"LexiFlow estimate"**. The system never claims to provide an official Pearson or Cambridge/IDP score.
2. **Score Range & Confidence:** Numerical predictions are accompanied by a score range (e.g., "Band 6.5 – 7.0" or "63 – 68") and a confidence level based on model calibration.
3. **Evidence-First Feedback:** Scores are accompanied by exact evidence snippets and mapped taxonomy codes.
4. **Suppression Rule:** If a task's evaluation model does not pass human-rater calibration ($\ge 80\%$ agreement within $\pm 0.5$ band on holdout sets), numerical bands are suppressed, and qualitative mastery levels are shown instead.

---

## 5. Explicit Non-Goals for Version 1

To preserve quality, protect cash runway, and prevent fatal scope creep, the following are strictly **OUT OF SCOPE** for Version 1:

- **NO B2B / Teacher Dashboard:** We serve individual test-takers directly first. Institutional portals come in Phase 5.
- **NO Leaked / Copyrighted Test Materials:** We never scrape or copy official proprietary test banks from Pearson or IDP/British Council. All practice questions must follow our original content pipeline (`Idea` $\rightarrow$ `Draft` $\rightarrow$ `Expert Review` $\rightarrow$ `Validation` $\rightarrow$ `Copyright Check`).
- **NO Premature Payment Gateway Integration:** The payment system (`subscription`, `billing`) will NOT be built until the Phase 4 gate verifies user retention and willingness to pay in closed beta.
- **NO Additional Exams in V1:** No TOEFL, PTE Core, IELTS General Training, or Duolingo English Test until Phase 5 expansion.
- **NO Standalone Mobile App (Native iOS/Android):** Responsive web platform (PWA-compatible) accessible via mobile Chrome/Safari is the sole target.

---

## 6. Definition of Success

LexiFlow AI succeeds when a learner:
1. Identifies their top 3 repeating error codes within their first 2 practice tasks.
2. Experiences measurable reduction in those error frequencies through the Improvement Lab.
3. Successfully transitions errors into `Mastered` state in Mistake Memory.
4. Achieves their target score in their real exam on their first attempt after training with LexiFlow.
