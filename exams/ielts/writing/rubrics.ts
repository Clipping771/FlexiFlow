/**
 * Official IELTS Academic Writing Rubrics & Band Rounding Engine
 * Implements official IELTS band rounding to nearest 0.5 increments
 */

export interface IeltsCriteriaScores {
  taskAchievement: number;       // TA for Task 1, TR for Task 2 (0.0–9.0)
  coherenceCohesion: number;     // CC (0.0–9.0)
  lexicalResource: number;       // LR (0.0–9.0)
  grammaticalAccuracy: number;   // GRA (0.0–9.0)
}

/**
 * Rounds a raw fractional band to the official IELTS band scale:
 * - Fractional part < 0.25: rounds down to whole band (e.g. 6.125 -> 6.0)
 * - Fractional part >= 0.25 and < 0.75: rounds to half band (e.g. 6.25 -> 6.5, 6.74 -> 6.5)
 * - Fractional part >= 0.75: rounds up to next whole band (e.g. 6.75 -> 7.0)
 */
export function roundToIeltsBand(rawBand: number): number {
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

/**
 * Calculates individual task band score from the 4 official criteria.
 */
export function calculateIeltsTaskBand(criteria: IeltsCriteriaScores): {
  overallBand: number;
  rawAverage: number;
  criteria: IeltsCriteriaScores;
} {
  const sum =
    criteria.taskAchievement +
    criteria.coherenceCohesion +
    criteria.lexicalResource +
    criteria.grammaticalAccuracy;

  const rawAverage = sum / 4.0;
  const overallBand = roundToIeltsBand(rawAverage);

  return {
    overallBand,
    rawAverage,
    criteria
  };
}

/**
 * Aggregates overall IELTS Writing Band across Task 1 and Task 2.
 * Official weighting: Task 2 is weighted twice as much as Task 1.
 * Overall Writing = (Task 1 + 2 * Task 2) / 3, rounded to nearest 0.5 band.
 */
export function calculateOverallWritingBand(task1Band: number, task2Band: number): {
  overallBand: number;
  rawWeightedAverage: number;
} {
  const rawWeightedAverage = (task1Band + 2 * task2Band) / 3.0;
  const overallBand = roundToIeltsBand(rawWeightedAverage);

  return {
    overallBand,
    rawWeightedAverage
  };
}
