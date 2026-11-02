import { describe, expect, it } from 'vitest';
import {
  computeRaterAgreement,
  resolveMasteryTier,
  calibrateScore
} from '../scorer';

describe('TICKET LF-019: Scoring Calibration & Confidence Engine', () => {
  it('1. Computes rater agreement percentage within tolerance', () => {
    const model = [6.5, 7.0, 7.5, 8.0, 6.0];
    const human = [6.5, 7.5, 7.0, 7.0, 5.0]; // diffs: 0, 0.5, 0.5, 1.0, 1.0 -> 3 of 5 within 0.5 (60%)

    const agreement = computeRaterAgreement(model, human, 0.5);
    expect(agreement).toBe(60);
  });

  it('2. Enforces PRODUCT.md Suppression Rule when model agreement is below 80%', () => {
    // 72% agreement (< 80%)
    const result = calibrateScore('ielts_academic', 7.0, 72);
    expect(result.isSuppressed).toBe(true);
    expect(result.numericalDisplay).toBeUndefined();
    expect(result.scoreDisplayLabel).toBe('LexiFlow estimate');
    expect(result.suppressionReason).toContain('below 80% calibration threshold');
    expect(result.qualitativeMastery).toBe('Proficient');
  });

  it('3. Emits calibrated score range and confidence when agreement passes 80%', () => {
    // 92% agreement (>= 80%)
    const ieltsResult = calibrateScore('ielts_academic', 7.0, 92);
    expect(ieltsResult.isSuppressed).toBe(false);
    expect(ieltsResult.numericalDisplay).toBe('Band 6.5 – 7.5');
    expect(ieltsResult.confidence).toBe('high');
    expect(ieltsResult.scoreDisplayLabel).toBe('LexiFlow estimate');
    expect(ieltsResult.qualitativeMastery).toBe('Proficient');

    // PTE scoring
    const pteResult = calibrateScore('pte_academic', 65, 85);
    expect(pteResult.isSuppressed).toBe(false);
    expect(pteResult.numericalDisplay).toBe('PTE 62 – 68');
    expect(pteResult.confidence).toBe('medium');
    expect(pteResult.qualitativeMastery).toBe('Proficient');
  });

  it('4. Correctly categorizes qualitative mastery tiers', () => {
    expect(resolveMasteryTier('ielts_academic', 8.5)).toBe('Superior');
    expect(resolveMasteryTier('ielts_academic', 7.0)).toBe('Proficient');
    expect(resolveMasteryTier('ielts_academic', 6.0)).toBe('Competent');
    expect(resolveMasteryTier('ielts_academic', 5.5)).toBe('Developing');

    expect(resolveMasteryTier('pte_academic', 85)).toBe('Superior');
    expect(resolveMasteryTier('pte_academic', 68)).toBe('Proficient');
    expect(resolveMasteryTier('pte_academic', 60)).toBe('Competent');
    expect(resolveMasteryTier('pte_academic', 45)).toBe('Developing');
  });
});
