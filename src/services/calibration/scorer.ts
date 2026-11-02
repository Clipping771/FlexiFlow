/**
 * Scoring Calibration & Confidence Engine
 * Implements PRODUCT.md Section 4: Estimation & Scoring Transparency Policy
 * - Mandatory "LexiFlow estimate" labeling
 * - Score range & confidence intervals
 * - Suppression rule: suppresses numerical bands if benchmark agreement < 80%
 */

import { TargetExam } from '../../types';

export type QualitativeMastery = 'Developing' | 'Competent' | 'Proficient' | 'Superior';

export interface CalibrationResult {
  examType: TargetExam;
  predictedScore: number;
  isSuppressed: boolean;
  suppressionReason?: string;
  numericalDisplay?: string;
  scoreRange?: [number, number];
  qualitativeMastery: QualitativeMastery;
  confidence: 'high' | 'medium' | 'low';
  scoreDisplayLabel: 'LexiFlow estimate';
}

/**
 * Computes rater agreement percentage between model and human ground truth scores within a given tolerance.
 */
export function computeRaterAgreement(
  modelScores: number[],
  humanScores: number[],
  tolerance = 0.5
): number {
  if (modelScores.length === 0 || modelScores.length !== humanScores.length) {
    throw new Error('Score arrays must be non-empty and equal in length');
  }

  let agreedCount = 0;
  for (let i = 0; i < modelScores.length; i++) {
    if (Math.abs(modelScores[i] - humanScores[i]) <= tolerance) {
      agreedCount++;
    }
  }

  return Math.round((agreedCount / modelScores.length) * 100);
}

/**
 * Resolves qualitative mastery level from numerical predictions.
 */
export function resolveMasteryTier(examType: TargetExam, score: number): QualitativeMastery {
  if (examType === 'ielts_academic') {
    if (score >= 8.0) return 'Superior';
    if (score >= 7.0) return 'Proficient';
    if (score >= 6.0) return 'Competent';
    return 'Developing';
  } else {
    if (score >= 79) return 'Superior';
    if (score >= 65) return 'Proficient';
    if (score >= 58) return 'Competent';
    return 'Developing';
  }
}

/**
 * Calibrates numerical predictions against benchmark model agreement percentage.
 * Adheres strictly to PRODUCT.md Suppression Rule:
 * If modelAgreementPct < 80%, numerical score is suppressed and qualitative tier is returned.
 */
export function calibrateScore(
  examType: TargetExam,
  predictedScore: number,
  modelAgreementPct: number
): CalibrationResult {
  const qualitativeMastery = resolveMasteryTier(examType, predictedScore);

  // Suppression Rule Gate
  if (modelAgreementPct < 80) {
    return {
      examType,
      predictedScore,
      isSuppressed: true,
      suppressionReason: `Model agreement (${modelAgreementPct}%) is below 80% calibration threshold. Numerical score suppressed.`,
      qualitativeMastery,
      confidence: 'low',
      scoreDisplayLabel: 'LexiFlow estimate'
    };
  }

  // Calibrated score range calculation
  let scoreRange: [number, number];
  let numericalDisplay: string;
  let confidence: 'high' | 'medium';

  if (examType === 'ielts_academic') {
    const minBand = Math.max(0, predictedScore - 0.5);
    const maxBand = Math.min(9.0, predictedScore + 0.5);
    scoreRange = [minBand, maxBand];
    numericalDisplay = `Band ${minBand.toFixed(1)} – ${maxBand.toFixed(1)}`;
    confidence = modelAgreementPct >= 90 ? 'high' : 'medium';
  } else {
    const minPte = Math.max(10, Math.round(predictedScore - 3));
    const maxPte = Math.min(90, Math.round(predictedScore + 3));
    scoreRange = [minPte, maxPte];
    numericalDisplay = `PTE ${minPte} – ${maxPte}`;
    confidence = modelAgreementPct >= 90 ? 'high' : 'medium';
  }

  return {
    examType,
    predictedScore,
    isSuppressed: false,
    numericalDisplay,
    scoreRange,
    qualitativeMastery,
    confidence,
    scoreDisplayLabel: 'LexiFlow estimate'
  };
}
