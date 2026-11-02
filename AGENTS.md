# LexiFlow AI — Developer & Agent Operating Rules (AGENTS.md)

**Target:** Antigravity Builder, QA & Docs Agent Sessions  
**Status:** Mandatory & Inflexible  
**Authority:** Founder  

---

## 1. Core Operating Philosophy
You are an autonomous engineering agent working inside a company with a single human founder.
- **You do not approve your own work.**
- **You do not merge into `main`.**
- **You adhere strictly to your assigned Ticket.**
- **One Ticket = One Branch = One Session = One PR.**

---

## 2. Inflexible Coding Rules (Violations Reject the PR)

1. **Schema Change Rule:**
   - Any database or API schema change must include both the SQL migration and Zod/TypeScript validation in the **exact same PR**.
   - No orphan migrations or unvalidated schemas.

2. **Zod Validation on All AI Outputs:**
   - Every AI response must be validated using Zod schemas (`safeJson.ts`).
   - If validation fails, attempt automated recovery or mark the output as `UNCERTAIN`. Never pass raw unparsed LLM text to learners.

3. **Strict Exam Engine Isolation:**
   - Code inside `exams/pte/` must **NEVER** import, touch, or reference `exams/ielts/`.
   - Code inside `exams/ielts/` must **NEVER** import, touch, or reference `exams/pte/`.
   - Any cross-engine PR will be automatically rejected by CI.

4. **Zero Secrets in Code:**
   - Never hardcode API keys, JWT secrets, or sensitive tokens in frontend or repository files.
   - All credentials must use environment variables or Cloudflare Worker encrypted secrets.

5. **Mandatory Token & Cost Logging:**
   - Every AI invocation must write an entry to `UsageRecord` capturing: `userId`, `taskId`, `provider`, `model`, `promptTokens`, `completionTokens`, `estimatedCostUSD`, `promptVersion`, `rubricVersion`, and `taxonomyVersion`.

6. **Scope Discipline (No Stray Refactoring):**
   - Do NOT refactor files or modules outside the scope of your assigned ticket.
   - If you identify technical debt or an architecture problem, propose a new ticket in the PR description instead of editing out-of-scope files.

7. **Taxonomy Immutability & Backward Compatibility:**
   - Error taxonomy codes in `taxonomy/errors.yaml` are version-controlled and immutable.
   - Never delete an existing error code without a data migration and backward compatibility test ensuring historical student records remain intact.

8. **"LexiFlow estimate" Labeling:**
   - Every score displayed in the UI must prominently bear the label **"LexiFlow estimate"**.
   - Never present an AI prediction as an official PTE or IELTS score.

9. **Deterministic First Rule:**
   - Never invoke an LLM for logic that can be executed deterministically (e.g., word counting, time calculations, empty string rejections, regex checks).

---

## 3. Session Roles & Boundaries

- **Builder Session:**
  - Reads `PRODUCT.md`, `ARCHITECTURE.md`, `AGENTS.md`, and the specific ticket.
  - Formulates an implementation plan.
  - Implements the code and automated tests (happy path + failure paths).
  - Opens the PR with full details and verification proof.

- **QA Session (Separate Session):**
  - Cannot be the same session that built the code.
  - Tries to break the PR: tests boundary conditions, extreme inputs, mobile viewport overflows, network failures, and timeout behaviors.
  - Submits a QA validation report before the founder reviews.

- **Docs Session:**
  - Updates changelog, known limitations, and API documentation upon merge.
