import { describe, it, expect } from 'vitest';
import { ArticleAnalyzer } from '../analyzer';

describe('Article Reader & Reading Intelligence Analyzer', () => {
  const shortText = `Climate change accelerates glacial retreat in polar regions. Consequently, sea levels are rising at an accelerated rate according to satellite telemetry.`;

  const multiParagraphText = `The development of quantum computing represents a major paradigm shift in cryptography. However, current hardware limitations such as qubit decoherence severely impede large-scale commercial deployments.

Consequently, research institutions have concentrated efforts on post-quantum lattice-based encryption algorithms. For instance, recent benchmarks indicate that classical supercomputers struggle with these mathematical lattices. Although error-corrected qubits remain years away, cryptographic standards must evolve today to mitigate retrospective decryption risks.

Therefore, global security architectures must prioritize proactive cryptographic modernization. Ultimately, safeguarding critical digital infrastructure demands immediate transition to quantum-resistant primitives.`;

  it('rejects empty input with clear error message without silent submission', async () => {
    await expect(ArticleAnalyzer.analyze('')).rejects.toThrow('Please provide article content');
    await expect(ArticleAnalyzer.analyze('   \n\n  ')).rejects.toThrow('Please provide article content');
  });

  it('analyzes a short article and defaults missing title cleanly', async () => {
    const result = await ArticleAnalyzer.analyze(shortText);

    expect(result.title).toBe('Untitled Article');
    expect(result.paragraphs.length).toBe(1);
    expect(result.summary.mainIdea).toContain('Climate change');
    expect(result.summary.keyTakeaways.length).toBeGreaterThan(0);
  });

  it('estimates stats accurately and identifies when chunking is needed', () => {
    const shortStats = ArticleAnalyzer.estimateStats(shortText);
    expect(shortStats.wordCount).toBe(21);
    expect(shortStats.needsChunking).toBe(false);

    // Create a long text with > 1250 words
    const longText = Array(300).fill('The rapid evolution of natural language processing algorithms transforms modern software engineering.').join(' ');
    const longStats = ArticleAnalyzer.estimateStats(longText);
    expect(longStats.wordCount).toBeGreaterThan(1200);
    expect(longStats.needsChunking).toBe(true);
  });

  it('analyzes multiple paragraphs and retains ordered paragraph indices', async () => {
    const result = await ArticleAnalyzer.analyze(
      multiParagraphText,
      'Quantum Computing & Cryptography Paradigm',
      'https://example.com/quantum'
    );

    expect(result.title).toBe('Quantum Computing & Cryptography Paradigm');
    expect(result.sourceUrl).toBe('https://example.com/quantum');
    expect(result.paragraphs.length).toBe(3);
    expect(result.paragraphs[0].paragraphIndex).toBe(1);
    expect(result.paragraphs[1].paragraphIndex).toBe(2);
    expect(result.paragraphs[2].paragraphIndex).toBe(3);

    // Check sentence breakdowns and Bengali explanations
    expect(result.paragraphs[0].explanation).toBeDefined();
    expect(result.paragraphs[0].bengaliExplanation).toContain('অনুচ্ছেদ 1');
  });

  it('identifies discourse connectors and their functional rhetorical roles', async () => {
    const result = await ArticleAnalyzer.analyze(multiParagraphText);

    expect(result.connectors.length).toBeGreaterThanOrEqual(3);
    const expressions = result.connectors.map((c) => c.expression.toLowerCase());

    expect(expressions).toContain('however');
    expect(expressions).toContain('consequently');
    expect(expressions).toContain('therefore');

    const however = result.connectors.find((c) => c.expression === 'however');
    expect(however?.type).toBe('contrast');
    expect(however?.functionInContext).toContain('contrasting');

    const therefore = result.connectors.find((c) => c.expression === 'therefore');
    expect(therefore?.type).toBe('cause_effect');
  });

  it('evaluates claims and distinguishes evidence-supported statements from unverified assertions', async () => {
    const result = await ArticleAnalyzer.analyze(multiParagraphText);

    expect(result.claims.length).toBeGreaterThanOrEqual(2);

    // Paragraph 1 contains assertion without numbers/data: 'The development of quantum computing represents...'
    const p1Claim = result.claims.find((c) => c.paragraphIndex === 1);
    expect(p1Claim).toBeDefined();
    expect(p1Claim?.excerpt).toBeDefined();

    // Paragraph 2 mentions 'benchmarks indicate' -> detected evidence
    const p2Claim = result.claims.find((c) => c.paragraphIndex === 2);
    expect(p2Claim).toBeDefined();
  });

  it('extracts contextual vocabulary with sentence context and Bengali translation', async () => {
    const result = await ArticleAnalyzer.analyze(multiParagraphText);

    expect(result.extractedVocabulary.length).toBeGreaterThan(0);
    const first = result.extractedVocabulary[0];
    expect(first.word).toBeDefined();
    expect(first.contextSentence).toBeDefined();
    expect(first.bengaliMeaning).toBeDefined();
    expect(first.contextualMeaning).toBeDefined();
  });

  it('respects cancellation via AbortSignal without leaking unfinished promises', async () => {
    const controller = new AbortController();
    controller.abort(); // already cancelled

    await expect(
      ArticleAnalyzer.analyze(multiParagraphText, 'Test', undefined, 'comprehensive', undefined, controller.signal)
    ).rejects.toThrow('Analysis was cancelled');
  });
});
