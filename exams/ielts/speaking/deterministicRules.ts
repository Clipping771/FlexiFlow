/**
 * Deterministic Rules & Fluency Calculation for IELTS Academic Speaking
 * Implements AGENTS.md Rule 9 (Deterministic First Rule)
 */

export interface IeltsSpeakingDurationCheck {
  isValid: boolean;
  fatalErrorCode?: string;
  penaltyBandDeduction: number;
  reason?: string;
}

export function validateSpeakingDuration(
  part: 1 | 2 | 3,
  durationMs: number
): IeltsSpeakingDurationCheck {
  if (durationMs < 3000) {
    return {
      isValid: false,
      fatalErrorCode: 'IELTS.AUDIO_TOO_SHORT',
      penaltyBandDeduction: 0,
      reason: 'Recording is under 3 seconds. Insufficient speech for examination.'
    };
  }

  // Part 2 Long Turn requires 1–2 minutes (target ~120s)
  if (part === 2) {
    if (durationMs < 60000) {
      return {
        isValid: true,
        penaltyBandDeduction: 1.0,
        fatalErrorCode: 'IELTS.PART2_UNDER_TIME',
        reason: `Part 2 speech was only ${(durationMs / 1000).toFixed(0)}s (minimum 1 minute required; target 2 minutes). Penalty applied to Fluency & Coherence.`
      };
    }
    if (durationMs < 90000) {
      return {
        isValid: true,
        penaltyBandDeduction: 0.5,
        reason: `Part 2 speech was ${(durationMs / 1000).toFixed(0)}s (target is close to 2 minutes). Minor penalty applied.`
      };
    }
  }

  return {
    isValid: true,
    penaltyBandDeduction: 0.0
  };
}

export function calculateSpeechRateWpm(wordCount: number, durationMs: number): number {
  if (durationMs <= 0 || wordCount <= 0) return 0;
  const minutes = durationMs / 60000;
  return Math.round((wordCount / minutes) * 10) / 10;
}

export function evaluateFluencyThreshold(wpm: number): {
  isAcceptable: boolean;
  fluencyBandCeiling: number;
  reason?: string;
} {
  if (wpm >= 110) {
    return {
      isAcceptable: true,
      fluencyBandCeiling: 9.0
    };
  }

  if (wpm >= 80) {
    return {
      isAcceptable: true,
      fluencyBandCeiling: 6.5,
      reason: `Speech rate (${wpm} WPM) is somewhat hesitant. IELTS Band 7+ typically requires 110–140 WPM.`
    };
  }

  return {
    isAcceptable: false,
    fluencyBandCeiling: 5.0,
    reason: `Speech rate (${wpm} WPM) reflects frequent noticeable pauses and search for words, capping Fluency at Band 5.`
  };
}
