import {
  SyntacticClause,
  PhraseConstituent,
  PhraseComponent,
  ConversationalElement,
  GrammaticalPatternSummary,
  SentenceStructureOverview,
  SentenceStructureMap,
  SentenceAnalysisResult,
  PhraseExplanation,
  ClauseRelationshipInfo,
  RelevantGrammarFeature
} from '../../types';
import { getGrammarL10n } from './grammarL10n';

export interface AnalyzedGrammarStructure {
  structureOverview: SentenceStructureOverview;
  clauses: SyntacticClause[];
  phraseConstituents: PhraseConstituent[];
  conversationalElements: ConversationalElement[];
  patternSummary: GrammaticalPatternSummary;
  structureMap: SentenceStructureMap;
  difficultVocabulary: Array<{
    word: string;
    meaningInContext: string;
    bengali: string;
    partOfSpeech?: string;
    grammaticalRole?: string;
  }>;
  clauseRelationship?: ClauseRelationshipInfo;
  relevantGrammarFeatures?: RelevantGrammarFeature[];
}

/**
 * Robust Syntactic Structure and Clause Breakdown Engine.
 * Parses sentences into clauses, grammatical constituents (S-V-O-C-A),
 * internal phrase structures, and conversational repairs without hallucinating external context.
 */
export class SyntaxEngine {
  /**
   * Main entry point to perform complete syntactic analysis on a sentence.
   */
  public static analyze(sentence: string, targetLang: string = 'bn'): AnalyzedGrammarStructure {
    const raw = sentence.trim();
    const clean = raw.replace(/\s+/g, ' ');

    // 1. Detect conversational elements (self-corrections, parentheticals, discourse markers)
    const { conversationalElements, sentenceWithoutRepairs, repairedWords } = this.extractConversationalElements(clean, targetLang);

    // 2. Identify clauses and determine sentence type
    const { clauses, clauseRelationship } = this.extractClauses(sentenceWithoutRepairs, clean, conversationalElements, targetLang);
    const structureOverview = this.classifySentenceStructure(clauses, clean, targetLang);

    // 3. Extract relevant grammar features (appositives, age, origin, continuous aspect)
    const relevantGrammarFeatures = this.extractRelevantGrammarFeatures(clean, clauses, conversationalElements, targetLang);

    // 4. Extract internal phrase constituents (e.g. detailed noun phrases, verb phrases)
    const phraseConstituents = this.extractPhraseConstituents(clean, clauses, conversationalElements, targetLang);

    // 5. Build sentence structure map
    const structureMap = this.buildStructureMap(clauses, clean, targetLang);

    // 6. Extract strictly grounded vocabulary with grammatical roles
    const difficultVocabulary = this.extractVocabulary(clean, targetLang);

    // 7. Generate grammatical pattern summary
    const patternSummary = this.generatePatternSummary(clauses, conversationalElements, phraseConstituents, targetLang);

    return {
      structureOverview,
      clauses,
      phraseConstituents,
      conversationalElements,
      patternSummary,
      structureMap,
      difficultVocabulary,
      clauseRelationship,
      relevantGrammarFeatures
    };
  }

  /**
   * Extract conversational repairs, self-corrections, parentheticals, and discourse markers.
   */
  private static extractConversationalElements(clean: string, targetLang: string = 'bn'): {
    conversationalElements: ConversationalElement[];
    sentenceWithoutRepairs: string;
    repairedWords: Array<{ original: string; corrected: string }>;
  } {
    const l10n = getGrammarL10n(targetLang);
    const conversationalElements: ConversationalElement[] = [];
    const repairedWords: Array<{ original: string; corrected: string }> = [];
    let sentenceWithoutRepairs = clean;

    // Pattern A: Self-corrections with "sorry" / "I mean" / "or rather" / "rather"
    // e.g., "...his greatest invention, sorry product."
    // e.g., "...at seven o'clock, I mean eight."
    const repairRegex = /,\s*(sorry|i mean|or rather|rather|actually|no wait)\s+([^,.]+?)(?=[,.]|$)/gi;
    let match: RegExpExecArray | null;

    while ((match = repairRegex.exec(clean)) !== null) {
      const fullMatch = match[0];
      const marker = match[1];
      const correctedTo = match[2].trim();
      const matchIndex = match.index;

      // Look back before the comma to identify the target word/phrase being replaced
      const textBefore = clean.slice(0, matchIndex).trim();
      const wordsBefore = textBefore.split(/\s+/);
      const targetOriginal = wordsBefore[wordsBefore.length - 1]?.replace(/[^\w'-]/g, '') || 'previous word';

      conversationalElements.push({
        text: fullMatch.replace(/^,\s*/, '').trim(),
        type: 'self_correction',
        typeLabel: 'Conversational Self-Correction (Speech Repair)',
        targetOriginal,
        correctedTo,
        explanation: `The speaker initially uses "${targetOriginal}" and then immediately corrects it to "${correctedTo}" using "${marker}". This is a conversational repair, not an independent clause.`,
        explanationBengali: l10n.selfCorrection(targetOriginal, correctedTo, marker)
      });

      repairedWords.push({ original: targetOriginal, corrected: correctedTo });
    }

    // Pattern B: Discourse markers and evaluative adverbs acting as stance markers
    // e.g. "arguably", "to be honest", "frankly", "you know"
    const stanceMarkers = [
      {
        regex: /\b(arguably)\b/i,
        text: 'arguably',
        type: 'discourse_marker',
        typeLabel: 'Evaluative Adverb / Stance Marker',
        explanation: 'Modal adverb qualifying the following claim ("it can be plausibly argued, though not definitively proven").',
        explanationBengali: l10n.stanceMarker('arguably')
      },
      {
        regex: /\b(frankly|to be honest|as a matter of fact|in fact|you know|mind you)\b/i,
        text: '',
        type: 'parenthetical',
        typeLabel: 'Conversational Parenthetical / Discourse Marker',
        explanation: 'Conversational phrase establishing interpersonal rapport or emphasis with the listener.',
        explanationBengali: l10n.discourseMarker()
      }
    ];

    for (const sm of stanceMarkers) {
      const m = sm.regex.exec(clean);
      if (m && !conversationalElements.some(e => e.text.toLowerCase().includes(m[0].toLowerCase()))) {
        conversationalElements.push({
          text: m[0],
          type: sm.type,
          typeLabel: sm.typeLabel,
          explanation: sm.explanation,
          explanationBengali: sm.explanationBengali
        });
      }
    }

    // Strip self-corrections when calculating base clause boundaries so repairs aren't split into clauses
    sentenceWithoutRepairs = clean.replace(repairRegex, '');

    return { conversationalElements, sentenceWithoutRepairs, repairedWords };
  }

  /**
   * Split and classify clauses accurately:
   * - Main/Independent
   * - Subordinate (adverbial)
   * - Relative
   * - Noun
   */
  private static extractClauses(
    sentenceWithoutRepairs: string,
    originalSentence: string,
    conversationalElements: ConversationalElement[],
    targetLang: string = 'bn'
  ): { clauses: SyntacticClause[]; clauseRelationship?: ClauseRelationshipInfo } {
    const l10n = getGrammarL10n(targetLang);
    const clauses: SyntacticClause[] = [];
    let clauseRelationship: ClauseRelationshipInfo | undefined;
    const clean = originalSentence;

    // Check for Relative Clause embedded in sentence
    // e.g. "The researcher who discovered the anomaly published the paper."
    const relativeMatch = clean.match(/\b(who|which|whose|whom)\s+([^,]+?)(?=,\s*|\s+(?:revealed|published|showed|is|are|was|were|has|have|had)\b|$)/i);
    const hasRelative = Boolean(relativeMatch && !clean.toLowerCase().startsWith('who ') && !clean.toLowerCase().startsWith('which '));

    // Check for Subordinate Adverbial Clauses (introductory or trailing)
    // Trailing can be preceded by comma OR whitespace (especially for "when", "while", "because", etc.)
    const subIntroMatch = clean.match(/^(although|even though|though|because|since|if|unless|while|whereas|after|before|when|whenever)\s+([^,]+),\s*(.+)$/i);
    const subTrailingMatch = clean.match(/^(.+?)(?:,\s*|\s+)\b(when|while|although|even though|though|because|since|if|unless|whereas|after|before|whenever|until)\b\s+([A-Za-z0-9'"].+)$/i);

    // Check for Noun Clauses (e.g. "Scientists reported that the ice was melting.")
    const nounClauseMatch = clean.match(/^(.+?\b(?:believed?|revealed?|said|stated?|reported?|knows?|knew|concluded?))\s+(that\s+.+)$/i);

    // Check for Compound Sentences with coordinating conjunctions (FANBOYS) joining two independent clauses
    const compoundMatch = sentenceWithoutRepairs.match(/^(.+?)\s*,\s*(and|but|or|so|yet|for|nor)\s+([A-Z]?[a-z]+(?:\s+[a-z]+)*\s+(?:is|are|was|were|has|have|had|do|does|did|will|would|can|could|[a-z]+ed|[a-z]+s|[a-z]+)\b.+)$/i);

    if (subIntroMatch) {
      // Subordinate clause first, then main clause
      const subMarker = subIntroMatch[1];
      const subBody = subIntroMatch[2];
      const mainBody = subIntroMatch[3];

      const subClauseText = `${subMarker} ${subBody}`;
      const subConstituents = this.parseClauseConstituents(subBody, subMarker, targetLang);
      clauses.push({
        text: subClauseText,
        type: 'subordinate',
        category: `Adverbial Clause of ${this.getAdverbialType(subMarker)}`,
        subordinator: subMarker.toLowerCase(),
        typeExplanation: `Dependent adverbial clause introduced by subordinating conjunction "${subMarker}".`,
        role: `Adverbial Clause of ${this.getAdverbialType(subMarker)}`,
        subject: subConstituents.subject,
        subjectExplanation: subConstituents.subjectExplanation,
        subjectExplanationBengali: subConstituents.subjectExplanationBengali,
        verb: subConstituents.verb,
        verbPhrase: subConstituents.verbPhrase,
        tenseAspect: subConstituents.tenseAspect,
        verbExplanation: subConstituents.verbExplanation,
        verbExplanationBengali: subConstituents.verbExplanationBengali,
        directObject: subConstituents.directObject,
        directObjectExplanation: subConstituents.directObjectExplanation,
        directObjectExplanationBengali: subConstituents.directObjectExplanationBengali,
        clausePattern: subConstituents.clausePattern,
        functionDescription: 'Sets the background condition or concession before the main event.',
        subjectAndVerb: `Subject: "${subConstituents.subject || 'Implied'}", Verb: "${subConstituents.verb || 'Finite verb'}"`,
        questionAnswered: this.getQuestionAnswered(subMarker),
        dependsOn: 'The main independent clause',
        standalone: 'No (incomplete thought on its own)',
        canStandAlone: false,
        example: `${subMarker} the storm ended, they continued.`,
        explanationBengali: l10n.subordinateClause(subMarker, this.getAdverbialType(subMarker))
      });

      const mainConstituents = this.parseClauseConstituents(mainBody, undefined, targetLang);
      clauses.push({
        text: mainBody,
        type: 'main',
        category: 'Independent Clause',
        typeExplanation: 'Independent main clause capable of standing alone as a complete sentence.',
        role: 'Independent Clause / Main Clause',
        subject: mainConstituents.subject,
        subjectExplanation: mainConstituents.subjectExplanation,
        subjectExplanationBengali: mainConstituents.subjectExplanationBengali,
        verb: mainConstituents.verb,
        verbPhrase: mainConstituents.verbPhrase,
        tenseAspect: mainConstituents.tenseAspect,
        verbExplanation: mainConstituents.verbExplanation,
        verbExplanationBengali: mainConstituents.verbExplanationBengali,
        directObject: mainConstituents.directObject,
        directObjectExplanation: mainConstituents.directObjectExplanation,
        directObjectExplanationBengali: mainConstituents.directObjectExplanationBengali,
        clausePattern: mainConstituents.clausePattern,
        functionDescription: 'Asserts the primary proposition or outcome of the sentence.',
        subjectAndVerb: `Subject: "${mainConstituents.subject || 'Core subject'}", Verb: "${mainConstituents.verb || 'Core verb'}"`,
        questionAnswered: 'What happened or what is the main claim?',
        dependsOn: 'None (grammatical core of the sentence)',
        standalone: 'Yes (forms a complete grammatical sentence)',
        canStandAlone: true,
        example: 'They successfully verified the hypothesis.',
        explanationBengali: l10n.mainClause()
      });

      clauseRelationship = {
        formula: `Dependent Adverbial Clause of ${this.getAdverbialType(subMarker)} + Main Clause`,
        explanation: `The introductory dependent clause introduces the condition or concession, followed by the main independent clause asserting the outcome.`,
        explanationBengali: l10n.clauseRelationshipIntro(subMarker, this.getAdverbialType(subMarker))
      };
    } else if (compoundMatch) {
      // Compound sentence: 2 independent clauses
      const part1 = compoundMatch[1].trim();
      const coord = compoundMatch[2].trim();
      const part2 = compoundMatch[3].trim();

      const c1 = this.parseClauseConstituents(part1, undefined, targetLang);
      clauses.push({
        text: part1,
        type: 'main',
        category: 'Independent Clause',
        typeExplanation: 'First independent clause expressing a complete idea.',
        role: 'Independent Clause 1',
        subject: c1.subject,
        subjectExplanation: c1.subjectExplanation,
        subjectExplanationBengali: c1.subjectExplanationBengali,
        verb: c1.verb,
        verbPhrase: c1.verbPhrase,
        tenseAspect: c1.tenseAspect,
        verbExplanation: c1.verbExplanation,
        verbExplanationBengali: c1.verbExplanationBengali,
        directObject: c1.directObject,
        clausePattern: c1.clausePattern,
        functionDescription: 'Expresses the first independent assertion.',
        subjectAndVerb: `Subject: "${c1.subject || 'Subject 1'}", Verb: "${c1.verb || 'Verb 1'}"`,
        standalone: 'Yes',
        canStandAlone: true,
        explanationBengali: l10n.compoundClause1()
      });

      const c2 = this.parseClauseConstituents(part2, undefined, targetLang);
      clauses.push({
        text: `${coord} ${part2}`,
        type: 'main',
        category: 'Independent Clause',
        typeExplanation: `Second independent clause coordinated with "${coord}".`,
        role: `Independent Clause 2 (Coordinated by "${coord}")`,
        subject: c2.subject,
        subjectExplanation: c2.subjectExplanation,
        subjectExplanationBengali: c2.subjectExplanationBengali,
        verb: c2.verb,
        verbPhrase: c2.verbPhrase,
        tenseAspect: c2.tenseAspect,
        verbExplanation: c2.verbExplanation,
        verbExplanationBengali: c2.verbExplanationBengali,
        directObject: c2.directObject,
        clausePattern: c2.clausePattern,
        functionDescription: 'Expresses the coordinated second assertion.',
        subjectAndVerb: `Subject: "${c2.subject || 'Subject 2'}", Verb: "${c2.verb || 'Verb 2'}"`,
        standalone: 'Yes (without conjunction)',
        canStandAlone: true,
        explanationBengali: l10n.compoundClause2(coord)
      });

      clauseRelationship = {
        formula: `Independent Clause 1 + ${coord} + Independent Clause 2`,
        explanation: `Two independent clauses coordinated by conjunction "${coord}".`,
        explanationBengali: l10n.clauseRelationshipCompound(coord)
      };
    } else if (subTrailingMatch) {
      // Main clause first, then subordinate clause
      const mainPart = subTrailingMatch[1].trim();
      const subMarker = subTrailingMatch[2].trim();
      const subPart = subTrailingMatch[3].trim();

      const mainC = this.parseClauseConstituents(mainPart, undefined, targetLang);
      clauses.push({
        text: mainPart,
        type: 'main',
        category: 'Independent Clause',
        typeExplanation: 'Independent main clause holding the primary assertion.',
        role: 'Independent Clause / Main Clause',
        subject: mainC.subject,
        subjectExplanation: mainC.subjectExplanation,
        subjectExplanationBengali: mainC.subjectExplanationBengali,
        verb: mainC.verb,
        verbPhrase: mainC.verbPhrase,
        tenseAspect: mainC.tenseAspect,
        verbExplanation: mainC.verbExplanation,
        verbExplanationBengali: mainC.verbExplanationBengali,
        directObject: mainC.directObject,
        directObjectExplanation: mainC.directObjectExplanation,
        directObjectExplanationBengali: mainC.directObjectExplanationBengali,
        complement: mainC.complement,
        complementType: mainC.complementType,
        adverbials: mainC.adverbials,
        adverbialPhrase: mainC.adverbials?.[0]?.text,
        clausePattern: mainC.clausePattern,
        functionDescription: 'Establishes the background situation.',
        subjectAndVerb: `Subject: "${mainC.subject || 'Subject'}", Verb: "${mainC.verbPhrase || mainC.verb || 'Verb'}"`,
        standalone: 'Yes (forms a complete grammatical sentence)',
        canStandAlone: true,
        explanationBengali: l10n.mainClause()
      });

      const subC = this.parseClauseConstituents(subPart, subMarker, targetLang);
      const isTimeClause = subMarker.toLowerCase() === 'when' || subMarker.toLowerCase() === 'while';
      const catLabel = isTimeClause ? 'Adverbial Clause of Time' : `Adverbial Clause of ${this.getAdverbialType(subMarker)}`;

      clauses.push({
        text: `${subMarker} ${subPart}`,
        type: 'subordinate',
        category: catLabel,
        subordinator: subMarker.toLowerCase(),
        typeExplanation: `Dependent clause answering when, why, or under what conditions.`,
        role: `Dependent ${catLabel}`,
        subject: subC.subject,
        subjectExplanation: subC.subjectExplanation,
        subjectExplanationBengali: subC.subjectExplanationBengali,
        verb: subC.verb,
        verbPhrase: subC.verbPhrase,
        tenseAspect: subC.tenseAspect,
        coordinatedVerbs: subC.coordinatedVerbs,
        verbExplanation: subC.verbExplanation,
        verbExplanationBengali: subC.verbExplanationBengali,
        directObject: subC.directObject,
        directObjectExplanation: subC.directObjectExplanation,
        directObjectExplanationBengali: subC.directObjectExplanationBengali,
        adverbials: subC.adverbials,
        adverbialPhrase: subC.adverbials?.[0]?.text,
        clausePattern: subC.clausePattern,
        functionDescription: isTimeClause ? 'Specifies the event that occurred during the background situation.' : 'Modifies the main clause assertion.',
        dependsOn: mainPart,
        standalone: 'No (incomplete thought on its own)',
        canStandAlone: false,
        explanationBengali: l10n.trailingSubordinateClause(subMarker, isTimeClause)
      });

      clauseRelationship = {
        formula: `Main Clause + ${subMarker.toLowerCase()} + Dependent ${catLabel}`,
        explanation: isTimeClause
          ? `The main clause establishes the background situation, while the dependent adverbial clause introduced by "${subMarker.toLowerCase()}" specifies the event that occurred during that background situation.`
          : `The main clause provides the primary proposition, accompanied by the subordinate clause providing context.`,
        explanationBengali: l10n.clauseRelationshipTrailing(subMarker, isTimeClause)
      };
    } else if (nounClauseMatch) {
      // Main clause + embedded noun clause
      const mainPart = nounClauseMatch[1].trim();
      const nounPart = nounClauseMatch[2].trim();

      const mainC = this.parseClauseConstituents(mainPart, undefined, targetLang);
      clauses.push({
        text: mainPart,
        type: 'main',
        category: 'Independent Clause',
        typeExplanation: 'Matrix/Main clause containing the reporting or cognitive verb.',
        role: 'Main Matrix Clause',
        subject: mainC.subject,
        verb: mainC.verb,
        verbPhrase: mainC.verbPhrase,
        directObject: nounPart,
        directObjectExplanation: 'The embedded noun clause functions as the direct object of the verb.',
        clausePattern: 'S + V + Noun Clause (DO)',
        functionDescription: 'Introduces the reporting matrix assertion.',
        subjectAndVerb: `Subject: "${mainC.subject || 'Subject'}", Verb: "${mainC.verb || 'Verb'}"`,
        standalone: 'Yes (with complement)',
        canStandAlone: true,
        explanationBengali: l10n.mainClause()
      });

      const nounC = this.parseClauseConstituents(nounPart.replace(/^that\s+/i, ''), undefined, targetLang);
      clauses.push({
        text: nounPart,
        type: 'noun',
        category: 'Noun Clause',
        typeExplanation: 'Dependent noun clause functioning as the direct object of the matrix verb.',
        role: 'Noun Clause (Direct Object)',
        subject: nounC.subject,
        verb: nounC.verb,
        verbPhrase: nounC.verbPhrase,
        directObject: nounC.directObject,
        clausePattern: nounC.clausePattern,
        functionDescription: 'Functions as the direct object argument of the reporting verb.',
        dependsOn: mainPart,
        standalone: 'No (acts as a nominal argument within the main clause)',
        canStandAlone: false,
        explanationBengali: l10n.nounClause()
      });

      clauseRelationship = {
        formula: 'Main Matrix Clause + that + Dependent Noun Clause (Direct Object)',
        explanation: 'The matrix clause expresses the reporting verb, and the noun clause supplies the cognitive content as direct object.',
        explanationBengali: l10n.clauseRelationshipNoun()
      };
    } else if (hasRelative && relativeMatch) {
      // Sentence containing a relative clause
      const relClauseText = `${relativeMatch[1]} ${relativeMatch[2]}`.trim();
      const mainTextWithoutRel = clean.replace(relClauseText, '').replace(/\s{2,}/g, ' ').trim();

      const mainC = this.parseClauseConstituents(mainTextWithoutRel, undefined, targetLang);
      clauses.push({
        text: clean,
        type: 'main',
        category: 'Independent Clause',
        typeExplanation: 'Matrix independent clause with an embedded relative clause modifying the noun.',
        role: 'Main Matrix Clause',
        subject: mainC.subject,
        verb: mainC.verb,
        verbPhrase: mainC.verbPhrase,
        directObject: mainC.directObject,
        clausePattern: mainC.clausePattern,
        functionDescription: 'Forms the main structural sentence around the embedded modifier.',
        subjectAndVerb: `Subject: "${mainC.subject || 'Subject'}", Verb: "${mainC.verb || 'Verb'}"`,
        standalone: 'Yes',
        canStandAlone: true,
        explanationBengali: l10n.mainClause()
      });

      clauses.push({
        text: relClauseText,
        type: 'relative',
        category: 'Relative / Adjective Clause',
        typeExplanation: `Relative (adjective) clause introduced by "${relativeMatch[1]}", modifying the antecedent noun.`,
        role: 'Relative / Adjective Clause',
        subject: relativeMatch[1],
        functionDescription: 'Modifies the antecedent noun phrase with restrictive or descriptive information.',
        dependsOn: 'The antecedent noun in the main clause',
        standalone: 'No (acts as an adjective modifying a noun)',
        canStandAlone: false,
        explanationBengali: l10n.relativeClause(relativeMatch[1])
      });

      clauseRelationship = {
        formula: 'Main Clause [embedded with Relative Clause]',
        explanation: `The relative clause modifies a noun within the main independent clause.`,
        explanationBengali: l10n.clauseRelationshipRelative()
      };
    } else {
      // Single Independent Clause (Simple Sentence)
      const constituents = this.parseClauseConstituents(sentenceWithoutRepairs, undefined, targetLang);

      clauses.push({
        text: clean,
        type: 'main',
        category: 'Independent Clause',
        typeExplanation: 'Single independent clause containing a subject and a complete predicate.',
        role: 'Complete Main Clause (Independent)',
        subject: constituents.subject,
        subjectExplanation: constituents.subjectExplanation,
        subjectExplanationBengali: constituents.subjectExplanationBengali,
        verb: constituents.verb,
        verbPhrase: constituents.verbPhrase,
        tenseAspect: constituents.tenseAspect,
        coordinatedVerbs: constituents.coordinatedVerbs,
        verbExplanation: constituents.verbExplanation,
        verbExplanationBengali: constituents.verbExplanationBengali,
        directObject: constituents.directObject,
        directObjectExplanation: constituents.directObjectExplanation,
        directObjectExplanationBengali: constituents.directObjectExplanationBengali,
        indirectObject: constituents.indirectObject,
        indirectObjectExplanation: constituents.indirectObjectExplanation,
        indirectObjectExplanationBengali: constituents.indirectObjectExplanationBengali,
        complement: constituents.complement,
        complementType: constituents.complementType,
        complementExplanation: constituents.complementExplanation,
        complementExplanationBengali: constituents.complementExplanationBengali,
        adverbials: constituents.adverbials,
        clausePattern: constituents.clausePattern,
        functionDescription: 'Delivers the complete standalone assertion of the sentence.',
        subjectAndVerb: `Subject: "${constituents.subject || 'Subject'}", Verb: "${constituents.verbPhrase || constituents.verb || 'Verb'}"`,
        questionAnswered: 'What statement or assertion is being made?',
        dependsOn: 'None (complete independent predication)',
        standalone: 'Yes (forms a complete grammatical sentence)',
        canStandAlone: true,
        example: clean,
        explanationBengali: l10n.mainClause()
      });
    }

    return { clauses, clauseRelationship };
  }

  /**
   * Parse internal clause constituents: Subject, Verb, Objects, Complements, Adverbials.
   */
  private static parseClauseConstituents(clauseText: string, subordinatorMarker?: string, targetLang: string = 'bn'): {
    subject?: string;
    subjectExplanation?: string;
    subjectExplanationBengali?: string;
    verb?: string;
    verbPhrase?: string;
    tenseAspect?: string;
    coordinatedVerbs?: string[];
    verbExplanation?: string;
    verbExplanationBengali?: string;
    directObject?: string;
    directObjectExplanation?: string;
    directObjectExplanationBengali?: string;
    indirectObject?: string;
    indirectObjectExplanation?: string;
    indirectObjectExplanationBengali?: string;
    complement?: string;
    complementType?: 'subject_complement' | 'object_complement';
    complementExplanation?: string;
    complementExplanationBengali?: string;
    adverbials?: Array<{ text: string; type: string; explanation: string; explanationBengali?: string }>;
    clausePattern: string;
  } {
    const l10n = getGrammarL10n(targetLang);
    const text = clauseText.trim().replace(/[.,;!?]+$/, '');
    const tokens = text.split(/\s+/);

    let subject: string | undefined;
    let subjectExplanation: string | undefined;
    let subjectExplanationBengali: string | undefined;

    let verb: string | undefined;
    let verbPhrase: string | undefined;
    let tenseAspect: string | undefined;
    let coordinatedVerbs: string[] | undefined;
    let verbExplanation: string | undefined;
    let verbExplanationBengali: string | undefined;

    let directObject: string | undefined;
    let directObjectExplanation: string | undefined;
    let directObjectExplanationBengali: string | undefined;

    let indirectObject: string | undefined;
    let indirectObjectExplanation: string | undefined;
    let indirectObjectExplanationBengali: string | undefined;

    let complement: string | undefined;
    let complementType: 'subject_complement' | 'object_complement' | undefined;
    let complementExplanation: string | undefined;
    let complementExplanationBengali: string | undefined;

    const adverbials: Array<{ text: string; type: string; explanation: string; explanationBengali?: string }> = [];

    // 1. Check for Continuous/Progressive verb phrases: [Subject] was/were/is/are holidaying/walking [Rest]
    const contMatch = text.match(/^(.+?)\s+\b(was|were|is|are|am)\s+([a-z]+ing)\b\s*(.*)$/i);
    if (contMatch) {
      const subjRaw = contMatch[1].replace(/,\s*$/, '').trim();
      const aux = contMatch[2];
      const mainV = contMatch[3];
      const rest = contMatch[4].trim();

      subject = subjRaw;
      verbPhrase = `${aux} ${mainV}`;
      verb = mainV;
      tenseAspect = /was|were/i.test(aux) ? 'Past Continuous (Past Progressive)' : 'Present Continuous (Present Progressive)';
      subjectExplanation = `The subject noun phrase performing or experiencing the ongoing activity ("${subject}").`;
      subjectExplanationBengali = l10n.subjectExplanation(subject);
      verbExplanation = `${tenseAspect} verb phrase setting the ongoing background situation ("${verbPhrase}").`;
      verbExplanationBengali = l10n.verbExplanation(verbPhrase, tenseAspect);

      if (rest) {
        const firstWord = rest.split(/\s+/)[0].toLowerCase();
        const isPrep = ['on', 'in', 'at', 'into', 'onto', 'to', 'from', 'by', 'with', 'under', 'over', 'through', 'across', 'behind', 'near', 'about'].includes(firstWord);
        if (isPrep) {
          const isLoc = ['on', 'in', 'at', 'near', 'under', 'over', 'behind'].includes(firstWord);
          adverbials.push({
            text: rest,
            type: isLoc ? 'Adverbial of Location / Place' : 'Adverbial Phrase',
            explanation: isLoc
              ? 'The adverbial provides location information and is not a direct object.'
              : 'Prepositional adverbial phrase providing circumstantial modification.',
            explanationBengali: isLoc ? l10n.adverbialLocation(rest) : l10n.adverbialDirection(rest)
          });
          return {
            subject,
            subjectExplanation,
            subjectExplanationBengali,
            verb,
            verbPhrase,
            tenseAspect,
            verbExplanation,
            verbExplanationBengali,
            adverbials,
            clausePattern: 'Subject + Verb + Adverbial (S + V + A)'
          };
        } else {
          directObject = rest;
          return {
            subject,
            subjectExplanation,
            subjectExplanationBengali,
            verb,
            verbPhrase,
            tenseAspect,
            verbExplanation,
            verbExplanationBengali,
            directObject,
            directObjectExplanation: l10n.directObjectExplanation(directObject),
            directObjectExplanationBengali: l10n.directObjectExplanation(directObject),
            clausePattern: 'S + V + DO'
          };
        }
      }

      return {
        subject,
        subjectExplanation,
        subjectExplanationBengali,
        verb,
        verbPhrase,
        tenseAspect,
        verbExplanation,
        verbExplanationBengali,
        clausePattern: 'S + V'
      };
    }

    // 2. Check for Coordinated Verbs: [Subject] slipped and fell [Rest]
    const coordMatch = text.match(/^(.+?)\s+\b([a-z]+)\s+and\s+([a-z]+)\b\s*(.*)$/i);
    if (coordMatch && ['slipped', 'fell', 'researched', 'published', 'studied', 'learned', 'worked', 'planned'].includes(coordMatch[2].toLowerCase())) {
      const subjRaw = coordMatch[1].replace(/,\s*$/, '').trim();
      const v1 = coordMatch[2];
      const v2 = coordMatch[3];
      const rest = coordMatch[4].trim();

      subject = subjRaw;
      verbPhrase = `${v1} and ${v2}`;
      verb = `${v1} and ${v2}`;
      coordinatedVerbs = [v1, v2];
      tenseAspect = 'Past Simple (Coordinated Verbs)';
      subjectExplanation = `Subject performing the coordinated actions ("${subject}").`;
      subjectExplanationBengali = l10n.subjectExplanation(subject);
      verbExplanation = `Coordinated past finite verbs ("${v1}" and "${v2}") joined by "and".`;
      verbExplanationBengali = l10n.verbExplanation(verbPhrase, tenseAspect, false, true);

      if (rest) {
        const firstWord = rest.split(/\s+/)[0].toLowerCase();
        const isPrep = ['on', 'in', 'at', 'into', 'onto', 'to', 'from', 'by', 'with', 'under', 'over', 'through', 'across'].includes(firstWord);
        if (isPrep) {
          const isDir = ['into', 'to', 'onto', 'through', 'across'].includes(firstWord);
          adverbials.push({
            text: rest,
            type: isDir ? 'Adverbial of Direction / Path' : 'Adverbial of Location / Place',
            explanation: isDir
              ? 'Directional adverbial prepositional phrase indicating the trajectory or path of the action.'
              : 'Locative adverbial prepositional phrase.',
            explanationBengali: isDir ? l10n.adverbialDirection(rest) : l10n.adverbialLocation(rest)
          });
          return {
            subject,
            subjectExplanation,
            subjectExplanationBengali,
            verb,
            verbPhrase,
            tenseAspect,
            coordinatedVerbs,
            verbExplanation,
            verbExplanationBengali,
            adverbials,
            clausePattern: 'Subject + Verb + Adverbial (S + V + A)'
          };
        } else {
          directObject = rest;
          return {
            subject,
            subjectExplanation,
            subjectExplanationBengali,
            verb,
            verbPhrase,
            tenseAspect,
            coordinatedVerbs,
            verbExplanation,
            verbExplanationBengali,
            directObject,
            directObjectExplanation: l10n.directObjectExplanation(directObject),
            directObjectExplanationBengali: l10n.directObjectExplanation(directObject),
            clausePattern: 'S + V + DO'
          };
        }
      }

      return {
        subject,
        subjectExplanation,
        subjectExplanationBengali,
        verb,
        verbPhrase,
        tenseAspect,
        coordinatedVerbs,
        verbExplanation,
        verbExplanationBengali,
        clausePattern: 'S + V'
      };
    }

    const knownVerbs = [
      'revealed', 'unveiled', 'announced', 'showed', 'discovered', 'created', 'developed',
      'implemented', 'faced', 'verified', 'proved', 'bought', 'sold', 'gave', 'sent', 'offered',
      'is', 'are', 'was', 'were', 'became', 'seemed', 'appeared', 'completed', 'performed',
      'received', 'analyzed', 'wrote', 'built', 'established', 'maintained', 'published',
      'released', 'solved', 'held', 'took', 'made', 'saw', 'said', 'found', 'began', 'went',
      'came', 'told', 'likes', 'prefers', 'believes', 'knows', 'thinks', 'reported',
      'demand', 'demands', 'demanded', 'require', 'requires', 'required', 'urge', 'urges', 'urged',
      'call', 'calls', 'called', 'seek', 'seeks', 'sought', 'transform', 'transforms', 'transformed',
      'improve', 'improves', 'improved', 'fund', 'funds', 'funded'
    ];

    let subjectMatched = '';
    let verbMatched = '';
    let restMatched = '';

    // Search for verb boundary in token stream
    for (let i = 1; i < tokens.length; i++) {
      const cleanToken = tokens[i].toLowerCase().replace(/[^\w]/g, '');
      const isVerb = knownVerbs.includes(cleanToken) || (/^[a-z]{3,}ed$/.test(cleanToken) && !['united', 'red', 'bed'].includes(cleanToken));
      if (isVerb) {
        subjectMatched = tokens.slice(0, i).join(' ');
        verbMatched = tokens[i];
        restMatched = tokens.slice(i + 1).join(' ');
        break;
      }
    }

    if (verbMatched && subjectMatched) {
      subject = subjectMatched.trim();
      verb = verbMatched.trim();
      verbPhrase = verb;
      const rest = restMatched.trim();

      subjectExplanation = `The agent or entity performing the action ("${subject}").`;
      subjectExplanationBengali = l10n.subjectExplanation(subject);

      const verbLower = verb.toLowerCase();
      const isLinking = ['is', 'are', 'was', 'were', 'became', 'seemed', 'appeared'].includes(verbLower);
      const isDitransitive = ['gave', 'sent', 'offered', 'showed', 'told'].includes(verbLower);

      if (isLinking) {
        verbExplanation = `Linking verb (copula) connecting the subject to its complement.`;
        verbExplanationBengali = l10n.verbExplanation(verb, undefined, true);
        complement = rest;
        complementType = 'subject_complement';
        complementExplanation = `Subject complement describing or renaming "${subject}".`;
        complementExplanationBengali = l10n.complementExplanation(complement, subject);
        return {
          subject,
          subjectExplanation,
          subjectExplanationBengali,
          verb,
          verbPhrase,
          verbExplanation,
          verbExplanationBengali,
          complement,
          complementType,
          complementExplanation,
          complementExplanationBengali,
          clausePattern: 'S + V + C'
        };
      }

      verbExplanation = `Past/present finite transitive verb requiring an object ("${verb}").`;
      verbExplanationBengali = l10n.verbExplanation(verb);

      // Check if rest contains an infinitive purpose clause, e.g. "urgent funding to transform Australian ovarian cancer survival"
      const purposeMatch = rest.match(/^(.+?)\s+\bto\s+([a-z]+)\b\s*(.*)$/i);
      if (purposeMatch) {
        const objPart = purposeMatch[1].trim();
        const purposeVerb = purposeMatch[2].trim();
        const purposeRest = purposeMatch[3].trim();
        const fullPurposePhrase = `to ${purposeVerb} ${purposeRest}`.trim();

        directObject = objPart;
        directObjectExplanation = `Object noun phrase ("${directObject}") receiving the action of the verb.`;
        directObjectExplanationBengali = l10n.directObjectExplanation(directObject);

        adverbials.push({
          text: fullPurposePhrase,
          type: 'Infinitive of Purpose (Adverbial of Goal / Reason)',
          explanation: l10n.purposeExplanation(fullPurposePhrase),
          explanationBengali: l10n.purposeExplanation(fullPurposePhrase)
        });

        return {
          subject,
          subjectExplanation,
          subjectExplanationBengali,
          verb,
          verbPhrase,
          verbExplanation,
          verbExplanationBengali,
          directObject,
          directObjectExplanation,
          directObjectExplanationBengali,
          adverbials,
          clausePattern: 'S + V + DO + Purpose Infinitive (S + V + O + A)'
        };
      }

      // Check if rest starts with a locative preposition without direct object
      const restFirstWord = rest.split(/\s+/)[0]?.toLowerCase();
      const isLocPrep = ['on', 'in', 'at', 'into', 'to', 'onto', 'from', 'through'].includes(restFirstWord);

      // Check if direct object has stance adverbial at beginning, e.g. "arguably his greatest invention"
      const advMatch = rest.match(/^(arguably|perhaps|possibly|certainly|reportedly|undoubtedly)\s+(.+)$/i);
      if (advMatch) {
        const advWord = advMatch[1];
        adverbials.push({
          text: advWord,
          type: 'modal_stance',
          explanation: `Evaluative adverb modifying the noun phrase assertion ("${advWord}").`,
          explanationBengali: l10n.adverbialModalStance(advWord)
        });
        directObject = rest; // full object NP is "arguably his greatest invention"
        directObjectExplanation = `Object noun phrase ("${rest}") receiving the action of the verb.`;
        directObjectExplanationBengali = l10n.directObjectExplanation(rest);
      } else if (isDitransitive) {
        // Check for indirect object, e.g. "gave the team an award"
        const diMatch = rest.match(/^((?:the|a|his|her|their|our)?\s*[a-z]+)\s+((?:the|a|an|his|her|their|our)?\s*[a-z]+(?:\s+[a-z]+)*)$/i);
        if (diMatch) {
          indirectObject = diMatch[1];
          indirectObjectExplanation = `Indirect recipient of the action ("${indirectObject}").`;
          indirectObjectExplanationBengali = l10n.indirectObjectExplanation(indirectObject);
          directObject = diMatch[2];
          directObjectExplanation = `Direct object entity transferred or provided ("${directObject}").`;
          directObjectExplanationBengali = l10n.directObjectExplanation(directObject);
          return {
            subject,
            subjectExplanation,
            subjectExplanationBengali,
            verb,
            verbPhrase,
            verbExplanation,
            verbExplanationBengali,
            indirectObject,
            indirectObjectExplanation,
            indirectObjectExplanationBengali,
            directObject,
            directObjectExplanation,
            directObjectExplanationBengali,
            clausePattern: 'S + V + IO + DO'
          };
        } else {
          directObject = rest;
          directObjectExplanation = `Direct object receiving the action.`;
          directObjectExplanationBengali = l10n.directObjectExplanation(directObject);
        }
      } else if (isLocPrep) {
        adverbials.push({
          text: rest,
          type: 'Adverbial of Location / Place',
          explanation: 'The adverbial provides location information and is not a direct object.',
          explanationBengali: l10n.adverbialLocation(rest)
        });
        return {
          subject,
          subjectExplanation,
          subjectExplanationBengali,
          verb,
          verbPhrase,
          verbExplanation,
          verbExplanationBengali,
          adverbials,
          clausePattern: 'Subject + Verb + Adverbial (S + V + A)'
        };
      } else {
        directObject = rest;
        directObjectExplanation = `Direct object noun phrase receiving the action ("${directObject}").`;
        directObjectExplanationBengali = l10n.directObjectExplanation(directObject);
      }

      return {
        subject,
        subjectExplanation,
        subjectExplanationBengali,
        verb,
        verbPhrase,
        verbExplanation,
        verbExplanationBengali,
        directObject,
        directObjectExplanation,
        directObjectExplanationBengali,
        adverbials,
        clausePattern: adverbials.length > 0 ? 'S + V + DO (with Adverbial)' : 'S + V + DO'
      };
    }

    // Default fallback constituent extraction for clauses not matching specific transitive pattern
    if (tokens.length >= 2) {
      subject = tokens[0];
      verb = tokens[1];
      verbPhrase = verb;
      directObject = tokens.slice(2).join(' ') || undefined;
      return {
        subject,
        subjectExplanation: `Subject: "${subject}"`,
        subjectExplanationBengali: l10n.subjectExplanation(subject),
        verb,
        verbPhrase,
        verbExplanation: `Finite verb: "${verb}"`,
        verbExplanationBengali: l10n.verbExplanation(verb),
        directObject,
        directObjectExplanation: directObject ? l10n.directObjectExplanation(directObject) : undefined,
        directObjectExplanationBengali: directObject ? l10n.directObjectExplanation(directObject) : undefined,
        clausePattern: directObject ? 'S + V + O' : 'S + V'
      };
    }

    return {
      clausePattern: 'Clause'
    };
  }

  /**
   * Extract internal phrase constituents (e.g. detailed breakdown of complex noun phrases).
   */
  private static extractPhraseConstituents(
    clean: string,
    clauses: SyntacticClause[],
    conversationalElements: ConversationalElement[],
    targetLang: string = 'bn'
  ): PhraseConstituent[] {
    const l10n = getGrammarL10n(targetLang);
    const phraseConstituents: PhraseConstituent[] = [];

    // Analyze noun phrases with determiners, adjectives, and adverbs
    // e.g., "arguably his greatest invention"
    const complexNpRegex = /\b(arguably|perhaps|certainly|undoubtedly)?\s*(his|her|their|our|my|the|a|an|this|that)?\s*(greatest|latest|newest|oldest|best|worst|first|second|unexpected|technical|historical|urgent)?\s*(invention|product|hurdles|hypothesis|archives|policy|decision|breakthrough|funding)\b/gi;
    let npMatch: RegExpExecArray | null;

    while ((npMatch = complexNpRegex.exec(clean)) !== null) {
      const fullPhrase = npMatch[0].trim();
      const adv = npMatch[1];
      const det = npMatch[2];
      const adj = npMatch[3];
      const noun = npMatch[4];

      if (noun) {
        const components: PhraseComponent[] = [];

        if (adv) {
          components.push({
            text: adv,
            role: 'adverb',
            roleLabel: 'Modal / Evaluative Adverb',
            roleBengali: l10n.adverbRole(adv),
            explanation: `Modifies the degree of conviction, conveying "as may be argued".`,
            explanationBengali: l10n.adverbRole(adv)
          });
        }

        if (det) {
          components.push({
            text: det,
            role: 'possessive_determiner',
            roleLabel: 'Possessive Determiner',
            roleBengali: l10n.determinerRole(det),
            explanation: `Identifies possessor or reference entity ("${det}").`,
            explanationBengali: l10n.determinerRole(det)
          });
        }

        if (adj) {
          components.push({
            text: adj,
            role: 'superlative_adjective',
            roleLabel: 'Superlative Adjective',
            roleBengali: l10n.superlativeRole(adj),
            explanation: `Describes the supreme degree or qualification of the noun ("${adj}").`,
            explanationBengali: l10n.superlativeRole(adj)
          });
        }

        components.push({
          text: noun,
          role: 'head_noun',
          roleLabel: 'Head Noun',
          roleBengali: l10n.headNounRole(noun),
          explanation: `The central core noun of the noun phrase ("${noun}").`,
          explanationBengali: l10n.headNounRole(noun)
        });

        phraseConstituents.push({
          phrase: fullPhrase,
          phraseType: 'noun_phrase',
          phraseTypeLabel: 'Complex Noun Phrase (Object NP)',
          headWord: noun,
          roleInClause: 'Direct Object',
          components,
          explanation: `A multi-layered noun phrase built around the head noun "${noun}", modified by an adverb of stance, a determiner, and an adjective.`,
          explanationBengali: l10n.phraseConstituent(noun)
        });
      }
    }

    // Also analyze subject noun phrase if complex, e.g. "The Tesla boss"
    const subjectNpRegex = /\b(the|a|an)\s+([A-Z][a-z]+)\s+([a-z]+)\b/i;
    const subMatch = clean.match(subjectNpRegex);
    if (subMatch && !phraseConstituents.some(p => p.phrase.toLowerCase() === subMatch[0].toLowerCase())) {
      phraseConstituents.unshift({
        phrase: subMatch[0],
        phraseType: 'noun_phrase',
        phraseTypeLabel: 'Subject Noun Phrase',
        headWord: subMatch[3],
        roleInClause: 'Subject',
        components: [
          {
            text: subMatch[1],
            role: 'definite_article',
            roleLabel: 'Definite Article (Determiner)',
            roleBengali: l10n.articleRole(subMatch[1]),
            explanation: 'Specifies a unique, known individual.'
          },
          {
            text: subMatch[2],
            role: 'proper_noun_adjunct',
            roleLabel: 'Proper Noun Adjunct Modifier',
            roleBengali: l10n.properNounAdjunctRole(subMatch[2]),
            explanation: `Specifies the organization or context ("${subMatch[2]}").`
          },
          {
            text: subMatch[3],
            role: 'head_noun',
            roleLabel: 'Head Noun',
            roleBengali: l10n.headNounRole(subMatch[3]),
            explanation: `The primary role or agent ("${subMatch[3]}").`
          }
        ],
        explanation: `Subject noun phrase identifying the actor with a definite article, noun adjunct, and head noun.`,
        explanationBengali: l10n.phraseConstituent(subMatch[3])
      });
    }

    return phraseConstituents;
  }

  /**
   * Classify sentence structure correctly (simple, compound, complex, compound-complex)
   * based on actual coordination and subordination, NOT clause count alone.
   */
  private static classifySentenceStructure(
    clauses: SyntacticClause[],
    sentenceText: string,
    targetLang: string = 'bn'
  ): SentenceStructureOverview {
    const l10n = getGrammarL10n(targetLang);
    const independentCount = clauses.filter(c => c.type === 'main').length;
    const dependentCount = clauses.filter(c => c.type === 'subordinate' || c.type === 'relative' || c.type === 'noun').length;

    let type: 'simple' | 'compound' | 'complex' | 'compound-complex' = 'simple';
    let explanation = '';
    let depReason = 'one dependent clause';

    if (independentCount >= 2 && dependentCount >= 1) {
      type = 'compound-complex';
      explanation = `Compound-complex sentence: contains ${independentCount} independent clauses connected with coordination and at least ${dependentCount} dependent clause(s).`;
    } else if (independentCount >= 2 && dependentCount === 0) {
      type = 'compound';
      explanation = `Compound sentence: joins ${independentCount} independent clauses with a coordinating conjunction.`;
    } else if (dependentCount >= 1) {
      type = 'complex';
      const depClause = clauses.find(c => c.type === 'subordinate' || c.type === 'relative' || c.type === 'noun');
      if (depClause?.category?.toLowerCase().includes('adverbial') || depClause?.type === 'subordinate') {
        depReason = 'one dependent adverbial clause';
      } else if (depClause?.type === 'relative') {
        depReason = 'one dependent relative clause';
      } else if (depClause?.type === 'noun') {
        depReason = 'one dependent noun clause';
      }
      explanation = `Complex sentence. Reason: one independent clause and ${dependentCount === 1 ? depReason : `${dependentCount} dependent clauses`}.`;
    } else {
      type = 'simple';
      explanation = `Simple sentence. Reason: contains exactly one independent clause with a unified subject-predicate structure. Conversational repairs or parentheticals do not constitute separate clauses.`;
    }

    const explanationBengali = l10n.sentenceStructureOverview(type, independentCount, dependentCount, depReason);

    return { type, explanation, explanationBengali };
  }

  /**
   * Extract relevant grammar features (appositives, age, origin, continuous aspect, conversational markers).
   */
  private static extractRelevantGrammarFeatures(
    clean: string,
    clauses: SyntacticClause[],
    conversationalElements: ConversationalElement[],
    targetLang: string = 'bn'
  ): RelevantGrammarFeature[] {
    const l10n = getGrammarL10n(targetLang);
    const features: RelevantGrammarFeature[] = [];

    // 1. Appositive / Age Information (e.g. ", 79,")
    const ageMatch = clean.match(/,\s*(\d{1,3})\s*,/);
    if (ageMatch) {
      features.push({
        feature: 'Appositive / age information',
        text: ageMatch[1],
        explanation: `“${ageMatch[1]}” — Numerical appositive phrase enclosed by commas specifying the subject's age.`,
        detail: `“${ageMatch[1]}” — Numerical appositive phrase enclosed by commas specifying the subject's age.`,
        explanationBengali: l10n.appositiveAge(ageMatch[1]),
        detailBengali: l10n.appositiveAge(ageMatch[1])
      });
    }

    // 2. Additional Location / Geographical Information
    const locMatch = clean.match(/,\s*(from\s+[^,]+(?:,\s*about\s+[^,]+)?),/i);
    if (locMatch) {
      features.push({
        feature: 'Additional location information',
        text: locMatch[1].trim(),
        explanation: `“${locMatch[1].trim()}” — Prepositional modifier providing the origin and geographical detail of the subject.`,
        detail: `“${locMatch[1].trim()}” — Prepositional modifier providing the origin and geographical detail of the subject.`,
        explanationBengali: l10n.appositiveLocation(locMatch[1].trim()),
        detailBengali: l10n.appositiveLocation(locMatch[1].trim())
      });
    }

    // 3. Past Continuous / Aspect
    const mainC = clauses.find(c => c.type === 'main');
    if (mainC?.tenseAspect?.includes('Past Continuous') || mainC?.verbPhrase?.match(/\b(was|were)\s+[a-z]+ing\b/i)) {
      const vp = mainC?.verbPhrase || 'was holidaying';
      features.push({
        feature: 'Past Continuous',
        text: vp,
        explanation: `“${vp}” — Establishes the ongoing background situation in the past. (Do not describe this as a confirmed interrupted action unless the complete context supports that interpretation).`,
        detail: `“${vp}” — Establishes the ongoing background situation in the past. (Do not describe this as a confirmed interrupted action unless the complete context supports that interpretation).`,
        explanationBengali: l10n.pastContinuousAspect(vp),
        detailBengali: l10n.pastContinuousAspect(vp)
      });
    }

    // 4. Conversational Elements / Stance
    for (const ce of conversationalElements) {
      if (ce.type === 'self_correction') {
        features.push({
          feature: 'Conversational Self-Correction (Speech Repair)',
          detail: `“${ce.text}” — Immediate spoken repair from "${ce.targetOriginal || ''}" to "${ce.correctedTo || ''}". Does not form a separate clause.`,
          detailBengali: ce.explanationBengali
        });
      } else if (ce.type === 'discourse_marker' || ce.type === 'parenthetical') {
        features.push({
          feature: ce.typeLabel,
          detail: `“${ce.text}” — ${ce.explanation}`,
          detailBengali: ce.explanationBengali
        });
      }
    }

    return features;
  }

  /**
   * Build hierarchical sentence structure map.
   */
  private static buildStructureMap(clauses: SyntacticClause[], clean: string, targetLang: string = 'bn'): SentenceStructureMap {
    const l10n = getGrammarL10n(targetLang);
    const mainClause = clauses.find(c => c.type === 'main')?.text || clean;

    return {
      mainClause,
      rootMainClause: mainClause,
      branches: clauses.filter(c => c.type !== 'main').map(c => ({
        clauseText: c.text,
        relationType: c.type,
        roleInSentence: c.role
      })),
      nodes: clauses.map((c) => ({
        clauseOrElement: c.text,
        relationType: c.type === 'main' ? 'main' : 'dependent',
        connectsTo: c.type === 'main' ? 'Core Sentence' : mainClause,
        explanation: c.type === 'main' ? 'Primary grammatical assertion' : (c.typeExplanation || 'Modifying dependent construction'),
        bengaliExplanation: c.explanationBengali || l10n.structureMapNode(c.type === 'main', c.text)
      }))
    };
  }

  /**
   * Strictly extract vocabulary present in the original sentence without introducing external details.
   */
  private static extractVocabulary(clean: string, targetLang: string = 'bn'): Array<{
    word: string;
    meaningInContext: string;
    bengali: string;
    partOfSpeech?: string;
    grammaticalRole?: string;
  }> {
    const l10n = getGrammarL10n(targetLang);
    const words = clean.split(/\s+/).map(w => w.replace(/^[^\w'-]+|[^\w'-]+$/g, '')).filter(w => w.length >= 4);
    const uniqueWords = Array.from(new Set(words));

    const result: Array<{
      word: string;
      meaningInContext: string;
      bengali: string;
      partOfSpeech?: string;
      grammaticalRole?: string;
    }> = [];

    for (const w of uniqueWords) {
      const entry = l10n.getVocabularyWord(w);
      if (entry) {
        result.push({
          word: w,
          meaningInContext: entry.meaning,
          bengali: entry.localized,
          partOfSpeech: entry.pos,
          grammaticalRole: entry.role
        });
      }
    }

    // Fallback if none matched: strictly use words occurring in the sentence
    if (result.length === 0 && uniqueWords.length > 0) {
      const topWords = uniqueWords.slice(0, 3);
      for (const tw of topWords) {
        result.push({
          word: tw,
          meaningInContext: `Key lexical term appearing in the analyzed sentence context.`,
          bengali: targetLang === 'bn' ? 'বাক্যস্থিত গুরুত্বপূর্ণ শব্দ' : (targetLang === 'en' ? 'Key term from sentence' : tw),
          partOfSpeech: 'Word',
          grammaticalRole: 'Lexical Constituent'
        });
      }
    }

    return result;
  }

  /**
   * Generate reusable grammatical pattern summary.
   */
  private static generatePatternSummary(
    clauses: SyntacticClause[],
    conversationalElements: ConversationalElement[],
    phraseConstituents: PhraseConstituent[],
    targetLang: string = 'bn'
  ): GrammaticalPatternSummary {
    const l10n = getGrammarL10n(targetLang);
    const mainC = clauses.find(c => c.type === 'main') || clauses[0];
    const hasCorrection = conversationalElements.some(e => e.type === 'self_correction');

    let formula = mainC?.clausePattern || 'Subject + Verb + Object';
    if (hasCorrection) {
      formula += ' + Conversational Self-Correction [sorry + Noun]';
    }

    let explanation = `The sentence demonstrates the pattern: "${formula}". It features a clear subject, a finite verb, and an object, showing how natural English handles assertion and immediate spoken repair.`;
    if (formula.includes('S + V + A') || formula.includes('Adverbial')) {
      explanation = `Subject + Verb + Adverbial (S + V + A). The adverbial provides location information and is not a direct object.`;
    }

    const explanationBengali = l10n.patternSummary(formula);

    return { formula, explanation, explanationBengali };
  }

  private static getAdverbialType(marker: string): string {
    const m = marker.toLowerCase();
    if (['although', 'even though', 'though', 'while', 'whereas'].includes(m)) return 'Concession / Contrast';
    if (['because', 'since', 'as'].includes(m)) return 'Reason / Cause';
    if (['if', 'unless', 'provided that'].includes(m)) return 'Condition';
    if (['when', 'whenever', 'after', 'before', 'until', 'once'].includes(m)) return 'Time';
    return 'Circumstance / Context';
  }

  private static getQuestionAnswered(marker: string): string {
    const m = marker.toLowerCase();
    if (['although', 'even though', 'though'].includes(m)) {
      return 'Under what conflicting or unexpected condition did the main event occur?';
    }
    if (['because', 'since'].includes(m)) {
      return 'Why or for what reason did the main event occur?';
    }
    if (['if', 'unless'].includes(m)) {
      return 'Under what condition does the main claim hold true?';
    }
    return 'Under what contextual circumstance did the main action take place?';
  }
}

