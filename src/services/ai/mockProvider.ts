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
  StageAExplanation,
  StageBDetailedVocabulary,
  StageBSense
} from '../../types';
import { BengaliService } from '../bengali';
import {
  WordAnalysisSchema,
  PhraseAnalysisSchema,
  SentenceAnalysisSchema,
  ParagraphAnalysisSchema,
  WritingAssistSchema,
  FollowUpResponseSchema
} from './schemas';
import { getLanguageConfig } from '../../config/languages';
import { AIProvider } from './types';

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

    const exEnglish = contextSentence || `She understood the meaning of ${clean} immediately.`;
    const exBengali = `সে বাক্যটিতে এর ভাবার্থ সহজে বুঝতে পেরেছিল।`;

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
      grammaticalNote: `Functions as a modifier within the sentence.`,
      collocations: [`strictly ${word}`, `quite ${word}`],
      examples: contextSentence
        ? [`"${contextSentence.slice(0, 100)}..."`]
        : [`Technically, the requirements were fulfilled correctly.`],
      synonyms: [],
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
      componentsBreakdown: `Combines words to form an established idiomatic meaning.`,
      examples: [
        `The committee decided to follow through with the recommendations.`,
        `Experts emphasized that taking immediate steps prevents further complications.`
      ]
    };

    return PhraseAnalysisSchema.parse(raw);
  }

  private decomposeIntoPhraseBreakdown(text: string): Array<{ phrase: string; easyEnglish: string; easyBengali: string }> {
    const clean = text.trim();
    if (!clean) return [];

    // Split text into meaningful phrases based on punctuation and clause boundaries
    const rawParts = clean.split(/(?:,\s*|;\s*|:\s*|\.\s+|\n+|—|–)/).map((p) => p.trim()).filter(Boolean);
    const phrases: Array<{ phrase: string; easyEnglish: string; easyBengali: string }> = [];

    for (const part of rawParts) {
      if (!part) continue;
      const words = part.split(/\s+/).filter(Boolean);

      // If a segment is long (> 10 words), break into smaller natural phrase chunks
      if (words.length > 10) {
        const mid = Math.ceil(words.length / 2);
        const chunk1 = words.slice(0, mid).join(' ');
        const chunk2 = words.slice(mid).join(' ');
        if (chunk1) {
          phrases.push({
            phrase: chunk1,
            easyEnglish: `What "${chunk1}" means simply: ${this.explainChunkEnglish(chunk1)}.`,
            easyBengali: this.explainChunkBengali(chunk1)
          });
        }
        if (chunk2) {
          phrases.push({
            phrase: chunk2,
            easyEnglish: `What "${chunk2}" means simply: ${this.explainChunkEnglish(chunk2)}.`,
            easyBengali: this.explainChunkBengali(chunk2)
          });
        }
      } else {
        phrases.push({
          phrase: part,
          easyEnglish: `What "${part}" means simply: ${this.explainChunkEnglish(part)}.`,
          easyBengali: this.explainChunkBengali(part)
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

  private explainChunkBengali(chunk: string): string {
    const lower = chunk.toLowerCase();
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
    const phraseBreakdown = this.decomposeIntoPhraseBreakdown(sentence);

    const raw: SentenceAnalysisResult = {
      selectedText: sentence,
      selectionType: 'sentence',
      plainEnglishParaphrase: `This statement emphasizes that despite potential challenges or uncertainties, an essential principle or course of action is preserved.`,
      overallMeaning: `The sentence balances contextual conditions against a primary assertive claim.`,
      bengaliTranslation: `বাক্যটির মূল অর্থ: বিদ্যমান ঝুঁকি বা প্রতিকূল পরিস্থিতি সত্ত্বেও মূল লক্ষ্য এবং কার্যকারিতা সফলভাবে বজায় রাখা হয়েছে।`,
      phraseBreakdown,
      clauses: [
        {
          text: sentence.length > 60 ? sentence.slice(0, 50) + '...' : sentence,
          type: 'main',
          role: 'Main Proposition (Independent Clause)',
          explanationBengali: 'বাক্যের কেন্দ্রীয় মূল খণ্ডবাক্য যা মূল বক্তব্য প্রতিষ্ঠা করে।'
        }
      ],
      grammaticalHighlights: [
        'Complex sentence with dependent condition markers',
        'Formal journalistic / academic tone'
      ],
      difficultVocabulary: [
        {
          word: sentence.split(/\s+/)[3] || 'scrutiny',
          meaningInContext: 'Careful examination or inspection',
          bengali: 'পুঙ্খানুপুঙ্খ নজরদারি'
        }
      ],
      toneAndRegister: 'Formal / Academic English'
    };

    return SentenceAnalysisSchema.parse(raw);
  }

  private analyzeParagraph(paragraph: string): ParagraphAnalysisResult {
    const phraseBreakdown = this.decomposeIntoPhraseBreakdown(paragraph);

    const raw: ParagraphAnalysisResult = {
      selectedText: paragraph,
      selectionType: 'paragraph',
      mainIdea: `The passage evaluates strategic systemic governance, balancing technological advancement with regulatory risk mitigation.`,
      conciseSummary: `The text underscores how modern institutions navigate emerging disruptions through proactive compliance and data stewardship.`,
      bengaliTranslation: `অনুচ্ছেদটির সারসংক্ষেপ: উদীয়মান প্রযুক্তি ও অর্থনৈতিক প্রেক্ষাপটে অপ্রত্যাশিত ঝুঁকি মোকাবিলার জন্য নিয়ন্ত্রক সংস্থা ও বহুজাতিক প্রতিষ্ঠানগুলোর ঐক্যবদ্ধ পদক্ষেপের গুরুত্ব তুলে ধরা হয়েছে।`,
      phraseBreakdown,
      sentenceBreakdown: [
        `Sentences 1-2: Contextualize regulatory challenges and scrutiny.`,
        `Sentences 3-4: Propose institutional safeguards and long-term compliance.`
      ],
      keyVocabulary: [
        { term: 'scrutiny', meaning: 'Rigorous examination', bengali: 'তীক্ষ্ণ নজরদারি' },
        { term: 'mitigate', meaning: 'Lessen severity', bengali: 'উপশম করা' },
        { term: 'sovereignty', meaning: 'Autonomous jurisdiction', bengali: 'সার্বভৌমত্ব' }
      ],
      argumentStructure: 'Problem Formulation → Proposed Solution → Strategic Implication',
      toneAndRegister: 'Analytical / Policy Journalism'
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
}
