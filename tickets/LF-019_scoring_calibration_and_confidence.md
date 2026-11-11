# TICKET LF-019: Scoring Calibration & Confidence Engine

**Phase:** Phase 4 — Mock Simulation & Calibration  
**Status:** In Progress  
**Role:** Builder Session  
**Branch:** `feat/lf-019-scoring-calibration`  

---

## 1. Context & Objective
In accordance with **PRODUCT.md (Section 4: Estimation & Scoring Transparency Policy)**, LexiFlow enforces rigorous transparency and scoring calibration:
1. **Calibrated Confidence Scoring:**
   - Computes score range (e.g. Band 6.5 – 7.0 or PTE 63 – 68) with confidence level (`high`, `medium`, `low`).
2. **Mandatory Band Suppression Rule:**
   - If evaluation calibration does not satisfy $\ge 80\%$ human-rater benchmark agreement (within $\pm 0.5$ band for IELTS or $\pm 5$ points for PTE), numerical bands are suppressed and qualitative mastery tiers are displayed instead ("Developing", "Competent", "Proficient", "Superior").
3. **Audit & Traceability:**
   - Logs calibration metrics, confidence ranges, and model evaluation versions.

---

## 2. Inflexible Rules Compliance
1. **Mandatory "LexiFlow estimate" Labeling (AGENTS.md Rule 8):** Preserved on all outputs.
2. **Deterministic First Rule:** Agreement calculations and confidence intervals computed deterministically.
