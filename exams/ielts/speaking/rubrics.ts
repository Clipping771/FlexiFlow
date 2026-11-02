/**
 * Official IELTS Academic Speaking Rubrics & Band Calculation Engine
 */

export interface IeltsSpeakingCriteria {
  fluencyCoherence: number;      // FC (0.0–9.0)
  lexicalResource: number;       // LR (0.0–9.0)
  grammaticalAccuracy: number;   // GRA (0.0–9.0)
  pronunciation: number;         // PR (0.0–9.0)
}

/**
 * Rounds raw average to official IELTS band scale (nearest 0.5):
 * - < 0.25 -> round down to whole band
 * - >= 0.25 and < 0.75 -> round to 0.5
 * - >= 0.75 -> round up to next whole band
 */
export function roundToIeltsSpeakingBand(rawBand: number): number {
  if (rawBand <= 0) return 0;
  if (rawBand >= 9.0) return 9.0;

  const whole = Math.floor(rawBand);
  const fraction = rawBand - whole;

  if (fraction < 0.25) {
    return whole;
  }
  if (fraction < 0.75) {
    return whole + 0.5;
  }
  return whole + 1.0;
}

export function calculateIeltsSpeakingBand(criteria: IeltsSpeakingCriteria): {
  overallBand: number;
  rawAverage: number;
  criteria: IeltsSpeakingCriteria;
} {
  const sum =
    criteria.fluencyCoherence +
    criteria.lexicalResource +
    criteria.grammaticalAccuracy +
    criteria.pronunciation;

  const rawAverage = sum / 4.0;
  const overallBand = roundToIeltsSpeakingBand(rawAverage);

  return {
    overallBand,
    rawAverage,
    criteria
  };
}
