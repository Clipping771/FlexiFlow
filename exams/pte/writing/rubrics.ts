/**
 * Pearson PTE Academic Writing Rubric & Scale Mapping Engine
 * Maps trait scores to official 10–90 Pearson scale
 */

export interface PteEssayTraits {
  content: number;             // 0–3
  form: number;                // 0–2
  grammar: number;             // 0–2
  vocabulary: number;          // 0–2
  spelling: number;            // 0–2
  generalLinguisticRange: number; // 0–2
  developmentCoherence: number;   // 0–2
}

export interface PteSwtTraits {
  content: number;             // 0–2
  form: number;                // 0–1
  grammar: number;             // 0–2
  vocabulary: number;          // 0–2
}

/**
 * Calculates overall PTE Essay Score (10–90 Pearson Scale).
 * According to official Pearson PTE Score Guide:
 * If Content is 0 or Form is 0, no further scoring is given (0 overall contribution, baseline 10).
 */
export function calculatePteEssayScore(traits: PteEssayTraits): {
  overallScore: number;
  totalTraitPoints: number;
  maxTraitPoints: number;
  isFatalZero: boolean;
  fatalReason?: string;
} {
  const maxTraitPoints = 15;
  const totalTraitPoints =
    traits.content +
    traits.form +
    traits.grammar +
    traits.vocabulary +
    traits.spelling +
    traits.generalLinguisticRange +
    traits.developmentCoherence;

  if (traits.content === 0) {
    return {
      overallScore: 10,
      totalTraitPoints: 0,
      maxTraitPoints,
      isFatalZero: true,
      fatalReason: 'Content scored 0 (off-topic or completely misaligned with the prompt).'
    };
  }

  if (traits.form === 0) {
    return {
      overallScore: 10,
      totalTraitPoints: 0,
      maxTraitPoints,
      isFatalZero: true,
      fatalReason: 'Form scored 0 (word count violation under 120 or over 380 words, or all-caps format).'
    };
  }

  // Linear scaling from trait fraction to 10–90 Pearson scale
  const fraction = Math.min(1.0, Math.max(0.0, totalTraitPoints / maxTraitPoints));
  const overallScore = Math.min(90, Math.max(10, Math.round(10 + fraction * 80)));

  return {
    overallScore,
    totalTraitPoints,
    maxTraitPoints,
    isFatalZero: false
  };
}

/**
 * Calculates overall PTE SWT Score (10–90 Pearson Scale).
 * If Content is 0 or Form is 0 (multi-sentence or <5/>75 words), entire score is 10.
 */
export function calculatePteSwtScore(traits: PteSwtTraits): {
  overallScore: number;
  totalTraitPoints: number;
  maxTraitPoints: number;
  isFatalZero: boolean;
  fatalReason?: string;
} {
  const maxTraitPoints = 7;
  const totalTraitPoints =
    traits.content +
    traits.form +
    traits.grammar +
    traits.vocabulary;

  if (traits.form === 0) {
    return {
      overallScore: 10,
      totalTraitPoints: 0,
      maxTraitPoints,
      isFatalZero: true,
      fatalReason: 'Form scored 0 (multi-sentence structure or word count outside 5–75 words).'
    };
  }

  if (traits.content === 0) {
    return {
      overallScore: 10,
      totalTraitPoints: 0,
      maxTraitPoints,
      isFatalZero: true,
      fatalReason: 'Content scored 0 (did not capture core passage aspects or off-topic).'
    };
  }

  const fraction = Math.min(1.0, Math.max(0.0, totalTraitPoints / maxTraitPoints));
  const overallScore = Math.min(90, Math.max(10, Math.round(10 + fraction * 80)));

  return {
    overallScore,
    totalTraitPoints,
    maxTraitPoints,
    isFatalZero: false
  };
}
