/**
 * Pearson PTE Academic Speaking Rubrics & Score Mapping Engine
 * Maps Content, Pronunciation, and Oral Fluency to the 10–90 Pearson scale
 */

export interface PteSpeakingTraits {
  content: number;
  pronunciation: number;         // 0–5
  oralFluency: number;           // 0–5
}

/**
 * Calculates overall PTE Speaking task score on the 10–90 scale.
 */
export function calculatePteSpeakingScore(
  traits: PteSpeakingTraits,
  maxContentPoints: number = 5
): {
  overallScore: number;
  totalTraitPoints: number;
  maxPossiblePoints: number;
  isFatalZero: boolean;
} {
  const maxPossiblePoints = maxContentPoints + 5 + 5; // Content + Pronunciation (5) + Fluency (5)
  const totalTraitPoints = traits.content + traits.pronunciation + traits.oralFluency;

  // Fatal zero if learner spoke nothing or completely unintelligible
  if (traits.content === 0 && traits.pronunciation === 0) {
    return {
      overallScore: 10,
      totalTraitPoints: 0,
      maxPossiblePoints,
      isFatalZero: true
    };
  }

  const fraction = Math.min(1.0, Math.max(0.0, totalTraitPoints / maxPossiblePoints));
  const overallScore = Math.min(90, Math.max(10, Math.round(10 + fraction * 80)));

  return {
    overallScore,
    totalTraitPoints,
    maxPossiblePoints,
    isFatalZero: false
  };
}
