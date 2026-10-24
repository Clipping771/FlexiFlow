// Sample analysis results shared by the reading card tests.
import { StageAExplanation, PhraseAnalysisResult, SentenceAnalysisResult, StageBDetailedVocabulary, ParagraphAnalysisResult } from '../../types';

export const mockWordStageA: StageAExplanation = {
  selectedText: 'scrutiny',
  lemma: 'scrutiny',
  partOfSpeech: 'noun',
  easyEnglish: 'Very careful and thorough examination of something.',
  easyBengali: 'পুঙ্খানুপুঙ্খ পরীক্ষা বা গভীর পর্যবেক্ষণ',
  contextMeaning: 'In this sentence, the policy was analyzed strictly by officials.',
  example: 'The documents were placed under close scrutiny.',
  exampleBengali: 'নথিগুলো গভীর পর্যবেক্ষণের আওতায় আনা হয়েছিল।',
  confidence: 'high',
  contextualSenseId: 'sense_1'
};

export const mockPhraseAnalysis: PhraseAnalysisResult = {
  selectedText: 'on the other hand',
  selectionType: 'phrase',
  phraseType: 'fixed_expression',
  overallMeaning: 'Used to introduce an alternative viewpoint or contrasting fact.',
  simpleEnglishExplanation: 'Looking at another side of an argument or situation.',
  bengaliTranslation: 'অন্য দিকে বা অপর পক্ষে',
  literalVsFigurative: 'Figurative connective marker balancing opposing statements.',
  whyFitsContext: 'Provides balance to the previous claim.',
  examples: ['On the other hand, costs may increase significantly.']
};

export const mockSentenceResult: SentenceAnalysisResult = {
  selectedText: 'Although inflation increased rapidly, the central bank maintained steady interest rates.',
  selectionType: 'sentence',
  plainEnglishParaphrase: 'Even though prices went up fast, the main bank did not change interest rates.',
  overallMeaning: 'The central bank decided to hold interest rates despite high inflation.',
  bengaliTranslation: 'মুদ্রাস্ফীতি দ্রুত বৃদ্ধি পাওয়া সত্ত্বেও কেন্দ্রীয় ব্যাংক সুদের হার অপরিবর্তিত রেখেছে।',
  phraseBreakdown: [
    {
      phrase: 'Although inflation increased rapidly',
      easyEnglish: 'Even though prices rose very quickly',
      easyBengali: 'যদিও দ্রব্যমূল্য দ্রুত বৃদ্ধি পেয়েছিল'
    },
    {
      phrase: 'the central bank maintained steady interest rates',
      easyEnglish: 'the main bank kept the loan rates unchanged',
      easyBengali: 'মূল ব্যাংক সুদের হার স্থির রেখেছিল'
    }
  ],
  clauses: [
    {
      text: 'Although inflation increased rapidly',
      type: 'subordinate',
      role: 'Concessive Clause',
      explanationBengali: 'শর্তমূলক বা বিপরীতমুখী খণ্ডবাক্য'
    },
    {
      text: 'the central bank maintained steady interest rates',
      type: 'main',
      role: 'Independent Proposition',
      explanationBengali: 'প্রধান খণ্ডবাক্য যা মূল সিদ্ধান্ত নির্দেশ করে'
    }
  ],
  grammaticalHighlights: [
    'Subordinate concessive clause introduced by "Although"',
    'Past simple active voice ("increased", "maintained")'
  ],
  difficultVocabulary: [
    {
      word: 'inflation',
      meaningInContext: 'A general increase in prices and fall in the purchasing value of money',
      bengali: 'মুদ্রাস্ফীতি'
    },
    {
      word: 'steady',
      meaningInContext: 'Firmly fixed, constant, or not changing',
      bengali: 'স্থির বা অপরিবর্তিত'
    }
  ],
  toneAndRegister: 'Formal / Economic Journalistic'
};

export const mockStageB: StageBDetailedVocabulary = {
  lemma: 'scrutiny',
  partOfSpeech: 'noun',
  contextualSenseId: 'sense_1',
  senses: [
    {
      id: 'sense_1',
      partOfSpeech: 'noun',
      easyEnglish: 'Critical observation or examination.',
      easyBengali: 'গভীর নজরদারি বা পুঙ্খানুপুঙ্খ অনুসন্ধান',
      isContextual: true,
      examples: [{ english: 'The company faced public scrutiny.', bengali: 'কোম্পানিটি জনসমক্ষে তীব্র পর্যালোচনার মুখোমুখি হয়েছিল।' }],
      synonyms: [{ word: 'inspection', easyEnglish: 'close look', easyBengali: 'পরিদর্শন' }],
      antonyms: []
    }
  ],
  collocations: [{ english: 'close scrutiny', bengali: 'গভীর পর্যবেক্ষণ' }],
  idiomsAndPhrases: []
};

export const mockParagraph: ParagraphAnalysisResult = {
  selectedText: 'Artificial intelligence is transforming education worldwide. Teachers use modern tools to personalize lessons, while students receive instant feedback on their work.',
  selectionType: 'paragraph',
  mainIdea: 'AI is fundamentally altering how modern education and learning operate.',
  conciseSummary: 'AI helps teachers personalize content and enables students to receive immediate feedback.',
  bengaliTranslation: 'কৃত্রিম বুদ্ধিমত্তা বিশ্বজুড়ে শিক্ষাব্যবস্থাকে বদলে দিচ্ছে। শিক্ষকরা পাঠ ব্যক্তিগতকরণে আধুনিক প্রযুক্তি ব্যবহার করেন এবং শিক্ষার্থীরা দ্রুত প্রতিক্রিয়া পায়।',
  phraseBreakdown: [
    {
      phrase: 'Artificial intelligence is transforming education worldwide',
      easyEnglish: 'AI is changing schools and learning everywhere.',
      easyBengali: 'কৃত্রিম বুদ্ধিমত্তা বিশ্বব্যাপী শিক্ষা ব্যবস্থাকে পরিবর্তন করছে।'
    },
    {
      phrase: 'Teachers use modern tools to personalize lessons',
      easyEnglish: 'Instructors utilize new software to customize teaching for each student.',
      easyBengali: 'শিক্ষকরা প্রতিটি শিক্ষার্থীর জন্য পাঠ উপযোগী করতে আধুনিক সরঞ্জাম ব্যবহার করেন।'
    },
    {
      phrase: 'while students receive instant feedback on their work',
      easyEnglish: 'and learners get immediate answers about their performance.',
      easyBengali: 'পাশাপাশি শিক্ষার্থীরা তাদের কাজের তাৎক্ষণিক মূল্যায়ন বা প্রতিক্রিয়া পায়।'
    }
  ],
  keyVocabulary: [
    { term: 'transforming', meaning: 'making a marked change in form, nature, or appearance', bengali: 'আমূল পরিবর্তন করা' }
  ],
  argumentStructure: 'Premise followed by dual examples of pedagogical impact.',
  toneAndRegister: 'Informative / Academic'
};
