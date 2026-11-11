# TICKET LF-001: Project Scaffold, Onboarding & Auth Core
**Phase:** 0 (Foundation)  
**Depends on:** Repo Handbook (Tasks 1–9)  
**Assigned Agent:** Builder Agent  
**Status:** Ready for Review & Implementation  

---

## 1. Context & Reference Reading
- **Read First:**
  - `PRODUCT.md` §1–3 (Shared Learning Core, One System, Two Engines)
  - `ARCHITECTURE.md` §1–3 (4-Layer System, Hono API + React SPA)
  - `AGENTS.md` §1–2 (Coding rules, Zod output, secrets management)
  - `DECISIONS.md` (ADR-001 & ADR-003)

---

## 2. Goal
Provide the fundamental user onboarding and authentication workflow:
1. Student registers/signs in via OAuth/Session token.
2. If profile is incomplete, route to **Onboarding Flow**:
   - Step 1: Select Target Exam (`pte_academic` or `ielts_academic`).
   - Step 2: Set Target Score (e.g. PTE 65/79 or IELTS 7.0/8.0).
   - Step 3: Enter Target Exam Date (optional, 'YYYY-MM-DD').
   - Step 4: Select Mother Tongue (default `bn` / Bengali for L1 explanations).
3. Save `LearnerProfile` and initialize `ExamProfile` via backend API (`POST /api/onboarding`).
4. Persist session and display the customized foundation Dashboard header reflecting the student's exam target and active exam mode.

---

## 3. Must Have (Acceptance Criteria)
- [ ] Backend Hono endpoint `POST /api/onboarding` validating inputs against Zod schema (`target_exam`, `target_score`, `target_exam_date`, `mother_tongue`).
- [ ] Inserts/updates `learner_profiles` and initializes `exam_profiles` in D1 database.
- [ ] Returns sanitized profile payload and session state.
- [ ] Responsive UI for mobile (375px) and desktop: step-by-step clean wizard.
- [ ] Client state properly stores active learner context (`target_exam`, `mother_tongue`).
- [ ] Reject invalid exam types (only `pte_academic` and `ielts_academic` allowed).
- [ ] Handle unauthenticated requests gracefully (401 response).

---

## 4. Tests
- **Unit / Integration Tests:**
  1. `happy_path`: User submits valid onboarding form $\rightarrow$ 200 OK, `learner_profile` and `exam_profile` rows created in D1.
  2. `failure_invalid_exam`: User submits unsupported exam (e.g. `toefl_ibt`) $\rightarrow$ 400 Bad Request with Zod validation message.
  3. `failure_unauthenticated`: Request without valid bearer session $\rightarrow$ 401 Unauthorized.
  4. `edge_case_optional_date`: User omits exam date $\rightarrow$ succeeds with null date without crashing.
- **Mobile Responsive Flow:**
  - Verify viewport 375px × 667px rendering without horizontal scroll.

---

## 5. Out of Scope
- Writing task editor or scoring logic (Deferred to Phase 1: LF-010+).
- Payment gateways or subscriptions (Deferred to Phase 4).
- Complex speech recording (Covered in LF-002 Audio Foundation Prototype).

---

## 6. Done When
- [ ] Passes all 8 criteria in `DEFINITION_OF_DONE.md`.
- [ ] Automated tests passing (`npm test`).
- [ ] `npm run typecheck` passing with 0 errors.
- [ ] PR created with QA report and visual verification screenshot.
