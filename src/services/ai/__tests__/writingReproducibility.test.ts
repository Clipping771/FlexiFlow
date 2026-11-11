import { describe, expect, it } from 'vitest';
import { evaluatePteEssay, evaluatePteSwt } from '../../../../exams/pte/writing/evaluator';
import { evaluateIeltsTask1, evaluateIeltsTask2 } from '../../../../exams/ielts/writing/evaluator';

describe('Phase 1 Writing Engine: Reproducibility & Calibration Benchmark', () => {
  const benchmarkEssayPte =
    'In recent years, higher education institutions have faced intense debate regarding whether academic curricula should prioritize career readiness or intellectual enrichment. Proponents of career-oriented training argue that rising tuition costs compel universities to equip graduates with vocational skills. Conversely, advocates of liberal arts contend that critical thinking and ethical reasoning are indispensable. In conclusion, higher education must strike an optimal balance between vocational preparation and theoretical foundation.';

  const paddedPteEssay = new Array(200).fill('higher education').join(' ') + '\n\n' + benchmarkEssayPte;

  it('1. Measures score variance across repeated runs on the exact same PTE essay', async () => {
    const runs = 5;
    const scores: number[] = [];
    const costRecords: number[] = [];

    for (let i = 0; i < runs; i++) {
      const evalResult = await evaluatePteEssay('Prompt on higher education focus', paddedPteEssay);
      expect(evalResult.scoreLabel).toBe('LexiFlow estimate');
      scores.push(Number(evalResult.overallScore));
      costRecords.push(evalResult.costUsd);
    }

    // Calculate score variance: Var(X) = E[X^2] - (E[X])^2
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;

    // Variance must be below threshold (strict calibration requirement)
    expect(variance).toBeLessThanOrEqual(2.0);

    // Calculate average cost per evaluation
    const avgCostUsd = costRecords.reduce((a, b) => a + b, 0) / costRecords.length;
    expect(avgCostUsd).toBeLessThan(0.01); // Well within budget
  });

  it('2. Measures reproducibility and error code consistency for IELTS Task 2', async () => {
    const benchmarkEssayIelts =
      'Taking a gap year before commencing university studies has become an increasingly popular phenomenon globally.\n\nOn the one hand, spending a year travelling or gaining employment allows young individuals to cultivate practical maturity and financial independence.\n\nOn the other hand, prolonged absence from academic rigor might erode study habits and delay graduation.\n\nIn my perspective, the personal and professional advantages of a structured gap year convincingly outweigh any potential drawbacks.';

    const paddedIeltsEssay = new Array(220).fill('academic development').join(' ') + '\n\n' + benchmarkEssayIelts;

    const runs = 5;
    const bands: number[] = [];

    for (let i = 0; i < runs; i++) {
      const evalResult = await evaluateIeltsTask2('Gap year advantages and disadvantages', paddedIeltsEssay);
      expect(evalResult.scoreLabel).toBe('LexiFlow estimate');
      bands.push(parseFloat(evalResult.overallScore));
    }

    const mean = bands.reduce((a, b) => a + b, 0) / bands.length;
    const variance = bands.reduce((sum, b) => sum + Math.pow(b - mean, 2), 0) / bands.length;

    // IELTS band variance must be <= 0.25 band
    expect(variance).toBeLessThanOrEqual(0.25);
  });

  it('3. Guarantees deterministic zero Form variance on invalid inputs', async () => {
    // Exactly 0 variance guaranteed on deterministic failure paths
    const shortPte = 'Too short.';
    const result1 = await evaluatePteEssay('Prompt', shortPte);
    const result2 = await evaluatePteEssay('Prompt', shortPte);

    expect(result1.overallScore).toBe('10');
    expect(result2.overallScore).toBe('10');
    expect(result1.errorCodes).toEqual(result2.errorCodes);
  });
});
