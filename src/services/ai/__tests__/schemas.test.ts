import { describe, it, expect } from 'vitest';
import {
  WordAnalysisSchema,
  PhraseAnalysisSchema,
  SentenceAnalysisSchema,
  ParagraphAnalysisSchema,
  WritingAssistSchema,
  FollowUpResponseSchema
} from '../schemas';
import { MockAIProvider } from '../mockProvider';

describe('AI-Native Output Validation & Schemas', () => {
  const mockProvider = new MockAIProvider();

  it('validates contextual Word Analysis schema and Bengali interpretation', async () => {
    const res = await mockProvider.analyze(
      'scrutiny',
      'word',
      'The government policy came under intense scrutiny.',
      'Public officials welcomed the move.'
    );

    const parsed = WordAnalysisSchema.safeParse(res);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.selectedText).toBe('scrutiny');
      expect(parsed.data.selectionType).toBe('word');
      expect(parsed.data.bengaliTranslation).toBeTruthy();
      expect(parsed.data.whyFitsContext).toBeTruthy();
      expect(parsed.data.collocations.length).toBeGreaterThan(0);
      expect(parsed.data.exampleBengali).toBeTruthy();
    }
  });

  it('parses exampleBengali and variations in WordAnalysisSchema', () => {
    const parsed1 = WordAnalysisSchema.parse({
      selectedText: 'inflicted',
      examples: ['The storm inflicted severe damage on the coastal village.'],
      exampleBengali: 'ঝড়টি উপকূলীয় গ্রামে মারাত্মক ক্ষয়ক্ষতি সাধন করেছিল।'
    });
    expect(parsed1.exampleBengali).toBe('ঝড়টি উপকূলীয় গ্রামে মারাত্মক ক্ষয়ক্ষতি সাধন করেছিল।');

    const parsed2 = WordAnalysisSchema.parse({
      selectedText: 'inflicted',
      examples: ['The storm inflicted severe damage on the coastal village.'],
      exampleTranslation: 'ঝড়টি উপকূলীয় গ্রামে মারাত্মক ক্ষয়ক্ষতি সাধন করেছিল।'
    });
    expect(parsed2.exampleBengali).toBe('ঝড়টি উপকূলীয় গ্রামে মারাত্মক ক্ষয়ক্ষতি সাধন করেছিল।');
  });

  it('validates Phrase Analysis schema for phrasal verbs, idioms, and collocations', async () => {
    const res = await mockProvider.analyze(
      'figure out',
      'phrase',
      'They need to figure out a better solution.',
      ''
    );

    const parsed = PhraseAnalysisSchema.safeParse(res);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.selectedText).toBe('figure out');
      expect(parsed.data.selectionType).toBe('phrase');
      expect(parsed.data.overallMeaning).toBeTruthy();
      expect(parsed.data.literalVsFigurative).toBeTruthy();
    }
  });

  it('validates Sentence X-Ray syntactic breakdown and Bengali translation', async () => {
    const res = await mockProvider.analyze(
      'Although inflation increased rapidly, the central bank maintained steady interest rates.',
      'sentence'
    );

    const parsed = SentenceAnalysisSchema.safeParse(res);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.clauses.length).toBeGreaterThan(0);
      expect(parsed.data.bengaliTranslation).toBeTruthy();
      expect(parsed.data.plainEnglishParaphrase).toBeTruthy();
    }
  });

  it('validates Paragraph Intelligence schema', async () => {
    const res = await mockProvider.analyze(
      'Artificial intelligence continues to evolve at breakneck speed. Researchers around the globe are developing more efficient models. This shift promises to reshape multiple industries.',
      'paragraph'
    );

    const parsed = ParagraphAnalysisSchema.safeParse(res);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.mainIdea).toBeTruthy();
      expect(parsed.data.conciseSummary).toBeTruthy();
      expect(parsed.data.bengaliTranslation).toBeTruthy();
    }
  });

  it('validates AI Writing Assistance goals and suggestions', async () => {
    const res = await mockProvider.assistWriting(
      'The results show bad quality because of errors.',
      'academic'
    );

    const parsed = WritingAssistSchema.safeParse(res);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.improvedText).toBeTruthy();
      expect(parsed.data.changesExplanation).toBeTruthy();
      expect(parsed.data.bengaliExplanation).toBeTruthy();
    }
  });

  it('validates Follow-Up Q&A response schema', async () => {
    const res = await mockProvider.askFollowUp(
      'scrutiny',
      'The policy came under intense scrutiny.',
      'Can I use scrutiny in a positive tone?'
    );

    const parsed = FollowUpResponseSchema.safeParse(res);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.question).toContain('positive');
      expect(parsed.data.answer).toBeTruthy();
      expect(parsed.data.bengaliSummary).toBeTruthy();
    }
  });
});
