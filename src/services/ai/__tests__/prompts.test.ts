import { describe, it, expect } from 'vitest';
import {
  PROMPT_VERSION,
  buildStageAPrompt,
  buildStageACorrection,
  buildStageBPrompt,
  buildStageBCorrection,
  buildAnalyzePrompt,
  buildWritingAssistPrompt,
  buildFollowUpPrompt,
  buildHighlightsPrompt,
  withJsonOnlyReminder,
  toSinglePrompt
} from '../prompts';

const ctx = 'They remained resilient during challenging times.';

describe('shared prompt builders', () => {
  it('builds Stage A with the trimmed target, context and a 300-char paragraph cap', () => {
    const spec = buildStageAPrompt(
      { text: '  resilient ', contextSentence: ctx, paragraphContext: 'p'.repeat(500) },
      'bn'
    );
    expect(spec.maxTokens).toBe(550);
    expect(spec.system).toContain('"selectedText": "resilient"');
    expect(spec.user).toBe(`Target: "resilient"\nSentence Context: "${ctx}"\nParagraph Context: "${'p'.repeat(300)}"`);
  });

  it('builds Stage B with a lowercased lemma, defaults and the full register enum', () => {
    const spec = buildStageBPrompt({ lemma: ' Resilient ' }, 'bn');
    expect(spec.maxTokens).toBe(2500);
    expect(spec.user).toBe('Word: "resilient"\nPart of Speech: "word"\nContextual Sense ID: "sense_1"');
    expect(spec.system).toContain('"registerOrType": "standard" | "literal" | "figurative" | "technical" | "idiomatic"');
  });

  it('follows the target language instead of hardcoding Bengali', () => {
    const bn = buildStageAPrompt({ text: 'resilient' }, 'bn');
    const hi = buildStageAPrompt({ text: 'resilient' }, 'hi');
    expect(bn.system).toContain('সহজ বাংলা');
    expect(hi.system).toContain('सरल हिन्दी');
    // Field names like "easyBengali" stay; only Bengali-language instructions must disappear.
    expect(hi.system).not.toMatch(/[ঀ-৿]/);
  });

  it('uses the detailed 9-layer sentence prompt only for the full set', () => {
    const input = { text: ctx, type: 'sentence' as const, contextSentence: ctx, paragraphContext: 'para' };
    const full = buildAnalyzePrompt(input, 'bn', 'full');
    const compact = buildAnalyzePrompt(input, 'bn', 'compact');

    expect(full.system).toContain('9-layer learning breakdown');
    expect(full.user).toBe(`Sentence: ${ctx}`);
    expect(compact.system).not.toContain('9-layer');
    expect(compact.user).toBe(`Text: ${ctx}\nType: sentence\nSentence: ${ctx}\nParagraph: para`);
    expect(full.maxTokens).toBe(3500);
  });

  it.each(['word', 'phrase', 'sentence', 'paragraph'] as const)('builds a %s analysis prompt for both sets', (type) => {
    for (const detail of ['full', 'compact'] as const) {
      const spec = buildAnalyzePrompt({ text: 'resilient', type }, 'bn', detail);
      expect(spec.system).toContain(`"selectionType": "${type}"`);
      expect(spec.maxTokens).toBe(type === 'word' || type === 'phrase' ? 650 : 3500);
    }
  });

  it('builds writing, follow-up and highlights prompts', () => {
    const writing = buildWritingAssistPrompt({ text: 'me go school', goal: 'natural' }, 'bn', 'compact');
    expect(writing.system).toContain('"originalText": "me go school"');
    expect(writing.user).toBe('me go school');

    const followUp = buildFollowUpPrompt({ text: 'resilient', context: ctx, question: 'Why?' }, 'bn', 'full');
    expect(followUp.user).toBe(`Text: resilient\nContext: ${ctx}\nQuestion: Why?`);
    expect(followUp.system).toContain('"question": "Why?"');

    const long = 'a'.repeat(20000);
    const highlights = buildHighlightsPrompt({ rawText: long, pageTitle: 'Title' }, 'bn', 'full');
    expect(highlights.user).toBe(`Article Content:\n${'a'.repeat(15000)}`);
    expect(highlights.system).toContain('"pageTitle": "Title"');

    const compactHighlights = buildHighlightsPrompt({ rawText: 'Body.' }, 'bn', 'compact');
    expect(compactHighlights.system).toContain('"pageTitle": "Webpage Article"');
    expect(compactHighlights.user).toBe('Article:\n"""\nBody.\n"""');
  });

  it('builds retry prompts and joins single prompts for Ollama', () => {
    expect(withJsonOnlyReminder('U')).toBe('U\n\nCRITICAL: Output ONLY valid JSON.');
    expect(buildStageACorrection('U', ['a', 'b'], 'bn')).toBe(
      'U\n\nYour previous response had validation errors:\na\nb\nPlease correct these errors and ensure "Bengali" explanation and all required fields are present.'
    );
    expect(buildStageBCorrection('U', ['a'], 'bn')).toContain('all Bengali fields are accurate');
    expect(toSinglePrompt({ system: 'S', user: 'U' })).toBe('S\nU');
    expect(PROMPT_VERSION).toBe('v1');
  });
});
