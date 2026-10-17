import { describe, it, expect } from 'vitest';
import {
  SentenceAnalysisSchema,
  SentenceStructureOverviewSchema,
  PhraseExplanationSchema,
  SyntacticClauseSchema,
  SentenceStructureMapSchema,
  GrammarRuleDetailSchema,
  ConnectorRelationshipSchema,
  WordLevelGrammarDetailSchema,
  MistakeAndAlternativeSchema,
  GrammarPracticeSchema,
  HighlightExtractionResultSchema
} from '../schemas';
import { MockAIProvider } from '../mockProvider';

describe('9-Layer Pedagogical Grammar Upgrade Schemas & Mock Provider', () => {
  const mockProvider = new MockAIProvider();

  it('Layer 1: validates SentenceStructureOverviewSchema', () => {
    const validOverview = {
      type: 'complex',
      explanation: 'Contains an independent main clause and one or more subordinate clauses.',
      explanationBengali: 'একটি প্রধান খণ্ডবাক্য এবং এক বা একাধিক আশ্রিত খণ্ডবাক্য নিয়ে গঠিত।'
    };
    const parsed = SentenceStructureOverviewSchema.safeParse(validOverview);
    expect(parsed.success).toBe(true);
  });

  it('Layer 2: validates PhraseExplanationSchema with connection and whyItMatters', () => {
    const validPhrase = {
      phrase: 'Despite growing concerns',
      easyEnglish: 'Even though people were increasingly worried',
      easyBengali: 'ক্রমবর্ধমান উদ্বেগ থাকা সত্ত্বেও',
      grammaticalFunction: 'Prepositional phrase expressing concession',
      connection: 'Connects contrastively to the main action of meeting targets',
      whyItMatters: 'Sets up a tension between adversity and ultimate success',
      simplerExample: 'Despite the heavy rain, we enjoyed the trip.'
    };
    const parsed = PhraseExplanationSchema.safeParse(validPhrase);
    expect(parsed.success).toBe(true);
  });

  it('Layer 3: validates SyntacticClauseSchema with syntactic roles and standalone capacity', () => {
    const validClause = {
      text: 'Although the research team faced unexpected technical hurdles during data collection',
      type: 'subordinate',
      typeExplanation: 'Adverbial clause of concession introduced by "Although"',
      subject: 'the research team',
      verb: 'faced',
      role: 'Adverbial modifier of concession',
      questionAnswered: 'Under what adverse condition did the main event take place?',
      dependsOn: 'they successfully verified the hypothesis',
      canStandAlone: false,
      examplePattern: 'Although he was exhausted, he completed the marathon.',
      explanationBengali: 'শর্তমূলক বা বিপরীতমুখী খণ্ডবাক্য যা মূল কাজের বাধা নির্দেশ করে।'
    };
    const parsed = SyntacticClauseSchema.safeParse(validClause);
    expect(parsed.success).toBe(true);
  });

  it('Layer 4: validates SentenceStructureMapSchema hierarchical tree', () => {
    const validMap = {
      rootMainClause: 'they successfully verified the hypothesis',
      branches: [
        {
          clauseText: 'Although the research team faced unexpected technical hurdles during data collection',
          relationType: 'concession',
          roleInSentence: 'Expresses contrast or unexpected difficulty overcome by main clause'
        },
        {
          clauseText: 'by cross-referencing field observations with historical archives',
          relationType: 'means / manner',
          roleInSentence: 'Explains the exact method used to verify the hypothesis'
        }
      ]
    };
    const parsed = SentenceStructureMapSchema.safeParse(validMap);
    expect(parsed.success).toBe(true);
  });

  it('Layer 5: validates GrammarRuleDetailSchema with 7-part pedagogical formula', () => {
    const validRule = {
      ruleName: 'Concessive Clause with Subordinating Conjunction',
      targetWords: 'Although ... faced',
      whatIsIt: 'A subordinate clause that contrasts with the main clause.',
      whyUsed: 'Highlights that the team overcame hurdles rather than surrendering to them.',
      howItWorks: 'Although + Subject + Verb, Main Clause (Subject + Verb).',
      reusablePattern: 'Although + [Condition/Obstacle], [Unexpected Result].',
      example: {
        english: 'Although it was freezing outside, she went for a morning run.',
        easyEnglish: 'Even though it was cold, she ran.',
        bengali: 'বাইরে তীব্র ঠান্ডা থাকা সত্ত্বেও সে সকালে দৌড়াতে গিয়েছিল।'
      },
      commonConfusion: 'Do not use "but" in the main clause when using "although" (e.g. avoid "Although it rained, but we went").'
    };
    const parsed = GrammarRuleDetailSchema.safeParse(validRule);
    expect(parsed.success).toBe(true);
  });

  it('Layer 6: validates ConnectorRelationshipSchema', () => {
    const validConnector = {
      connector: 'Although',
      meaning: 'Even though; in spite of the fact that',
      pattern: 'Although + Clause (Subject + Verb)',
      logicalRelation: 'concession / contrast',
      contrastWith: 'Despite / In spite of (which require a noun phrase or gerund, not a finite clause).'
    };
    const parsed = ConnectorRelationshipSchema.safeParse(validConnector);
    expect(parsed.success).toBe(true);
  });

  it('Layer 7: validates WordLevelGrammarDetailSchema', () => {
    const validWordGrammar = {
      word: 'cross-referencing',
      partOfSpeech: 'gerund / present participle',
      syntacticRole: 'Object of preposition "by", indicating instrument or method',
      wordForms: ['cross-reference', 'cross-referenced', 'cross-referencing'],
      usageNotes: 'Used transitively with field observations as its direct object.'
    };
    const parsed = WordLevelGrammarDetailSchema.safeParse(validWordGrammar);
    expect(parsed.success).toBe(true);
  });

  it('Layer 8: validates MistakeAndAlternativeSchema', () => {
    const validMistake = {
      studentMisconception: 'Pairing "although" with "but" in the same complex sentence.',
      commonMistake: 'Although they faced hurdles, but they succeeded.',
      correctedSentence: 'Although they faced hurdles, they succeeded.',
      naturalAlternative: 'They faced unexpected hurdles; however, they succeeded.',
      nuanceDifference: 'The alternative with "however" creates two separate balanced statements with a heavier pause.'
    };
    const parsed = MistakeAndAlternativeSchema.safeParse(validMistake);
    expect(parsed.success).toBe(true);
  });

  it('Layer 9: validates GrammarPracticeSchema with interactive options and whyCorrect', () => {
    const validPractice = {
      reusablePattern: 'Although + Subject + Verb, Main Clause',
      question: 'Which of the following sentences correctly expresses concession?',
      options: [
        'Although he was tired, but he finished the homework.',
        'Although he was tired, he finished the homework.',
        'Despite he was tired, he finished the homework.',
        'Although being tired, but he finished the homework.'
      ],
      correctAnswer: 'Although he was tired, he finished the homework.',
      whyCorrect: '"Although" introduces a subordinate clause with a subject ("he") and verb ("was"), and must not be followed by "but" in the main clause.'
    };
    const parsed = GrammarPracticeSchema.safeParse(validPractice);
    expect(parsed.success).toBe(true);
  });

  it('MockAIProvider produces full 9-layer sentence analysis validated by SentenceAnalysisSchema', async () => {
    const sentence = 'Although the research team faced unexpected technical hurdles during data collection, they successfully verified the hypothesis by cross-referencing field observations with historical archives.';
    const result = await mockProvider.analyze(sentence, 'sentence') as any;

    const validation = SentenceAnalysisSchema.safeParse(result);
    expect(validation.success).toBe(true);

    // Verify key 9 layers are populated
    expect(result.sentenceStructure?.type).toBe('complex');
    expect(result.phraseBreakdown && result.phraseBreakdown.length > 0).toBe(true);
    expect(result.clauses && result.clauses.length > 0).toBe(true);
    expect(result.structureMap?.rootMainClause).toBeDefined();
    expect(result.grammarRules && result.grammarRules.length > 0).toBe(true);
    expect(result.connectors && result.connectors.length > 0).toBe(true);
    expect(result.wordLevelGrammar && result.wordLevelGrammar.length > 0).toBe(true);
    expect(result.commonMistakesAndAlternatives?.commonMistake).toBeDefined();
    expect(result.practice?.options.length).toBe(4);
  });

  it('Highlight Extraction: MockAIProvider extracts important words, collocations, and idioms', async () => {
    const article = 'The committee decided to look into the matter. Under close scrutiny, they found nothing. He tried to break the ice with a joke.';
    const extraction = await mockProvider.extractHighlights!(article);

    const validation = HighlightExtractionResultSchema.safeParse(extraction);
    expect(validation.success).toBe(true);

    expect(extraction.items.length).toBeGreaterThanOrEqual(3);
    const categories = extraction.items.map(i => i.type || (i as any).category);
    expect(categories).toContain('word');
    expect(categories).toContain('phrase');
    expect(categories).toContain('idiom');
  });
});
