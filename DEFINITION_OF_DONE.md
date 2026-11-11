# LexiFlow AI — Definition of Done (DEFINITION_OF_DONE.md)

**Authority:** Founder  
**Scope:** Every Pull Request (PR) must satisfy all 8 criteria before it can be merged into `main`.

---

## The 8 Mandatory DoD Criteria

### 1. Specification Compliance
- [ ] All requirements and acceptance criteria in the Ticket (`TICKET LF-xxx`) are completely implemented.
- [ ] No unauthorized out-of-scope features or stray refactorings were introduced.

### 2. Zero Type Errors & Lint Cleanliness
- [ ] `npm run typecheck` passes with zero errors.
- [ ] Linter passes with no warnings or suppressed rules without justification.

### 3. Automated Test Coverage
- [ ] 100% pass rate on the existing automated test suite (`npm test`).
- [ ] At least 1 complete happy-path test added for new functionality.
- [ ] At least 3 realistic failure/edge-case tests added (e.g., malformed input, network timeout, boundary values).

### 4. Schema & Validation Rigor
- [ ] Any database schema change is accompanied by an atomic migration file and matching Zod/TypeScript validation.
- [ ] All AI responses are validated via Zod schemas with fallback handling.

### 5. Architectural & Boundary Compliance
- [ ] PTE and IELTS codebases remain strictly isolated (path checks verified).
- [ ] All AI calls record token usage and cost metrics to `UsageRecord`.
- [ ] Score displays feature the mandatory **"LexiFlow estimate"** label.

### 6. Mobile Responsiveness & Viewport Quality
- [ ] UI features verified on a mobile viewport (e.g., 375px × 667px / 390px × 844px).
- [ ] No horizontal scrolling, broken buttons, or clipped modals on touch screens.

### 7. Security & Secrets Check
- [ ] Zero API keys, passwords, or secrets committed in git history or code.
- [ ] All external inputs sanitized against XSS and injection attacks.

### 8. QA & Visual Verification Proof
- [ ] Screenshot, GIF, or terminal log attached demonstrating the feature working.
- [ ] Separate QA Session verification report completed and attached to the PR.
