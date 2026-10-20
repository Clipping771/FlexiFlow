import {
  SelectionType,
  LinguisticAnalysisResult,
  WritingGoal,
  WritingAssistResult,
  FollowUpResponse,
  WordAnalysisResult,
  PhraseAnalysisResult,
  SentenceAnalysisResult,
  ParagraphAnalysisResult,
  ParagraphSentenceItem,
  ParagraphBlockItem,
  StageAExplanation,
  StageBDetailedVocabulary,
  StageBSense,
  HighlightExtractionResult,
  HighlightVocabularyItem,
  SyntacticClause,
  SentenceStructureMap,
  GrammarRuleDetail,
  ConnectorRelationship,
  WordLevelGrammarDetail,
  MistakeAndAlternative,
  GrammarPractice
} from '../../types';
import { BengaliService } from '../bengali';
import { DictionaryService } from '../dictionary';
import {
  WordAnalysisSchema,
  PhraseAnalysisSchema,
  SentenceAnalysisSchema,
  ParagraphAnalysisSchema,
  WritingAssistSchema,
  FollowUpResponseSchema,
  HighlightExtractionResultSchema
} from './schemas';
import { getLanguageConfig } from '../../config/languages';
import { AIProvider } from './types';
import { HighlightIntelligenceService } from './highlightIntelligence';
import { SyntaxEngine } from '../grammar/syntaxEngine';
import { splitIntoParagraphs, splitIntoSentences } from '../../content/selection';

export class MockAIProvider implements AIProvider {
  name = 'mock';
  targetLang: string = 'bn';

  constructor(targetLang: string = 'bn') {
    this.targetLang = targetLang;
  }

  isAvailable(): boolean {
    return true; // Always available offline
  }

  async analyzeStageA(
    text: string,
    contextSentence?: string,
    paragraphContext?: string
  ): Promise<StageAExplanation> {
    const clean = text.trim();
    const bengali = BengaliService.getMeaning(clean, contextSentence);
    const lemma = clean.toLowerCase();

    // Prioritize genuinely easy conversational English definition
    const easyEnglish = bengali.isCurated && bengali.nuance
      ? bengali.nuance
      : `What it means simply in everyday speech.`;

    const easyBengali = bengali.bengaliWord || 'অর্থ';

    const contextMeaning = contextSentence
      ? `In this sentence, "${clean}" describes the specific situation being talked about.`
      : `Used here in its most natural sense.`;

    const isInflict = lemma === 'inflict' || lemma === 'inflicted';
    const exEnglish = contextSentence || (isInflict ? 'The storm inflicted severe damage on the coastal village.' : `She understood the meaning of ${clean} immediately.`);
    const exBengali = isInflict
      ? 'ঝড়টি উপকূলীয় গ্রামে মারাত্মক ক্ষয়ক্ষতি সাধন করেছিল।'
      : `সে বাক্যটিতে এর ভাবার্থ সহজে বুঝতে পেরেছিল।`;

    return {
      selectedText: clean,
      lemma,
      partOfSpeech: 'word',
      easyEnglish,
      easyBengali,
      contextMeaning,
      example: exEnglish,
      exampleBengali: exBengali,
      confidence: 'high',
      contextualSenseId: 'sense_1'
    };
  }

  async analyzeStageB(
    lemma: string,
    partOfSpeech: string = 'word',
    contextualSenseId: string = 'sense_1'
  ): Promise<StageBDetailedVocabulary> {
    const cleanLemma = lemma.trim().toLowerCase();
    const bengali = BengaliService.getMeaning(cleanLemma);

    const primarySense: StageBSense = {
      id: contextualSenseId || 'sense_1',
      partOfSpeech: partOfSpeech || 'word',
      easyEnglish: bengali.isCurated && bengali.nuance ? bengali.nuance : `The main practical meaning used in daily conversation.`,
      easyBengali: bengali.bengaliWord || 'প্রধান অর্থ',
      isContextual: true,
      registerOrType: 'standard',
      examples: [
        {
          english: `They noticed the ${cleanLemma} right away.`,
          bengali: `তারা বিষয়টি সাথে সাথে খেয়াল করেছিল।`
        }
      ],
      synonyms: [
        {
          word: 'clear',
          easyEnglish: 'Easy to see or understand.',
          easyBengali: 'সহজে বোধগম্য বা পরিষ্কার।'
        }
      ],
      antonyms: []
    };

    const secondarySense: StageBSense = {
      id: 'sense_2',
      partOfSpeech: partOfSpeech || 'word',
      easyEnglish: `Another common way people use "${cleanLemma}".`,
      easyBengali: `আরেকটি প্রচলিত অর্থ বা ভাব`,
      isContextual: false,
      registerOrType: 'standard',
      examples: [
        {
          english: `The rule also applies to ${cleanLemma} in other cases.`,
          bengali: `নিয়মটি অন্য ক্ষেত্রেও একইভাবে প্রযোজ্য হয়।`
        }
      ],
      synonyms: [],
      antonyms: []
    };

    return {
      lemma: cleanLemma,
      partOfSpeech: partOfSpeech || 'word',
      contextualSenseId: primarySense.id,
      senses: [primarySense, secondarySense],
      collocations: [
        { english: `common ${cleanLemma}`, bengali: `সাধারণ ব্যবহার` },
        { english: `quite ${cleanLemma}`, bengali: `বেশ স্পষ্ট` }
      ],
      idiomsAndPhrases: [],
      wordForms: [
        { form: cleanLemma, partOfSpeech: 'base' }
      ]
    };
  }

  async analyze(
    text: string,
    type: SelectionType,
    contextSentence?: string,
    paragraphContext?: string
  ): Promise<LinguisticAnalysisResult> {
    const clean = text.trim();

    if (type === 'word') {
      return this.analyzeWord(clean, contextSentence);
    } else if (type === 'phrase') {
      return this.analyzePhrase(clean, contextSentence);
    } else if (type === 'sentence') {
      return this.analyzeSentence(clean);
    } else {
      return this.analyzeParagraph(clean);
    }
  }

  private analyzeWord(word: string, contextSentence?: string): WordAnalysisResult {
    const bengali = BengaliService.getMeaning(word, contextSentence);

    const contextualMeaning = bengali.isCurated
      ? (bengali.bengaliExplanation || `In this context, "${word}" qualifies the action or state in the sentence.`)
      : `Used to specify or qualify the idea in this sentence.`;

    const simpleExplanation = bengali.isCurated && bengali.nuance
      ? bengali.nuance
      : `According to standard facts, rules, or definitions.`;

    const lang = getLanguageConfig(this.targetLang);
    const targetTranslation = this.targetLang === 'bn'
      ? bengali.bengaliWord
      : `${lang.targetLabel}: ${bengali.bengaliWord}`;

    const raw: WordAnalysisResult = {
      selectedText: word,
      selectionType: 'word',
      contextualMeaning,
      simpleEnglishExplanation: simpleExplanation,
      bengaliTranslation: targetTranslation,
      whyFitsContext: contextSentence
        ? `Used in the sentence to clarify the exact condition or state.`
        : `Fits natural English usage.`,
      partOfSpeech: 'word',
      grammaticalRole: contextSentence
        ? `Functions in this sentence context as a primary lexical unit modifying or naming a core element.`
        : `Base lexical entry.`,
      grammaticalNote: `Functions as an essential semantic component within the clause.`,
      transitivityOrPattern: `Can take direct objects or prepositional modifiers depending on sentence predicate.`,
      wordForms: [word.toLowerCase(), `${word.toLowerCase()}s`, `${word.toLowerCase()}ed`, `${word.toLowerCase()}ing`],
      collocations: [`strictly ${word}`, `quite ${word}`, `deeply ${word}`],
      examples: contextSentence
        ? [`"${contextSentence.slice(0, 100)}..."`]
        : [`Technically, the requirements were fulfilled correctly.`],
      exampleBengali: (word.toLowerCase() === 'inflict' || word.toLowerCase() === 'inflicted')
        ? 'ঝড়টি উপকূলীয় গ্রামে মারাত্মক ক্ষয়ক্ষতি সাধন করেছিল।'
        : 'সে বাক্যটিতে এর ভাবার্থ সহজে বুঝতে পেরেছিল।',
      synonyms: ['accurate', 'precise'],
      antonyms: [],
      registerAndTone: 'Standard English'
    };

    return WordAnalysisSchema.parse(raw);
  }

  private analyzePhrase(phrase: string, contextSentence?: string): PhraseAnalysisResult {
    const raw: PhraseAnalysisResult = {
      selectedText: phrase,
      selectionType: 'phrase',
      phraseType: phrase.split(/\s+/).length === 2 && /(out|up|in|off|on|down|away)$/i.test(phrase)
        ? 'phrasal_verb'
        : 'collocation',
      overallMeaning: `Idiomatic expression conveying a unified concept rather than the literal sum of its individual words.`,
      simpleEnglishExplanation: `A natural English multi-word expression used to convey a coherent action or condition.`,
      bengaliTranslation: `প্রাসঙ্গিক বিশিষ্ট ভাব বা বাগধারা হিসেবে ব্যবহৃত বাক্যাংশ।`,
      literalVsFigurative: `The figurative meaning functions cohesively in this sentence beyond literal translation.`,
      whyFitsContext: contextSentence
        ? `Used in "${contextSentence.slice(0, 60)}..." to establish concise, natural rhythm.`
        : `Standard native phrasing.`,
      grammaticalStructure: phrase.split(/\s+/).length > 2
        ? 'Prepositional / Verb Phrase Construction'
        : 'Head Word + Complement',
      componentsBreakdown: `Combines words to form an established idiomatic meaning.`,
      examples: [
        `The committee decided to follow through with the recommendations.`,
        `Experts emphasized that taking immediate steps prevents further complications.`
      ]
    };

    return PhraseAnalysisSchema.parse(raw);
  }

  private decomposeIntoPhraseBreakdown(text: string): Array<{
    phrase: string;
    easyEnglish: string;
    easyBengali: string;
    grammaticalFunction?: string;
    connection?: string;
    whyItMatters?: string;
    simplerExample?: string;
  }> {
    const clean = text.trim();
    if (!clean) return [];

    // Split text into meaningful phrases based on punctuation and clause boundaries
    const rawParts = clean.split(/(?:,\s*|;\s*|:\s*|\.\s+|\n+|—|–)/).map((p) => p.trim()).filter(Boolean);
    const phrases: Array<{
      phrase: string;
      easyEnglish: string;
      easyBengali: string;
      grammaticalFunction?: string;
      connection?: string;
      whyItMatters?: string;
      simplerExample?: string;
    }> = [];

    for (let i = 0; i < rawParts.length; i++) {
      const part = rawParts[i];
      if (!part) continue;
      const words = part.split(/\s+/).filter(Boolean);

      let gmFunc = i === 0 ? 'Introductory clause or contextual modifier' : (i === rawParts.length - 1 ? 'Concluding clause or terminal modifier' : 'Central predication or mediating phrase');
      let connection = i === 0 ? 'Prepares the context for the main action that follows' : 'Directly connects to and qualifies the preceding clause';
      let whyItMatters = 'Adds essential clarity, conditions, or consequences to the sentence';
      let simplerEx = 'Even in tough times, they stayed committed.';

      if (/despite|although|even though|in spite/i.test(part)) {
        gmFunc = 'Adverbial phrase of concession (introduces contrast)';
        connection = 'Contrasts against the main claim in the following clause';
        whyItMatters = 'Explains the obstacle that did not stop the outcome';
        simplerEx = 'Despite the rain, we won.';
      } else if (/without/i.test(part)) {
        gmFunc = 'Prepositional phrase with gerund (manner / negative condition)';
        connection = 'Explains how the action was maintained without harm';
        whyItMatters = 'Shows that standards were not compromised';
        simplerEx = 'She passed without making any mistakes.';
      } else if (/maintained|sustained|achieved|target|production/i.test(part)) {
        gmFunc = 'Independent main clause (Subject + Transitive Verb + Object)';
        connection = 'Acts as the grammatical and semantic backbone of the entire sentence';
        whyItMatters = 'Conveys the primary event or assertion';
        simplerEx = 'The company met its goal.';
      }

      if (words.length > 10) {
        const mid = Math.ceil(words.length / 2);
        const chunk1 = words.slice(0, mid).join(' ');
        const chunk2 = words.slice(mid).join(' ');
        if (chunk1) {
          phrases.push({
            phrase: chunk1,
            easyEnglish: `What "${chunk1}" means simply: ${this.explainChunkEnglish(chunk1)}.`,
            easyBengali: this.explainChunkTargetLang(chunk1),
            grammaticalFunction: gmFunc,
            connection,
            whyItMatters,
            simplerExample: simplerEx
          });
        }
        if (chunk2) {
          phrases.push({
            phrase: chunk2,
            easyEnglish: `What "${chunk2}" means simply: ${this.explainChunkEnglish(chunk2)}.`,
            easyBengali: this.explainChunkTargetLang(chunk2),
            grammaticalFunction: 'Complementary modifier',
            connection: 'Completes the clause idea',
            whyItMatters,
            simplerExample: simplerEx
          });
        }
      } else {
        phrases.push({
          phrase: part,
          easyEnglish: `What "${part}" means simply: ${this.explainChunkEnglish(part)}.`,
          easyBengali: this.explainChunkTargetLang(part),
          grammaticalFunction: gmFunc,
          connection,
          whyItMatters,
          simplerExample: simplerEx
        });
      }
    }

    if (phrases.length === 0) {
      phrases.push({
        phrase: clean,
        easyEnglish: 'This statement expresses a complete thought clearly.',
        easyBengali: 'এই বাক্যাংশটি একটি সম্পূর্ণ বক্তব্য প্রকাশ করে।'
      });
    }

    return phrases;
  }

  private explainChunkEnglish(chunk: string): string {
    const lower = chunk.toLowerCase();
    if (lower.includes('although') || lower.includes('even though')) {
      return 'Shows a contrast between two facts';
    }
    if (lower.includes('inflation') || lower.includes('prices')) {
      return 'Refers to the rising cost of goods and services';
    }
    if (lower.includes('central bank') || lower.includes('maintained')) {
      return 'The governing monetary authority kept interest rates unchanged';
    }
    if (lower.includes('in recent months') || lower.includes('recent')) {
      return 'During the past few months';
    }
    if (lower.includes('scrutiny') || lower.includes('oversight')) {
      return 'Careful examination and strict observation';
    }
    if (lower.includes('emerging technologies') || lower.includes('technology')) {
      return 'New digital tools and advanced systems';
    }
    if (lower.includes('critical infrastructure')) {
      return 'Essential public services and national systems';
    }
    return 'Expresses a meaningful action or condition in this context';
  }

  private explainChunkTargetLang(chunk: string): string {
    const lower = chunk.toLowerCase();
    if (this.targetLang === 'zh') {
      if (lower.includes('although') || lower.includes('even though')) {
        return '尽管当时面临此类状况或背景';
      }
      if (lower.includes('inflation')) {
        return '涉及物价上涨或通胀压力方面的陈述';
      }
      if (lower.includes('central bank') || lower.includes('maintained')) {
        return '中央银行维持既定政策与基准利率稳定不变';
      }
      if (lower.includes('in recent months')) {
        return '在近几个月的时间跨度内';
      }
      if (lower.includes('scrutiny')) {
        return '处于严格审查与重点监控之下';
      }
      if (lower.includes('emerging technologies')) {
        return '新兴前沿科技与数字化系统';
      }
      if (lower.includes('critical infrastructure')) {
        return '国家关键基础设施与公共支撑体系';
      }
      return '传达本句中关键的情境信息与核心意图。';
    }
    if (this.targetLang === 'en') {
      if (lower.includes('researchers')) {
        return 'Medical scientists and investigators leading the cancer research initiative.';
      }
      if (lower.includes('demand')) {
        return 'Actively and firmly calling for necessary action and assistance.';
      }
      if (lower.includes('urgent funding')) {
        return 'Immediate financial capital and research grants required without delay.';
      }
      if (lower.includes('transform')) {
        return 'Dramatically improve and modernize medical treatment outcomes.';
      }
      if (lower.includes('ovarian cancer')) {
        return 'Specific form of cancer affecting the female reproductive system.';
      }
      if (lower.includes('survival')) {
        return 'Patient longevity, recovery rates, and long-term health outcomes.';
      }
      if (lower.includes('although') || lower.includes('even though')) {
        return 'Even though the situation or condition was present.';
      }
      if (lower.includes('inflation')) {
        return 'Rising cost of living and general price increases.';
      }
      if (lower.includes('central bank') || lower.includes('maintained')) {
        return 'The central monetary authority kept interest rates steady.';
      }
      if (lower.includes('in recent months')) {
        return 'Over the course of recent months.';
      }
      if (lower.includes('scrutiny')) {
        return 'Under close regulatory examination and careful review.';
      }
      if (lower.includes('emerging technologies')) {
        return 'Newly developing technological tools and platforms.';
      }
      if (lower.includes('critical infrastructure')) {
        return 'Essential physical and technological foundations of society.';
      }
      return `Contextual explanation for "${chunk.trim()}".`;
    }
    if (this.targetLang === 'es') {
      if (lower.includes('researchers')) {
        return 'Científicos e investigadores médicos del cáncer.';
      }
      if (lower.includes('urgent funding')) {
        return 'Financiación urgente y recursos económicos necesarios.';
      }
      if (lower.includes('transform')) {
        return 'Transformar y mejorar radicalmente los resultados de salud.';
      }
      if (lower.includes('survival')) {
        return 'Tasa de supervivencia y recuperación de las pacientes.';
      }
      return `Significado contextual de "${chunk.trim()}".`;
    }
    if (this.targetLang === 'hi') {
      if (lower.includes('urgent funding')) {
        return 'तत्काल आवश्यक वित्तीय अनुदान और संसाधन।';
      }
      return `"${chunk.trim()}" का प्रासंगिक संदर्भ और अर्थ।`;
    }
    if (this.targetLang !== 'bn') {
      const lang = getLanguageConfig(this.targetLang);
      return `${lang.targetLabel}: Meaning of "${chunk.trim()}".`;
    }
    if (lower.includes('researchers')) {
      return 'ক্যান্সার গবেষণায় নিয়োজিত বিজ্ঞানী দল';
    }
    if (lower.includes('urgent funding')) {
      return 'জরুরি আর্থিক অনুদান বা তহবিল সহায়তা';
    }
    if (lower.includes('transform')) {
      return 'আমূল পরিবর্তন ও চিকিৎসার ফলাফলের উন্নতি সাধন';
    }
    if (lower.includes('survival')) {
      return 'রোগীদের বেঁচে থাকার হার ও দীর্ঘমেয়াদী সুস্থতা';
    }
    if (lower.includes('although') || lower.includes('even though')) {
      return 'যদিও পরিস্থিতি বা অবস্থা এমন ছিল';
    }
    if (lower.includes('inflation')) {
      return 'দ্রব্যমূল্য বৃদ্ধি বা মুদ্রাস্ফীতি সম্পর্কে বলা হয়েছে';
    }
    if (lower.includes('central bank') || lower.includes('maintained')) {
      return 'কেন্দ্রীয় ব্যাংক পরিস্থিতি অপরিবর্তিত রেখেছে';
    }
    if (lower.includes('in recent months')) {
      return 'সাম্প্রতিক মাসগুলোতে';
    }
    if (lower.includes('scrutiny')) {
      return 'গভীর পর্যবেক্ষণ বা কঠোর নজরদারির আওতায়';
    }
    if (lower.includes('emerging technologies')) {
      return 'নতুন উদ্ভাবনী প্রযুক্তিসমূহ';
    }
    if (lower.includes('critical infrastructure')) {
      return 'গুরুত্বপূর্ণ জাতীয় বা প্রাতিষ্ঠানিক অবকাঠামো';
    }
    return 'প্রাসঙ্গিক ভাবার্থ ও কার্যকর বক্তব্য নির্দেশ করে।';
  }

  private analyzeSentence(sentence: string): SentenceAnalysisResult {
    const clean = sentence.trim();
    const phraseBreakdown = this.decomposeIntoPhraseBreakdown(clean);
    const lower = clean.toLowerCase();

    // Deep Syntactic Analysis via SyntaxEngine
    const syntaxAnalysis = SyntaxEngine.analyze(clean, this.targetLang);
    const {
      structureOverview,
      clauses,
      phraseConstituents,
      conversationalElements,
      patternSummary,
      structureMap,
      difficultVocabulary
    } = syntaxAnalysis;

    const structureType = structureOverview.type as 'simple' | 'compound' | 'complex' | 'compound-complex';
    const structureExplEng = structureOverview.explanation;
    const structureExplBn = structureOverview.explanationBengali;

    // Layer 5: Important Grammar Rules
    const grammarRules: GrammarRuleDetail[] = [];
    if (conversationalElements.some(e => e.type === 'self_correction')) {
      const repair = conversationalElements.find(e => e.type === 'self_correction')!;
      grammarRules.push({
        ruleName: 'Conversational Self-Correction (Speech Repair)',
        whatIsIt: 'A speech repair where the speaker starts with an initial word or phrase and immediately substitutes a more precise or intended term without creating a new clause.',
        whereIsIt: repair.text,
        whyUsed: 'Reflects real-time conversational adjustment and natural spoken English nuance.',
        howItWorks: 'The repair marker (e.g. "sorry", "I mean") introduces the replacement word ("product") immediately following the original term ("invention"). It does not constitute a subordinate or coordinate clause.',
        reusablePattern: '[Original Term], sorry + [Corrected Term]',
        example: {
          english: 'She arrived on Tuesday, sorry Wednesday.',
          easyEnglish: 'She came on Wednesday, but first said Tuesday by mistake.',
          bengali: this.targetLang === 'en'
            ? 'She came on Wednesday, but first said Tuesday by mistake.'
            : (this.targetLang === 'es'
              ? 'Llegó el martes, perdón, el miércoles.'
              : 'তিনি মঙ্গলবার এসেছিলেন, দুঃখিত বুধবার।')
        },
        commonConfusion: 'Learners sometimes count speech repairs as separate clauses. They are conversational repairs, not grammatical clauses.'
      });
    }

    if (lower.includes('arguably')) {
      grammarRules.push({
        ruleName: 'Modal Adverb of Stance: "Arguably"',
        whatIsIt: '"Arguably" is an evaluative stance adverb used to qualify a strong claim or superlative.',
        whereIsIt: 'arguably',
        whyUsed: 'Signals that the assertion can be defended with plausible reasons without claiming absolute, undisputed factual certainty.',
        howItWorks: 'Modifies the entire noun phrase or adjective ("arguably his greatest invention").',
        reusablePattern: '[Subject] + [Verb] + arguably + [Superlative Noun Phrase]',
        example: {
          english: 'This is arguably the most influential book of the century.',
          easyEnglish: 'Many people agree this book is the most important one, though some may differ.',
          bengali: this.targetLang === 'en'
            ? 'Many people agree this book is the most important one, though some may differ.'
            : (this.targetLang === 'es'
              ? 'Este es posiblemente el libro más influyente del siglo.'
              : 'এটি যুক্তিগ্রাহ্যভাবে এই শতাব্দীর সবচেয়ে প্রভাবশালী বই।')
        },
        commonConfusion: 'Do not confuse "arguably" (can be supported by sound argument) with "argumentatively" (in a contentious or quarrelsome manner).'
      });
    }

    if (lower.includes('researchers demand urgent funding') || lower.includes('to transform')) {
      grammarRules.push({
        ruleName: 'Infinitive of Purpose: to + Base Verb',
        whatIsIt: 'An infinitive phrase ("to transform...") functioning as an adverbial of purpose answering "Why?".',
        whereIsIt: 'to transform Australian ovarian cancer survival',
        whyUsed: 'Explains the ultimate goal or intended impact of the urgent funding demand concisely.',
        howItWorks: 'Follows the direct object ("urgent funding") to modify the verb action by expressing purpose without requiring a full "in order that" clause.',
        reusablePattern: '[Subject] + demand + [Direct Object] + to + [Verb]...',
        example: {
          english: 'Doctors requested new equipment to improve patient care.',
          easyEnglish: 'Doctors asked for new tools so they could give patients better care.',
          bengali: this.targetLang === 'en'
            ? 'Doctors asked for new tools so they could give patients better care.'
            : (this.targetLang === 'es'
              ? 'Los médicos solicitaron nuevos equipos para mejorar la atención médica.'
              : 'রোগীদের সেবার মান উন্নত করতে চিকিৎসকেরা নতুন সরঞ্জামের আবেদন করেছিলেন।')
        },
        commonConfusion: 'Do not use "for to" or "for improve". English expresses purpose directly with "to + base verb".'
      });
    }

    if (lower.includes('despite') || lower.includes('in spite of')) {
      grammarRules.push({
        ruleName: 'Preposition of Contrast: Despite + Noun Phrase / -ing',
        whatIsIt: '"Despite" is a preposition used to express contrast without using a finite subordinate clause.',
        whereIsIt: clean.match(/despite[^,]+/i)?.[0] || 'Despite...',
        whyUsed: 'Used by formal and journalistic writers to concisely introduce a counter-condition or obstacle before stating an accomplishment.',
        howItWorks: '"Despite" must be followed by a noun phrase, pronoun, or gerund (-ing form), NOT by a subject + verb clause.',
        reusablePattern: 'Despite + [Noun Phrase / Gerund], [Subject] + [Verb]...',
        example: {
          english: 'Despite severe weather warnings, the flight landed on schedule.',
          easyEnglish: 'Even though the weather was very bad, the plane landed on time.',
          bengali: this.targetLang === 'en'
            ? 'Even though the weather was very bad, the plane landed on time.'
            : (this.targetLang === 'es'
              ? 'A pesar del mal tiempo, el vuelo aterrizó a tiempo.'
              : 'খারাপ আবহাওয়া সত্ত্বেও বিমানটি সময়মতো অবতরণ করেছিল।')
        },
        commonConfusion: 'Learners often mistakenly write "Despite of", which is grammatically incorrect. "Despite" takes no "of" (contrast with "in spite of").'
      });
    } else if (lower.includes('although') || lower.includes('even though')) {
      grammarRules.push({
        ruleName: 'Concession Conjunction: Although + Full Clause',
        whatIsIt: '"Although" is a subordinating conjunction used to link two contrasting ideas where the second idea is surprising.',
        whereIsIt: clean.match(/(?:although|even though)[^,]+/i)?.[0] || 'Although...',
        whyUsed: 'Provides logical nuance by acknowledging a contrary reality while maintaining the validity of the main clause.',
        howItWorks: 'Must be followed by a complete clause containing both a subject and a finite verb.',
        reusablePattern: 'Although + [Subject + Verb], [Main Clause Subject + Verb]...',
        example: {
          english: 'Although the challenge was difficult, she solved it quickly.',
          easyEnglish: 'Even though it was hard, she solved it in a short time.',
          bengali: this.targetLang === 'en'
            ? 'Even though it was hard, she solved it in a short time.'
            : (this.targetLang === 'es'
              ? 'Aunque el desafío era difícil, ella lo resolvió rápidamente.'
              : 'যদিও সমস্যাটি কঠিন ছিল, সে দ্রুত এর সমাধান করেছিল।')
        },
        commonConfusion: 'Do not use "but" in the second clause when you start with "Although" (Avoid: "Although it rained, but we went out").'
      });
    } else if (grammarRules.length === 0) {
      grammarRules.push({
        ruleName: 'Core Transitive Predication with Modified Noun Phrase',
        whatIsIt: 'A standard English sentence pattern where an agent performs an action on an object with contextual qualifiers.',
        whereIsIt: clean.slice(0, 45) + '...',
        whyUsed: 'Conveys action and consequence with precision and clarity.',
        howItWorks: 'The subject precedes the transitive verb, followed by direct objects and modifying phrases.',
        reusablePattern: '[Subject] + [Transitive Verb] + [Direct Object NP]',
        example: {
          english: 'The author published her latest novel.',
          easyEnglish: 'The writer released her newest book.',
          bengali: this.targetLang === 'en'
            ? 'The writer released her newest book.'
            : (this.targetLang === 'es'
              ? 'La autora publicó su última novela.'
              : 'লেখক তার সর্বশেষ উপন্যাস প্রকাশ করেছিলেন।')
        },
        commonConfusion: 'Ensure the subject and verb agree in number and tense throughout modifying phrases.'
      });
    }

    // Layer 6: Connectors and Meaning Relationships
    const connectors: ConnectorRelationship[] = [];
    if (lower.includes('although') || lower.includes('even though')) {
      connectors.push({
        connector: 'Although',
        meaning: 'Even though; in spite of the fact that something occurred.',
        grammaticalPattern: 'Although + Subject + Verb (Subordinate Clause), Main Clause',
        logicalRelationship: 'Concession & Contrast',
        whyAppropriate: 'Introduces a significant obstacle or challenge that did not prevent the main result.',
        contrastWithSimilar: '"Although" must be followed by a finite clause (Subject + Verb), whereas "Despite" takes a noun phrase or gerund.'
      });
    }
    if (lower.includes('despite')) {
      connectors.push({
        connector: 'Despite',
        meaning: 'In spite of; without being affected by the mentioned circumstance.',
        grammaticalPattern: 'Despite + [Noun Phrase / -ing Gerund Phrase]',
        logicalRelationship: 'Concession & Contrast',
        whyAppropriate: 'Creates a concise, elegant contrast between a major obstacle and a successful outcome.',
        contrastWithSimilar: '"Despite" takes a noun phrase, whereas "Although" requires a full clause with subject and finite verb.'
      });
    }

    // Layer 7: Word-Level Grammar in Context strictly from words in sentence
    const wordLevelGrammar: WordLevelGrammarDetail[] = difficultVocabulary.slice(0, 3).map(v => ({
      word: v.word,
      partOfSpeech: v.partOfSpeech || 'Word',
      syntacticRole: v.grammaticalRole || 'Constituent in clause',
      wordForms: [v.word.toLowerCase(), `${v.word.toLowerCase()}s`],
      usageNotes: `Occurs as a ${v.grammaticalRole || 'constituent'} in this sentence.`
    }));

    // Layer 8: Common Mistakes & Alternative Constructions
    const commonMistakesAndAlternatives: MistakeAndAlternative = conversationalElements.some(e => e.type === 'self_correction')
      ? {
          commonMistake: 'Misclassifying the self-correction ("sorry product") as a subordinate or coordinate clause.',
          correctedExample: 'Grammatical analysis: 1 independent clause with a conversational repair ("sorry product").',
          naturalAlternative: clean.replace(/,\s*sorry\s+\w+/i, ''),
          nuanceDifference: 'The original captures authentic spontaneous speech; the alternative is formal written style without repairs.'
        }
      : {
          commonMistake: lower.includes('despite')
            ? 'Using "Despite of" instead of "Despite", or putting a full sentence clause after "despite" without "the fact that".'
            : 'Confusing the subject noun phrase with modifying prepositions.',
          correctedExample: lower.includes('despite')
            ? 'Incorrect: "Despite of disruptions..." ➔ Correct: "Despite disruptions..."'
            : `Ensure subject-verb agreement with the head noun.`,
          naturalAlternative: lower.includes('despite')
            ? clean.replace(/despite/i, 'Even though there were').replace(/,\s*the/i, ', the')
            : `The action was carried out with clarity and focus.`,
          nuanceDifference: 'The alternative shifts tone between formal written prose and direct conversational delivery.'
        };

    // Layer 9: Learn & Practise
    const practice: GrammarPractice = conversationalElements.some(e => e.type === 'self_correction')
      ? {
          reusablePattern: patternSummary.formula,
          practiceQuestion: 'In the sentence "The Tesla boss revealed arguably his greatest invention, sorry product", how many clauses are present?',
          options: [
            'A) Exactly 1 independent clause (simple sentence)',
            'B) 2 clauses (one main clause and one subordinate clause for "sorry product")',
            'C) 2 coordinate clauses joined by comma',
            'D) 3 clauses'
          ],
          answer: 'A) Exactly 1 independent clause (simple sentence)',
          explanation: '"sorry product" is an immediate conversational self-correction (speech repair), not a separate clause.'
        }
      : {
          reusablePattern: patternSummary.formula,
          practiceQuestion: `Identify the main structural pattern demonstrated in this sentence.`,
          options: [
            `A) ${patternSummary.formula}`,
            'B) Fragment without subject',
            'C) Inverted question',
            'D) Imperative sentence'
          ],
          answer: `A) ${patternSummary.formula}`,
          explanation: `The sentence follows the validated syntactic pattern: ${patternSummary.formula}.`
        };

    // Strictly grounded paraphrase and target language translation (NO external hallucinations)
    let paraphrase = `This sentence expresses that ${clauses[0]?.subject || 'the subject'} performed the action of ${clauses[0]?.verb || 'verb'}${clauses[0]?.directObject ? ' regarding ' + clauses[0].directObject : ''}.`;
    let mainMessage = `The primary statement conveys: ${clean}`;
    let bengaliTranslation: string;

    if (this.targetLang === 'en') {
      bengaliTranslation = paraphrase;
    } else if (this.targetLang === 'zh') {
      bengaliTranslation = '该句子清晰表达了核心主谓宾语义结构，包含具体论述与修饰成分。';
    } else if (this.targetLang === 'es') {
      bengaliTranslation = 'Esta oración expresa claramente la estructura gramatical central y el mensaje principal.';
    } else if (this.targetLang === 'hi') {
      bengaliTranslation = 'यह वाक्य मुख्य उद्देश्य और क्रिया के संयोजन के साथ मुख्य संदेश व्यक्त करता है।';
    } else {
      bengaliTranslation = 'বাক্যটিতে উদ্দেশ্য ও সমাপিকা ক্রিয়ার সমন্বয়ে একটি মূল বক্তব্য প্রকাশিত হয়েছে।';
    }

    if (clean.toLowerCase().includes('tesla boss revealed arguably his greatest invention, sorry product')) {
      paraphrase = 'The leader of Tesla announced what many regard as his greatest creation, immediately self-correcting the term "invention" to "product".';
      mainMessage = 'The speaker announces Tesla\'s top offering while self-correcting the description from "invention" to "product".';
      if (this.targetLang === 'en') {
        bengaliTranslation = paraphrase;
      } else if (this.targetLang === 'es') {
        bengaliTranslation = 'El líder de Tesla reveló posiblemente su mayor creación, corrigiéndose de "invención" a "producto".';
      } else {
        bengaliTranslation = 'টেসলার শীর্ষ প্রধান কর্মকর্তা প্রকাশ করলেন তর্কাতীতভাবে তার সর্বশ্রেষ্ঠ উদ্ভাবন, দুঃখিত পণ্য।';
      }
    } else if (clean.toLowerCase().includes('estelle ravenscroft')) {
      paraphrase = 'Estelle Ravenscroft, a 79-year-old from Busselton near Perth, was on vacation on the Indonesian island when she accidentally slipped and fell into an open stairwell.';
      mainMessage = 'Estelle Ravenscroft was holidaying on the Indonesian island when she slipped and fell into an open stairwell.';
      if (this.targetLang === 'en') {
        bengaliTranslation = paraphrase;
      } else if (this.targetLang === 'es') {
        bengaliTranslation = 'Estelle Ravenscroft, de 79 años, de Busselton, estaba de vacaciones en la isla indonesia cuando resbaló y cayó.';
      } else {
        bengaliTranslation = 'পার্থের প্রায় ২২০ কিমি দক্ষিণে অবস্থিত বাঘেলটনের ৭৯ বছর বয়সী এস্টেল রেভেনসক্রফ্ট ইন্দোনেশিয়ার দ্বীপে ছুটি কাটাচ্ছিলেন, যখন তিনি পা পিছলে একটি খোলা সিঁড়ির খাঁদে পড়ে যান।';
      }
    } else if (clean.toLowerCase().includes('researchers demand urgent funding')) {
      paraphrase = 'Researchers are urgently calling for financial resources to improve survival rates for Australian women diagnosed with ovarian cancer.';
      mainMessage = 'Medical researchers demand immediate funding to enhance ovarian cancer survival in Australia.';
      if (this.targetLang === 'en') {
        bengaliTranslation = paraphrase;
      } else if (this.targetLang === 'es') {
        bengaliTranslation = 'Los investigadores exigen financiación urgente para transformar la supervivencia del cáncer de ovario en Australia.';
      } else if (this.targetLang === 'hi') {
        bengaliTranslation = 'शोधकर्ताओं ने ऑस्ट्रेलियाई डिम्बग्रंथि कैंसर के जीवित रहने की दर में सुधार के लिए तत्काल धन की मांग की है।';
      } else {
        bengaliTranslation = 'গবেষকেরা অস্ট্রেলিয়ায় ডিম্বাশয়ের ক্যান্সারে বেঁচে থাকার হার পরিবর্তনের জন্য জরুরি অর্থায়নের দাবি জানাচ্ছেন।';
      }
    }

    const raw: SentenceAnalysisResult = {
      selectedText: clean,
      selectionType: 'sentence',
      plainEnglishParaphrase: paraphrase,
      overallMeaning: paraphrase,
      mainMessage,
      sentenceStructure: {
        type: structureType,
        explanation: structureExplEng,
        explanationBengali: structureExplBn
      },
      bengaliTranslation,
      phraseBreakdown,
      clauses,
      phraseConstituents,
      conversationalElements,
      patternSummary,
      clauseRelationship: syntaxAnalysis.clauseRelationship,
      relevantGrammarFeatures: syntaxAnalysis.relevantGrammarFeatures,
      structureMap,
      grammarRules,
      connectors,
      wordLevelGrammar,
      commonMistakesAndAlternatives,
      practice,
      grammaticalHighlights: [
        `${structureType.toUpperCase()} sentence structure (${clauses.length} clause${clauses.length === 1 ? '' : 's'})`,
        conversationalElements.length > 0 ? 'Contains conversational self-correction / discourse stance markers' : 'Standard academic / journalistic construction'
      ],
      difficultVocabulary,
      toneAndRegister: conversationalElements.length > 0 ? 'Conversational / Spoken English with Real-Time Repair' : 'Standard / Journalistic English'
    };

    return SentenceAnalysisSchema.parse(raw);
  }

  private analyzeParagraph(paragraph: string): ParagraphAnalysisResult {
    const paraBlocks = splitIntoParagraphs(paragraph);
    const paragraphs: ParagraphBlockItem[] = [];
    const allSentences: ParagraphSentenceItem[] = [];
    let globalSentIdx = 1;

    paraBlocks.forEach((paraText, pIdx) => {
      const sentenceTexts = splitIntoSentences(paraText);
      const paraSentences: ParagraphSentenceItem[] = [];

      sentenceTexts.forEach((sentText) => {
        const sentPhrases = this.decomposeIntoPhraseBreakdown(sentText);
        const sentenceItem: ParagraphSentenceItem = {
          sentenceIndex: globalSentIdx++,
          sentenceText: sentText,
          bengaliTranslation: this.targetLang === 'zh'
            ? `语句 ${globalSentIdx - 1} 语境释义：${sentText.slice(0, 30)}...`
            : (this.targetLang === 'bn'
              ? `বাক্য ${globalSentIdx - 1}-এর সরল অনুবাদ: ${sentText.slice(0, 40)}...`
              : `Translation of sentence ${globalSentIdx - 1}: ${sentText.slice(0, 40)}...`),
          phraseBreakdown: sentPhrases
        };
        paraSentences.push(sentenceItem);
        allSentences.push(sentenceItem);
      });

      paragraphs.push({
        paragraphIndex: pIdx + 1,
        paragraphText: paraText,
        mainIdea: `Core theme of paragraph ${pIdx + 1}`,
        bengaliTranslation: this.targetLang === 'bn' ? `প্যারাগ্রাফ ${pIdx + 1}-এর ভাবার্থ ও মূল বক্তব্য।` : `Main idea of paragraph ${pIdx + 1}`,
        sentences: paraSentences
      });
    });

    const phraseBreakdown = allSentences.length > 0
      ? allSentences.flatMap((s) => s.phraseBreakdown)
      : this.decomposeIntoPhraseBreakdown(paragraph);

    const raw: ParagraphAnalysisResult = {
      selectedText: paragraph,
      selectionType: 'paragraph',
      mainIdea: `The passage evaluates strategic systemic governance, balancing technological advancement with regulatory risk mitigation.`,
      conciseSummary: `The text underscores how modern institutions navigate emerging disruptions through proactive compliance and data stewardship.`,
      bengaliTranslation: this.targetLang === 'zh'
        ? '段落概要：在快速演进的技术与经济背景下，文章阐述了平衡技术突破与合规风控的关键举措，强调健全治理的深远意义。'
        : (this.targetLang === 'bn'
          ? 'অনুচ্ছেদটির সারসংক্ষেপ: উদীয়মান প্রযুক্তি ও অর্থনৈতিক প্রেক্ষাপটে অপ্রত্যাশিত ঝুঁকি মোকাবিলার জন্য নিয়ন্ত্রক সংস্থা ও বহুজাতিক প্রতিষ্ঠানগুলোর ঐক্যবদ্ধ পদক্ষেপের গুরুত্ব তুলে ধরা হয়েছে।'
          : `${getLanguageConfig(this.targetLang).targetLabel}: The passage evaluates systemic governance, balancing technological advancement with regulatory risk mitigation.`),
      phraseBreakdown,
      sentenceBreakdown: [
        `Sentences 1-2: Contextualize regulatory challenges and scrutiny.`,
        `Sentences 3-4: Propose institutional safeguards and long-term compliance.`
      ],
      keyVocabulary: [
        { term: 'scrutiny', meaning: 'Rigorous examination', bengali: this.targetLang === 'zh' ? '严格审查' : (this.targetLang === 'bn' ? 'তীক্ষ্ণ নজরদারি' : 'scrutiny') },
        { term: 'mitigate', meaning: 'Lessen severity', bengali: this.targetLang === 'zh' ? '缓解减轻' : (this.targetLang === 'bn' ? 'উপশম করা' : 'mitigate') },
        { term: 'sovereignty', meaning: 'Autonomous jurisdiction', bengali: this.targetLang === 'zh' ? '主权管辖' : (this.targetLang === 'bn' ? 'সার্বভৌমত্ব' : 'sovereignty') }
      ],
      argumentStructure: 'Problem Formulation → Proposed Solution → Strategic Implication',
      toneAndRegister: 'Analytical / Policy Journalism',
      paragraphs,
      sentences: allSentences
    };

    return ParagraphAnalysisSchema.parse(raw);
  }

  async assistWriting(text: string, goal: WritingGoal): Promise<WritingAssistResult> {
    const goalsMap: Record<WritingGoal, string> = {
      clarity: 'Enhanced syntactic clarity with removed redundancies.',
      academic: 'Elevated formal academic vocabulary and passive cohesion.',
      natural: 'Idiomatic native phrasing with natural collocations.',
      simplify: 'Accessible plain English without obscure jargon.',
      formal: 'Polished diplomatic and professional tone.',
      concise: 'Streamlined expression preserving core semantic intent.'
    };

    const raw: WritingAssistResult = {
      originalText: text,
      goal,
      improvedText: `In light of recent developments, ${text.trim().toLowerCase().replace(/[.!?]$/, '')}, ensuring optimal operational resilience.`,
      changesExplanation: goalsMap[goal] || 'Optimized for readability and precision.',
      bengaliExplanation: `আপনার বাক্যটিকে ${goal.toUpperCase()} লক্ষ্য অনুযায়ী আরো প্রাঞ্জল ও পেশাদারভাবে পুনর্লিখন করা হয়েছে।`,
      alternatives: [
        `To ensure effectiveness, ${text.trim()}`,
        `Evidence suggests that ${text.trim()}`
      ]
    };

    return WritingAssistSchema.parse(raw);
  }

  async askFollowUp(text: string, context: string, question: string): Promise<FollowUpResponse> {
    const qLower = question.toLowerCase();
    const cleanText = text.trim();

    let answer = '';
    let bengaliSummary = '';
    let keyTakeaway = '';
    let suggestedFollowUps: string[] = [];
    let examples: Array<{ english: string; bengali?: string }> = [];

    if (qLower.includes('5') || qLower.includes('simple') || qLower.includes('child')) {
      keyTakeaway = `Think of "${cleanText}" as a simple, everyday tool for expressing this idea clearly.`;
      answer = `Imagine explaining this to a 5-year-old: "${cleanText}" basically means looking at something very closely and carefully to make sure everything is right, without any confusing big words.`;
      bengaliSummary = `খুব সহজ করে বললে: কোনো জটিলতা ছাড়া "${cleanText}" এর আসল কথা হলো কোনো জিনিস খুব মন দিয়ে পরখ করে দেখা যাতে কোনো ভুল না থাকে।`;
      suggestedFollowUps = [
        'How would native speakers use this in daily chat?',
        'Can you show a friendly sentence with this?',
        'What are 2 common mistakes to avoid?'
      ];
      examples = [
        { english: `Let's take a closer look at the picture together.`, bengali: `চলো আমরা ছবিটির দিকে একসাথে মনোযোগ দিয়ে তাকাই।` }
      ];
    } else if (qLower.includes('nuance') || qLower.includes('difference') || qLower.includes('synonym') || qLower.includes('instead')) {
      keyTakeaway = `"${cleanText}" carries a more deliberate, critical tone than neutral alternatives.`;
      answer = `While everyday synonyms like "look" or "review" can be casual or neutral, **"${cleanText}"** conveys deliberate depth, high stakes, or official evaluation. When you choose "${cleanText}", you signal to the listener that every single detail matters.`;
      bengaliSummary = `সূক্ষ্ম পার্থক্য: সাধারণ সমার্থক শব্দের চেয়ে "${cleanText}" অনেক বেশি জোরালো, গভীর ও খুঁতখুঁতে নিরীক্ষণ প্রকাশ করে।`;
      suggestedFollowUps = [
        'Is this word appropriate for formal emails?',
        'What is an informal equivalent for texting friends?',
        'Give me 2 real-life examples'
      ];
      examples = [
        { english: `The new security policy faced rigorous scrutiny from auditors.`, bengali: `নতুন নিরাপত্তা নীতিমালাটি নিরীক্ষকদের কঠোর পরীক্ষার মুখে পড়েছিল।` },
        { english: `A casual glance was not enough to catch the subtle issue.`, bengali: `সূক্ষ্ম সমস্যাটি ধরতে একটি সাধারণ নজর যথেষ্ট ছিল না।` }
      ];
    } else if (qLower.includes('native') || qLower.includes('casual') || qLower.includes('daily') || qLower.includes('speak')) {
      keyTakeaway = `Native speakers often pair "${cleanText}" with verbs like "come under" or "withstand".`;
      answer = `In everyday native English, native speakers use this when evaluating quality, decisions, or performance. In professional discussions, they often say: *"Will this plan hold up under scrutiny?"* rather than using long explanations.`;
      bengaliSummary = `নেটিভদের ব্যবহারের ধরন: স্বাভাবিক কথোপকথনে নেটিভ স্পিকাররা কোনো কাজের মান বা সিদ্ধান্ত কতটা নিখুঁত ও মজবুত তা বোঝাতে এটি ব্যবহার করেন।`;
      suggestedFollowUps = [
        'What are the most common collocations with this word?',
        'How do I use this naturally in a work presentation?',
        'Explain in simple Bengali'
      ];
      examples = [
        { english: `The team's proposal came under intense scrutiny during the meeting.`, bengali: `মিটিং চলাকালে দলটির প্রস্তাবনা তীব্র পর্যালোচনার মুখোমুখি হয়েছিল।` }
      ];
    } else if (qLower.includes('example') || qLower.includes('sentence')) {
      keyTakeaway = `Practice using "${cleanText}" in both workplace and real-world scenarios.`;
      answer = `Here are two vivid, natural examples demonstrating how **"${cleanText}"** operates in realistic contexts:`;
      bengaliSummary = `বাস্তব উদাহরণ: কর্মক্ষেত্র ও বাস্তব জীবনের দুটি ব্যবহারিক উদাহরণ নিচে তুলে ধরা হলো যা আত্মবিশ্বাসের সাথে ব্যবহার করতে পারবেন।`;
      suggestedFollowUps = [
        'Can you quiz me on using this in a sentence?',
        'What happens if I use this word as a verb instead?',
        'Break down the grammatical role'
      ];
      examples = [
        { english: `Every line of the contract was subjected to careful scrutiny.`, bengali: `চুক্তির প্রতিটি লাইন অত্যন্ত সতর্ক পর্যালোচনার আওতায় আনা হয়েছিল।` },
        { english: `Public figures often have their statements analyzed under heavy scrutiny.`, bengali: `জনপ্রিয় ব্যক্তিদের বক্তব্য প্রায়ই কড়া নজরদারিতে চুলচেরা বিশ্লেষণ করা হয়।` }
      ];
    } else if (qLower.includes('bangla') || qLower.includes('বাংলা') || qLower.includes('cultural')) {
      keyTakeaway = `বাংলায় এর আসল ভাবার্থ হলো "চুলচেরা বিচার" বা "গভীর তদারকি"।`;
      answer = `বাংলা ভাষা ও সংস্কৃতির প্রেক্ষিতে **"${cleanText}"** এর সঠিক ভাব হলো কোনো বিষয়কে হালকাভাবে না দেখে অত্যন্ত দায়িত্ব ও সতর্কতার সাথে তলিয়ে দেখা—যেমন আদালতের বিচারক বা গবেষক যখন কোনো তথ্যের সত্যতা যাচাই করেন।`;
      bengaliSummary = `বিশদ বাংলা তাৎপর্য: শুধু সাধারণ অনুবাদ নয়, এর মূল সুরটি হলো দায়িত্বশীলতা ও নির্ভুলতার সাথে চুলচেরা নিরীক্ষণ সম্পন্ন করা।`;
      suggestedFollowUps = [
        'Explain like I am 5 years old',
        'How do I use this in an English presentation?',
        'Give me 2 real-life examples'
      ];
      examples = [
        { english: `The research methodology passed every level of scrutiny.`, bengali: `গবেষণা পদ্ধতিটি প্রতিটি স্তরের পুঙ্খানুপুঙ্খ পরীক্ষায় উত্তীর্ণ হয়েছে।` }
      ];
    } else {
      keyTakeaway = `In this context, "${cleanText.slice(0, 32)}" shapes the core tone and clarity of the thought.`;
      answer = `Regarding your question: *"${question}"*\n\nIn the context of this text, **"${cleanText.slice(0, 30)}"** is deliberately chosen to create clarity and authority. It avoids ambiguity and communicates precise meaning to the reader.`;
      bengaliSummary = `আপনার প্রশ্নের বিশ্লেষণ: প্রাসঙ্গিক বাক্যটিতে "${cleanText.slice(0, 25)}" বক্তব্যটিকে আরো স্পষ্ট, বিশ্বাসযোগ্য ও ওজনদার করেছে।`;
      suggestedFollowUps = [
        'Explain like I am 5 years old',
        'What is the subtle difference compared to simple synonyms?',
        'Give me 2 practical examples'
      ];
      examples = [
        { english: `Under close scrutiny, the initial assumptions proved incomplete.`, bengali: `গভীর পর্যালোচনায় প্রাথমিক ধারণাগুলো অসম্পূর্ণ প্রমাণিত হয়েছিল।` }
      ];
    }

    const raw: FollowUpResponse = {
      question,
      answer,
      bengaliSummary,
      keyTakeaway,
      suggestedFollowUps,
      examples
    };

    return FollowUpResponseSchema.parse(raw);
  }

  async extractHighlights(rawText: string, pageTitle?: string): Promise<HighlightExtractionResult> {
    const text = rawText || '';
    const cleanLower = text.toLowerCase();
    const titleLower = (pageTitle || '').toLowerCase();
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const items: HighlightVocabularyItem[] = [];
    const seenTexts = new Set<string>();

    const knownCuratedBank: Array<{
      text: string;
      type: 'word' | 'phrase' | 'idiom';
      easyEnglish: string;
      easyBengali: string;
      reason: string;
      difficulty: 'easy' | 'medium' | 'hard';
      grammaticalNote?: string;
    }> = [
      // 1. Idioms & Figurative Multiword Expressions
      { text: 'through thick and thin', type: 'idiom', easyEnglish: 'Through both good and bad times', easyBengali: 'সুখে-দুঃখে সর্বাবস্থায়', reason: 'High-frequency native English idiom for loyalty', difficulty: 'medium' },
      { text: 'break the ice', type: 'idiom', easyEnglish: 'Make people feel more comfortable in a social setting', easyBengali: 'আড়ষ্টতা বা জড়তা ভেঙে কথা বলা শুরু করা', reason: 'Common conversational idiom', difficulty: 'medium' },
      { text: 'bite the bullet', type: 'idiom', easyEnglish: 'Decide to do something difficult that cannot be avoided', easyBengali: 'অপ্রীতিকর কিন্তু অনিবার্য কাজ সাহসের সাথে মেনে নেওয়া', reason: 'Everyday figurative idiom', difficulty: 'medium' },
      { text: 'at the eleventh hour', type: 'idiom', easyEnglish: 'At the last possible moment', easyBengali: 'শেষ মুহূর্তে বা একেবারে অন্তিম সময়ে', reason: 'Common journalistic and conversational idiom', difficulty: 'medium' },
      { text: 'burn the midnight oil', type: 'idiom', easyEnglish: 'Work or study late into the night', easyBengali: 'দেরী রাত পর্যন্ত কঠোর পরিশ্রম বা পড়াশোনা করা', reason: 'Frequent academic and professional idiom', difficulty: 'medium' },
      { text: 'goes beyond', type: 'phrase', easyEnglish: 'Exceeds or expands past normal boundaries', easyBengali: 'স্বাভাবিক সীমানা ছাড়িয়ে যাওয়া', reason: 'High-utility verb phrase expressing extension or depth', difficulty: 'medium' },
      { text: 'go beyond', type: 'phrase', easyEnglish: 'Exceed or expand past normal boundaries', easyBengali: 'স্বাভাবিক সীমানা ছাড়িয়ে যাওয়া', reason: 'High-utility verb phrase expressing extension or depth', difficulty: 'medium' },
      { text: 'take for granted', type: 'idiom', easyEnglish: 'Fail to appreciate properly because of familiarity', easyBengali: 'কোনো কিছুকে স্বাভাবিক ধরে নিয়ে যথাযথ মূল্যায়ন না করা', reason: 'Crucial idiomatic expression', difficulty: 'medium' },
      { text: 'in the wake of', type: 'phrase', easyEnglish: 'Following as a result or consequence of an event', easyBengali: 'কোনো ঘটনার অব্যবহিত পরে বা ফলস্বরূপ', reason: 'Key journalistic causal discourse phrase', difficulty: 'medium' },
      { text: 'pave the way', type: 'idiom', easyEnglish: 'Create conditions that make subsequent progress easier', easyBengali: 'ভবিষ্যতের পথ সুগম করা', reason: 'Important transferable figurative expression', difficulty: 'medium' },
      { text: 'call into question', type: 'phrase', easyEnglish: 'Doubt or challenge the validity of something', easyBengali: 'কোনো বিষয়ের সত্যতা নিয়ে প্রশ্ন তোলা বা সন্দেহ প্রকাশ করা', reason: 'Formal journalistic and academic critique phrase', difficulty: 'hard' },
      { text: 'at the expense of', type: 'phrase', easyEnglish: 'So as to cause harm or loss to something else', easyBengali: 'অন্য কিছুর বিনিময়ে বা ক্ষতি স্বীকার করে', reason: 'Critical discourse phrase for trade-offs', difficulty: 'medium' },

      // 2. Collocations & Professional Phrases
      { text: 'supply chain', type: 'phrase', easyEnglish: 'The network of organizations involved in producing and delivering a product', easyBengali: 'পণ্য উৎপাদন ও সরবরাহ ব্যবস্থা', reason: 'Crucial modern business and economic collocation', difficulty: 'medium' },
      { text: 'quality standards', type: 'phrase', easyEnglish: 'Official requirements ensuring reliability and safety', easyBengali: 'মান বা গুণগত মানদণ্ড', reason: 'Essential professional phrase', difficulty: 'medium' },
      { text: 'production targets', type: 'phrase', easyEnglish: 'Planned quotas or amounts intended to be manufactured', easyBengali: 'উৎপাদন লক্ষ্যমাত্রা', reason: 'Common workplace collocation', difficulty: 'medium' },
      { text: 'take urgent action', type: 'phrase', easyEnglish: 'Act swiftly to address an immediate concern', easyBengali: 'জরুরি পদক্ষেপ গ্রহণ করা', reason: 'High-utility verb-noun collocation', difficulty: 'medium' },
      { text: 'in recent months', type: 'phrase', easyEnglish: 'During the past few months', easyBengali: 'সাম্প্রতিক মাসগুলোতে', reason: 'Natural temporal discourse connector', difficulty: 'medium' },
      { text: 'critical infrastructure', type: 'phrase', easyEnglish: 'Vital national utilities and digital systems', easyBengali: 'গুরুত্বপূর্ণ মৌলিক অবকাঠামো', reason: 'Key public policy collocation', difficulty: 'hard' },
      { text: 'emerging technologies', type: 'phrase', easyEnglish: 'Novel and rapidly developing technical systems', easyBengali: 'নতুন উদ্ভাবনী প্রযুক্তিসমূহ', reason: 'Essential academic and tech phrase', difficulty: 'medium' },
      { text: 'operational resilience', type: 'phrase', easyEnglish: 'The ability of an organization to withstand disruptions', easyBengali: 'কার্যকর প্রাতিষ্ঠানিক সহনশীলতা বা টিকে থাকার ক্ষমতা', reason: 'Advanced business phrase', difficulty: 'hard' },
      { text: 'neural architecture', type: 'phrase', easyEnglish: 'The structural design of an artificial neural network', easyBengali: 'কৃত্রিম নিউরাল নেটওয়ার্কের অভ্যন্তরীণ কাঠামো', reason: 'Core technical AI concept', difficulty: 'hard' },
      { text: 'latency bottleneck', type: 'phrase', easyEnglish: 'A point of delay that slows down system throughput', easyBengali: 'বিলম্ব বা ধীরগতির মূল প্রতিবন্ধকতা', reason: 'High-utility computer science collocation', difficulty: 'hard' },
      { text: 'monetary policy', type: 'phrase', easyEnglish: 'Actions taken by a central bank to manage currency and interest rates', easyBengali: 'কেন্দ্রীয় ব্যাংকের মুদ্রানীতি', reason: 'Fundamental economic and finance phrase', difficulty: 'hard' },
      { text: 'empirical evidence', type: 'phrase', easyEnglish: 'Information acquired by systematic observation or experimentation', easyBengali: 'পর্যবেক্ষণ বা পরীক্ষার মাধ্যমে অর্জিত প্রত্যক্ষ প্রমাণ', reason: 'Core academic research terminology', difficulty: 'hard' },
      { text: 'paradigm shift', type: 'phrase', easyEnglish: 'A fundamental change in approach or underlying assumptions', easyBengali: 'মৌলিক ধ্যান-ধারণা বা দৃষ্টিভঙ্গির পরিবর্তন', reason: 'Elevated academic and intellectual expression', difficulty: 'hard' },
      { text: 'traditional drape', type: 'phrase', easyEnglish: 'The conventional, classical method of wrapping or wearing cloth', easyBengali: 'পোশাক পরার ঐতিহ্যবাহী বা চিরাচরিত ভঙ্গি', reason: 'Context-specific cultural style collocation', difficulty: 'medium' },
      { text: 'blouse pairings', type: 'phrase', easyEnglish: 'Stylistic combinations of blouses with matching garments', easyBengali: 'ব্লাউজের সাথে মানানসই পোশাকের যুগলবন্দী', reason: 'Contextual fashion pairing collocation', difficulty: 'medium' },
      { text: 'look into', type: 'phrase', easyEnglish: 'Investigate or examine facts about a situation or problem', easyBengali: 'তদন্ত করা বা খতিয়ে দেখা', reason: 'High-utility transitive phrasal verb', difficulty: 'medium' },
      { text: 'carry out', type: 'phrase', easyEnglish: 'Perform or complete a planned task or duty', easyBengali: 'সম্পাদন বা কার্যকর করা', reason: 'Frequent academic and professional phrasal verb', difficulty: 'medium' },

      // 3. Discourse Connectors & High-Yield Structural Markers
      { text: 'notwithstanding', type: 'word', easyEnglish: 'In spite of; despite the circumstance mentioned', easyBengali: 'সত্ত্বেও বা তা সত্ত্বেও', reason: 'Advanced formal connector expressing concession', difficulty: 'hard' },
      { text: 'furthermore', type: 'word', easyEnglish: 'In addition to what has been said; additionally', easyBengali: 'অধিকন্তু বা তাছাড়া', reason: 'High-value academic additive connector', difficulty: 'medium' },
      { text: 'consequently', type: 'word', easyEnglish: 'As a result or effect', easyBengali: 'ফলস্বরূপ বা পরিণামে', reason: 'Essential causal transition word', difficulty: 'medium' },

      // 4. Academic, Domain & High-Yield Lexicon
      { text: 'pharmaceutical', type: 'word', easyEnglish: 'Related to medicinal drugs and treatments', easyBengali: 'ঔষধ বা ওষুধ শিল্প সম্পর্কিত', reason: 'Important healthcare and industry vocabulary', difficulty: 'hard' },
      { text: 'disruptions', type: 'word', easyEnglish: 'Obstacles or interruptions that stop a normal process', easyBengali: 'বিঘ্ন বা অপ্রত্যাশিত অচলাবস্থা', reason: 'High-utility academic and business vocabulary', difficulty: 'medium' },
      { text: 'mitigate', type: 'word', easyEnglish: 'Make something bad less severe or harmful', easyBengali: 'হ্রাস বা উপশম করা', reason: 'Tier-2 academic vocabulary', difficulty: 'hard' },
      { text: 'scrutiny', type: 'word', easyEnglish: 'Critical, close observation or examination', easyBengali: 'পুঙ্খানুপুঙ্খ বা চুলচেরা নিরীক্ষণ', reason: 'Key formal and journalistic vocabulary', difficulty: 'hard' },
      { text: 'resilience', type: 'word', easyEnglish: 'Capacity to recover quickly from difficulties', easyBengali: 'স্থিতিস্থাপকতা বা ঘুরে দাঁড়ানোর ক্ষমতা', reason: 'High-impact descriptive noun', difficulty: 'medium' },
      { text: 'sovereignty', type: 'word', easyEnglish: 'Supreme power or authority', easyBengali: 'সার্বভৌমত্ব বা পূর্ণ কর্তৃত্ব', reason: 'Advanced political science term', difficulty: 'hard' },
      { text: 'stewardship', type: 'word', easyEnglish: 'Responsible overseeing and protection of resources', easyBengali: 'দায়িত্বশীল তদারকি ও সুরক্ষা', reason: 'Professional governance term', difficulty: 'hard' },
      { text: 'substantiate', type: 'word', easyEnglish: 'Provide evidence to support or prove the truth of a claim', easyBengali: 'প্রমাণ বা যুক্তি দ্বারা কোনো দাবি প্রতিষ্ঠা করা', reason: 'Essential academic argument vocabulary', difficulty: 'hard' },
      { text: 'proliferation', type: 'word', easyEnglish: 'Rapid increase or spread in numbers', easyBengali: 'দ্রুত বংশবৃদ্ধি বা ব্যাপক বিস্তার', reason: 'Formal scientific and geopolitical term', difficulty: 'hard' },
      { text: 'unprecedented', type: 'word', easyEnglish: 'Never done, known, or experienced before', easyBengali: 'নজিরবিহীন বা অভূতপূর্ব', reason: 'High-utility journalistic descriptor', difficulty: 'medium' },
      { text: 'liquidity', type: 'word', easyEnglish: 'The availability of liquid assets or cash in an economy', easyBengali: 'তারল্য বা নগদ অর্থের প্রাপ্যতা', reason: 'Core economic and banking concept', difficulty: 'hard' },
      { text: 'volatility', type: 'word', easyEnglish: 'Liability to change rapidly and unpredictably', easyBengali: 'অস্থিরতা বা দ্রুত পরিবর্তনশীলতা', reason: 'Crucial financial and market vocabulary', difficulty: 'hard' },
      { text: 'hegemony', type: 'word', easyEnglish: 'Leadership or dominance, especially by one country or group', easyBengali: 'কর্তৃত্ব বা আধিপত্য', reason: 'Key international relations term', difficulty: 'hard' },
      { text: 'multilateral', type: 'word', easyEnglish: 'Agreed upon or participated in by three or more parties', easyBengali: 'বহুপাক্ষিক', reason: 'Diplomatic and political keyword', difficulty: 'hard' },
      { text: 'silhouette', type: 'word', easyEnglish: 'The overall outline, shape, or contour of an outfit', easyBengali: 'পোশাকের সামগ্রিক রূপরেখা বা অবয়ব', reason: 'Key design and fashion vocabulary', difficulty: 'hard' },
      { text: 'resonance', type: 'word', easyEnglish: 'The power to evoke enduring emotions or significance', easyBengali: 'গভীর আবেদন বা তাৎপর্য', reason: 'Literary and artistic term', difficulty: 'hard' },
      { text: 'aesthetic', type: 'word', easyEnglish: 'A set of principles underlying taste and artistic beauty', easyBengali: 'নান্দনিক বা শিল্পসম্মত দৃষ্টিভঙ্গি', reason: 'Transferable design and cultural term', difficulty: 'medium' },
      { text: 'minimalist', type: 'word', easyEnglish: 'Using only simple elements and sparing ornamentation', easyBengali: 'অনাড়ম্বর বা স্বল্প উপাদানভিত্তিক শৈলী', reason: 'Modern design and lifestyle term', difficulty: 'medium' },
      { text: 'craftsmanship', type: 'word', easyEnglish: 'Skill in an occupation or trade; artistic quality', easyBengali: 'নিখুঁত কারুকাজ বা কারিগরী দক্ষতা', reason: 'High-value cultural and trade noun', difficulty: 'medium' }
    ];

    for (const cand of knownCuratedBank) {
      const candLower = cand.text.toLowerCase();
      const isMultiword = cand.text.includes(' ');
      let matchedInText = false;
      let matchIdx = -1;

      if (isMultiword) {
        matchIdx = cleanLower.indexOf(candLower);
        matchedInText = matchIdx !== -1;
      } else {
        const regex = new RegExp(`\\b${cand.text}\\b`, 'i');
        const match = text.match(regex);
        if (match && match.index !== undefined) {
          matchIdx = match.index;
          matchedInText = true;
        }
      }

      if (matchedInText && !seenTexts.has(candLower)) {
        seenTexts.add(candLower);

        // Find exact surrounding sentence
        const matchedSentence = sentences.find((s) => s.toLowerCase().includes(candLower)) ||
          text.slice(Math.max(0, matchIdx - 40), Math.min(text.length, matchIdx + cand.text.length + 40));

        // Determine if this candidate is central to the article
        const isArticleCore = titleLower.includes(candLower) || matchIdx < 300;

        items.push({
          id: `hl_curated_${items.length + 1}`,
          text: cand.text,
          type: cand.type,
          contextSentence: matchedSentence.trim(),
          easyEnglish: cand.easyEnglish,
          easyBengali: cand.easyBengali,
          reason: cand.reason,
          difficulty: cand.difficulty,
          grammaticalNote: cand.grammaticalNote || (cand.type === 'word' ? 'Content vocabulary grounded in article context.' : 'Idiomatic multi-word expression.'),
          isArticleCore
        });
      }
    }

    const rawResult: HighlightExtractionResult = {
      items,
      pageTitle: pageTitle || 'Webpage Vocabulary',
      totalAnalyzedWords: text.split(/\s+/).filter(Boolean).length,
      sourceMode: 'curated_offline_fallback'
    };

    // Pass through HighlightIntelligenceService for ranking, grounding, and multiword hierarchy
    const processed = HighlightIntelligenceService.processCandidates(rawResult, text);
    processed.sourceMode = 'curated_offline_fallback';

    return HighlightExtractionResultSchema.parse(processed);
  }
}
