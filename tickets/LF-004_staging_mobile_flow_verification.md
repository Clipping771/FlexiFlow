# TICKET LF-004: Staging Deployment & Mobile End-to-End Flow Verification

**Phase:** Phase 0 — Foundation  
**Status:** In Progress  
**Role:** Builder  
**Exit Gate Condition:** "Staging-এ mobile-এ signup থেকে dashboard পর্যন্ত কাজ করে"  

---

## 1. Objective
Validate end-to-end functionality of LexiFlow AI on mobile screen dimensions (375px × 667px / 390px × 844px) from initial onboarding/signup to dashboard navigation, exam target switching (PTE Academic Target 79 & IELTS Academic Band 7.5), and verify mandatory "LexiFlow estimate" labeling, drawer navigation, and staging build integrity.

---

## 2. Requirements & Acceptance Criteria
1. **Mobile Viewport Compatibility:**
   - App must render without layout breaks or horizontal overflow on 375px (iPhone SE/8) and 390px (iPhone 12/13/14) screen widths.
2. **Onboarding Flow on Mobile:**
   - Automatically prompts first-time learners with the 4-step Onboarding Wizard.
   - Allows choosing PTE Academic (target 79) or IELTS Academic (target 7.5).
   - Allows setting exam date, mother tongue (bn/hi/en), and study rhythm hours.
   - Persists learner profile in `localStorage` (`lexiflow_learner_profile`) and synchronizes with server onboarding API.
3. **Mandatory Estimation Labeling (Rule 8):**
   - Both desktop top bar and mobile top bar display the "LexiFlow estimate" badge next to predicted/target scores.
4. **Mobile Navigation Drawer & Bottom Bar:**
   - Bottom navigation bar allows switching between Vocabulary, Spaced Review, Settings, and Tools.
   - Hamburger menu opens mobile sidebar drawer (`narrow-drawer`) and close button dismisses it.
5. **Staging Build & Configuration:**
   - `npm run build:staging` must produce clean staging bundles.
   - Cloudflare Workers dry-run configuration (`server/package.json check:config`) validates staging environment schema without errors.
