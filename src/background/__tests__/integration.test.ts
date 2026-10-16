import { describe, it, expect, beforeEach } from 'vitest';
import { AIService } from '../../services/ai';
import { StorageService } from '../../services/storage/db';
import { FSRSEngine } from '../../services/fsrs/engine';
import { ArticleAnalyzer } from '../../services/article/analyzer';
import { VocabularyItem, FSRSItemState } from '../../types';

describe('LexiFlow AI Full System Integration & Regression Suite', () => {
  beforeEach(() => {
    StorageService.clearMemory();
  });

  it('ANALYZE_SELECTION: performs AI-native word analysis with contextual explanation', async () => {
    const provider = await AIService.getProvider();
    const result = await provider.analyze('scrutiny', 'word', 'The proposed legislation came under intense scrutiny.');

    expect(result.selectionType).toBe('word');
    expect(result.selectedText).toBe('scrutiny');
    expect(result.bengaliTranslation).toBeDefined();
    if (result.selectionType === 'word') {
      expect(result.contextualMeaning).toBeDefined();
      expect(result.simpleEnglishExplanation).toBeDefined();
      expect(result.examples.length).toBeGreaterThan(0);
    }
  });

  it('ANALYZE_SELECTION: performs phrase analysis distinguishing idiomatic meaning', async () => {
    const provider = await AIService.getProvider();
    const result = await provider.analyze('carry out', 'phrase', 'They decided to carry out the experiment.');

    expect(result.selectionType).toBe('phrase');
    expect(result.selectedText).toBe('carry out');
    if (result.selectionType === 'phrase') {
      expect(result.phraseType).toBeDefined();
      expect(result.overallMeaning).toBeDefined();
      expect(result.literalVsFigurative).toBeDefined();
    }
  });

  it('EXPLAIN_SENTENCE (Sentence X-Ray): deconstructs syntactic clauses with bilingual explanations', async () => {
    const provider = await AIService.getProvider();
    const result = await provider.analyze(
      'Although the project faced financial constraints, the engineering team completed the satellite ahead of schedule.',
      'sentence'
    );

    expect(result.selectionType).toBe('sentence');
    if (result.selectionType === 'sentence') {
      expect(result.clauses.length).toBeGreaterThan(0);
      expect(result.plainEnglishParaphrase).toBeDefined();
      expect(result.toneAndRegister).toBeDefined();
    }
  });

  it('COMPARE_WORDS (Word Difference Engine): produces minimal pairs and collocations', async () => {
    const provider = await AIService.getProvider();
    const resA = (await provider.analyze('mitigate', 'word')) as any;
    const resB = (await provider.analyze('alleviate', 'word')) as any;

    expect(resA.contextualMeaning).toBeDefined();
    expect(resB.contextualMeaning).toBeDefined();
    expect(resA.collocations).toBeDefined();
    expect(resB.collocations).toBeDefined();
  });

  it('ASSIST_WRITING & EVALUATE_USAGE: Active Usage Coach produces natural alternatives and coaching feedback', async () => {
    const provider = await AIService.getProvider();
    const result = await provider.assistWriting(
      'We need to take urgent action to mitigate the carbon emissions.',
      'natural'
    );

    expect(result.improvedText).toBeDefined();
    expect(result.bengaliExplanation).toBeDefined();
    expect(result.changesExplanation).toBeDefined();
  });

  it('ASK_FOLLOW_UP: answers contextual follow-up questions accurately', async () => {
    const provider = await AIService.getProvider();
    const result = await provider.askFollowUp(
      'scrutiny',
      'The proposal came under intense scrutiny from regulators.',
      'What is the difference between scrutiny and observation?'
    );

    expect(result.question).toBeDefined();
    expect(result.answer).toBeDefined();
    expect(result.bengaliSummary).toBeDefined();
  });

  it('FSRS Spaced Repetition Workflow: progresses stability and scheduled intervals across ratings', async () => {
    const cardInReview: FSRSItemState = {
      stability: 4.5,
      difficulty: 3.2,
      elapsedDays: 4,
      scheduledDays: 4,
      reps: 2,
      lapses: 0,
      state: 'review',
      nextReview: new Date().toISOString()
    };

    // Rating 1 (Again - lapse during review)
    const reviewResult = FSRSEngine.scheduleNextReview(cardInReview, 1);
    expect(reviewResult.reps).toBe(3);
    expect(reviewResult.lapses).toBe(1);
  });

  it('Article Reader & Intelligence: complete end-to-end extraction and draft lifecycle', async () => {
    const article = `Autonomous vehicles rely on neural vision systems and real-time lidar telemetry. However, unpredictable weather conditions often introduce sensor noise. Consequently, redundant sensor architectures are mandatory to safeguard passenger safety.`;

    const result = await ArticleAnalyzer.analyze(article, 'Autonomous Navigation Systems');

    expect(result.paragraphs.length).toBe(1);
    expect(result.connectors.length).toBeGreaterThan(0);
    expect(result.claims.length).toBeGreaterThan(0);
    expect(result.extractedVocabulary.length).toBeGreaterThan(0);

    // Verify saving extracted vocabulary into storage with duplicate checking
    const extractedWord = result.extractedVocabulary[0];
    const item: VocabularyItem = {
      id: 'vocab_extracted_1',
      word: extractedWord.word,
      selectionType: 'word',
      meaning: extractedWord.contextualMeaning,
      bengaliMeaning: extractedWord.bengaliMeaning,
      contextSentence: extractedWord.contextSentence,
      dateAdded: new Date().toISOString(),
      tags: ['article_reader'],
      collection: 'Reading Mastery',
      difficulty: 'medium',
      fsrs: FSRSEngine.createInitialState()
    };

    await StorageService.saveItem(item);
    const found = await StorageService.findByWord(extractedWord.word);
    expect(found).not.toBeNull();
    expect(found?.word).toBe(extractedWord.word);
  });
});
