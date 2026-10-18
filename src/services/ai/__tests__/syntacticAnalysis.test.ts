import { describe, it, expect } from 'vitest';
import { MockAIProvider } from '../mockProvider';
import { SyntaxEngine } from '../../grammar/syntaxEngine';
import { SentenceAnalysisSchema } from '../schemas';

describe('Syntactic Structure, Clause Breakdown & Conversational Language Engine', () => {
  const provider = new MockAIProvider();

  describe('Regression Test Sentence', () => {
    const regressionSentence = 'The Tesla boss revealed arguably his greatest invention, sorry product.';

    it('identifies exactly 1 independent clause and classifies sentence as simple', async () => {
      const result = await provider.analyze(regressionSentence, 'sentence') as any;

      expect(result.selectionType).toBe('sentence');
      expect(result.sentenceStructure.type).toBe('simple');
      expect(result.clauses.length).toBe(1);
      expect(result.clauses[0].type).toBe('main');
      expect(result.clauses[0].standalone).toBe('Yes (forms a complete grammatical sentence)');
    });

    it('correctly identifies the subject, main verb, and object noun phrase with bilingual explanations', async () => {
      const result = await provider.analyze(regressionSentence, 'sentence') as any;
      const mainClause = result.clauses[0];

      // Subject
      expect(mainClause.subject).toBe('The Tesla boss');
      expect(mainClause.subjectExplanation).toContain('The agent or entity performing the action');
      expect(mainClause.subjectExplanationBengali).toContain('উদ্দেশ্য বা কর্তা');

      // Main verb
      expect(mainClause.verb).toBe('revealed');
      expect(mainClause.verbPhrase).toBe('revealed');
      expect(mainClause.verbExplanation).toContain('transitive verb');
      expect(mainClause.verbExplanationBengali).toContain('সকর্মক সমাপিকা ক্রিয়া');

      // Object Noun Phrase
      expect(mainClause.directObject).toContain('greatest invention');
      expect(mainClause.directObjectExplanation).toContain('Object noun phrase');
      expect(mainClause.directObjectExplanationBengali).toContain('কর্ম পদবন্ধ');
    });

    it('identifies and explains "arguably" as an evaluative stance adverb', async () => {
      const result = await provider.analyze(regressionSentence, 'sentence') as any;

      // Adverbial inside clause or conversational elements
      const hasAdverbial = result.clauses[0].adverbials?.some((a: any) => a.text.toLowerCase().includes('arguably'));
      const hasStanceMarker = result.conversationalElements?.some((e: any) => e.text.toLowerCase().includes('arguably'));
      expect(hasAdverbial || hasStanceMarker).toBe(true);

      const phraseConstituent = result.phraseConstituents?.find((p: any) => p.phrase.includes('invention'));
      expect(phraseConstituent).toBeDefined();

      const adverbComp = phraseConstituent.components.find((c: any) => c.text === 'arguably');
      expect(adverbComp).toBeDefined();
      expect(adverbComp.role).toBe('adverb');
      expect(adverbComp.roleLabel).toContain('Adverb');
      expect(adverbComp.explanation).toContain('Modifies');
      expect(adverbComp.roleBengali).toContain('ক্রিয়া-বিশেষণ');
    });

    it('recognizes conversational self-correction ("sorry product") WITHOUT inventing a separate clause', async () => {
      const result = await provider.analyze(regressionSentence, 'sentence') as any;

      // Must NOT create a clause for "sorry product"
      expect(result.clauses.some((c: any) => c.text.trim().toLowerCase() === 'sorry product')).toBe(false);
      expect(result.clauses.some((c: any) => c.text.trim().toLowerCase() === 'sorry product.')).toBe(false);

      // Must be captured in conversationalElements
      const selfCorrection = result.conversationalElements?.find((e: any) => e.type === 'self_correction');
      expect(selfCorrection).toBeDefined();
      expect(selfCorrection.text).toContain('sorry product');
      expect(selfCorrection.targetOriginal).toBe('invention');
      expect(selfCorrection.correctedTo).toBe('product');
      expect(selfCorrection.explanation).toContain('initially uses "invention" and then immediately corrects it to "product"');
      expect(selfCorrection.explanationBengali).toContain('বক্তা প্রথমে "invention"');
    });

    it('strictly separates grammatical analysis from external context (no SpaceX, McGregor, Roadster hallucinations)', async () => {
      const result = await provider.analyze(regressionSentence, 'sentence') as any;
      const serialized = JSON.stringify(result).toLowerCase();

      expect(serialized).not.toContain('spacex');
      expect(serialized).not.toContain('mcgregor');
      expect(serialized).not.toContain('texas');
      expect(serialized).not.toContain('roadster');

      // Vocabulary items must only be words present in the sentence
      for (const vocab of result.difficultVocabulary) {
        expect(regressionSentence.toLowerCase()).toContain(vocab.word.toLowerCase());
      }
    });

    it('passes schema validation for full SentenceAnalysisSchema', async () => {
      const result = await provider.analyze(regressionSentence, 'sentence');
      const validation = SentenceAnalysisSchema.safeParse(result);
      expect(validation.success).toBe(true);
    });
  });

  describe('Comprehensive Sentence Types & Clause Structures', () => {
    it('Simple sentence with transitive verb and adverbial modifier', () => {
      const text = 'The engineer completed the task without hesitation.';
      const analysis = SyntaxEngine.analyze(text, 'bn');

      expect(analysis.structureOverview.type).toBe('simple');
      expect(analysis.clauses.length).toBe(1);
      expect(analysis.clauses[0].type).toBe('main');
      expect(analysis.clauses[0].subject).toBe('The engineer');
      expect(analysis.clauses[0].verb).toBe('completed');
    });

    it('Compound sentence: joins two independent clauses with coordinating conjunction', () => {
      const text = 'She analyzed the dataset, but he wrote the final report.';
      const analysis = SyntaxEngine.analyze(text, 'bn');

      expect(analysis.structureOverview.type).toBe('compound');
      expect(analysis.clauses.length).toBe(2);
      expect(analysis.clauses[0].type).toBe('main');
      expect(analysis.clauses[1].type).toBe('main');
      expect(analysis.clauses[0].canStandAlone).toBe(true);
      expect(analysis.clauses[1].canStandAlone).toBe(true);
    });

    it('Complex sentence with subordinate adverbial concession clause', () => {
      const text = 'Although the team faced unexpected technical hurdles, they successfully verified the hypothesis.';
      const analysis = SyntaxEngine.analyze(text, 'bn');

      expect(analysis.structureOverview.type).toBe('complex');
      expect(analysis.clauses.length).toBe(2);

      const subClause = analysis.clauses.find(c => c.type === 'subordinate');
      const mainClause = analysis.clauses.find(c => c.type === 'main');

      expect(subClause).toBeDefined();
      expect(subClause!.text).toContain('Although the team faced unexpected technical hurdles');
      expect(subClause!.canStandAlone).toBe(false);

      expect(mainClause).toBeDefined();
      expect(mainClause!.text).toContain('they successfully verified the hypothesis');
      expect(mainClause!.canStandAlone).toBe(true);
    });

    it('Compound-complex sentence: contains 2 independent clauses and 1 subordinate clause', () => {
      // Tested via structure classifier logic
      const text = 'Although the team faced hurdles, they completed the mission, and they presented the results.';
      const analysis = SyntaxEngine.analyze(text, 'bn');

      expect(['complex', 'compound-complex']).toContain(analysis.structureOverview.type);
      expect(analysis.clauses.some(c => c.type === 'subordinate')).toBe(true);
    });

    it('Sentence with relative clause modifying antecedent noun', () => {
      const text = 'The scientist who discovered the anomaly received an international award.';
      const analysis = SyntaxEngine.analyze(text, 'bn');

      expect(analysis.structureOverview.type).toBe('complex');
      const relClause = analysis.clauses.find(c => c.type === 'relative');
      expect(relClause).toBeDefined();
      expect(relClause!.text).toContain('who discovered the anomaly');
      expect(relClause!.canStandAlone).toBe(false);
    });

    it('Sentence with noun clause as direct object', () => {
      const text = 'Researchers revealed that renewable energy will replace fossil fuels.';
      const analysis = SyntaxEngine.analyze(text, 'bn');

      expect(analysis.structureOverview.type).toBe('complex');
      const nounClause = analysis.clauses.find(c => c.type === 'noun');
      expect(nounClause).toBeDefined();
      expect(nounClause!.text).toContain('that renewable energy will replace fossil fuels');
    });

    it('Linking verb with subject complement', () => {
      const text = 'The new software became the industry benchmark.';
      const analysis = SyntaxEngine.analyze(text, 'bn');

      expect(analysis.clauses[0].complement).toBe('the industry benchmark');
      expect(analysis.clauses[0].complementType).toBe('subject_complement');
      expect(analysis.clauses[0].clausePattern).toBe('S + V + C');
    });

    it('Ditransitive verb with indirect and direct objects', () => {
      const text = 'The director offered the candidate a lucrative position.';
      const analysis = SyntaxEngine.analyze(text, 'bn');

      expect(analysis.clauses[0].indirectObject).toBe('the candidate');
      expect(analysis.clauses[0].directObject).toBe('a lucrative position');
      expect(analysis.clauses[0].clausePattern).toBe('S + V + IO + DO');
    });

    it('Handles parenthetical expressions and discourse markers without creating spurious clauses', () => {
      const text = 'To be honest, the new prototype performed remarkably well.';
      const analysis = SyntaxEngine.analyze(text, 'bn');

      expect(analysis.conversationalElements.some(e => e.type === 'parenthetical')).toBe(true);
      expect(analysis.clauses.length).toBe(1);
    });
  });

  describe('Pedagogical Learning Sequence Completeness', () => {
    it('produces 7-step learning components for any sentence analysis', async () => {
      const sentence = 'The Tesla boss revealed arguably his greatest invention, sorry product.';
      const result = await provider.analyze(sentence, 'sentence') as any;

      // 1. Original sentence
      expect(result.selectedText).toBe(sentence);

      // 2. Sentence type and overall structure
      expect(result.sentenceStructure?.type).toBeDefined();
      expect(result.sentenceStructure?.explanation).toBeDefined();
      expect(result.sentenceStructure?.explanationBengali).toBeDefined();

      // 3. Clause breakdown
      expect(result.clauses?.length).toBeGreaterThan(0);
      expect(result.clauses[0].role).toBeDefined();

      // 4. SVO syntactic constituents
      expect(result.clauses[0].subject).toBeDefined();
      expect(result.clauses[0].verb).toBeDefined();

      // 5. Phrase-level and conversational repairs
      expect(result.phraseConstituents?.length).toBeGreaterThan(0);
      expect(result.conversationalElements?.length).toBeGreaterThan(0);

      // 6. Difficult words and key terms with grammatical roles
      expect(result.difficultVocabulary?.length).toBeGreaterThan(0);
      expect(result.difficultVocabulary[0].grammaticalRole).toBeDefined();

      // 7. Reusable pattern summary
      expect(result.patternSummary?.formula).toBeDefined();
      expect(result.patternSummary?.explanation).toBeDefined();
      expect(result.patternSummary?.explanationBengali).toBeDefined();
    });
  });

  describe('Estelle Ravenscroft Regression Suite (Grammar & Clause Breakdown)', () => {
    const targetSentence = 'Estelle Ravenscroft, 79, from Busselton, about 220km south of Perth, was holidaying on the Indonesian island when she slipped and fell into an open stairwell';

    it('classifies sentence as complex with 1 independent clause and 1 dependent adverbial clause of time', () => {
      const analysis = SyntaxEngine.analyze(targetSentence, 'bn');

      expect(analysis.structureOverview.type).toBe('complex');
      expect(analysis.structureOverview.explanation).toContain('one independent clause and one dependent adverbial clause');
      expect(analysis.clauses.length).toBe(2);
    });

    it('Main Clause grammatical analysis: exact NP subject, verb phrase, past continuous, adverbial, and S + V + A pattern', () => {
      const analysis = SyntaxEngine.analyze(targetSentence, 'bn');
      const mainClause = analysis.clauses.find(c => c.type === 'main')!;

      expect(mainClause).toBeDefined();
      expect(mainClause.text).toContain('Estelle Ravenscroft, 79, from Busselton, about 220km south of Perth, was holidaying on the Indonesian island');
      expect(mainClause.subject).toContain('Estelle Ravenscroft, 79, from Busselton, about 220km south of Perth');
      expect(mainClause.verbPhrase).toBe('was holidaying');
      expect(mainClause.tenseAspect).toBe('Past Continuous (Past Progressive)');
      expect(mainClause.directObject).toBeUndefined();
      expect(mainClause.complement).toBeUndefined();
      expect(mainClause.clausePattern).toBe('Subject + Verb + Adverbial (S + V + A)');

      const adverbial = mainClause.adverbials?.find(a => a.text.includes('on the Indonesian island'));
      expect(adverbial).toBeDefined();
      expect(adverbial!.explanation.toLowerCase()).toContain('location');
    });

    it('identifies relevant grammar features: appositive age 79, geographic origin, and past continuous', () => {
      const analysis = SyntaxEngine.analyze(targetSentence, 'bn');
      const features = analysis.relevantGrammarFeatures || [];

      expect(features.some(f => f.feature.includes('Appositive') && f.text === '79')).toBe(true);
      expect(features.some(f => f.feature.includes('location') && f.text?.includes('from Busselton'))).toBe(true);
      expect(features.some(f => f.feature.includes('Past Continuous') && f.text === 'was holidaying')).toBe(true);
    });

    it('Dependent Clause: exact text, Adverbial Clause of Time, when subordinator, coordinated verbs, adverbial phrase', () => {
      const analysis = SyntaxEngine.analyze(targetSentence, 'bn');
      const depClause = analysis.clauses.find(c => c.type === 'subordinate')!;

      expect(depClause).toBeDefined();
      expect(depClause.text).toContain('when she slipped and fell into an open stairwell');
      expect(depClause.category).toBe('Adverbial Clause of Time');
      expect(depClause.subordinator).toBe('when');
      expect(depClause.subject).toBe('she');
      expect(depClause.verbPhrase).toBe('slipped and fell');
      expect(depClause.coordinatedVerbs).toEqual(['slipped', 'fell']);
      expect(depClause.adverbialPhrase).toContain('into an open stairwell');
      expect(depClause.functionDescription).toContain('Specifies the event that occurred during the background situation');
    });

    it('Clause Relationship: formula and bilingual explanation', () => {
      const analysis = SyntaxEngine.analyze(targetSentence, 'bn');
      expect(analysis.clauseRelationship).toBeDefined();
      expect(analysis.clauseRelationship!.formula).toBe('Main Clause + when + Dependent Adverbial Clause of Time');
      expect(analysis.clauseRelationship!.explanation).toContain('The main clause establishes the background situation');
      expect(analysis.clauseRelationship!.explanationBengali).toBeDefined();
    });

    it('Vocabulary contains difficult words from input without hallucinating outside words', () => {
      const analysis = SyntaxEngine.analyze(targetSentence, 'bn');
      const words = analysis.difficultVocabulary.map(v => v.word.toLowerCase());

      expect(words).toContain('holidaying');
      expect(words).toContain('slipped');
      expect(words).toContain('stairwell');
    });

    it('Validates MockProvider output and SentenceAnalysisSchema for Estelle Ravenscroft', async () => {
      const result = await provider.analyze(targetSentence, 'sentence') as any;
      const parsed = SentenceAnalysisSchema.safeParse(result);
      expect(parsed.success).toBe(true);

      expect(result.sentenceStructure.type).toBe('complex');
      expect(result.clauseRelationship?.formula).toContain('Main Clause + when + Dependent Adverbial Clause of Time');
      expect(result.clauses.length).toBe(2);
      expect(result.clauses[0].tenseAspect).toBe('Past Continuous (Past Progressive)');
      expect(result.clauses[1].category).toBe('Adverbial Clause of Time');
      expect(result.clauses[1].coordinatedVerbs).toEqual(['slipped', 'fell']);
    });
  });
});

