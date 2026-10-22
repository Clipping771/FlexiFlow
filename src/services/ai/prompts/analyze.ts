// Prompt text was moved here verbatim from the provider classes (M1 of CLOUD_BACKEND_DESIGN.md).
import { SelectionType } from '../../../types';
import { getLanguageConfig } from '../../../config/languages';
import { PromptDetail, PromptSpec } from './types';

export interface AnalyzeInput {
  text: string;
  type: SelectionType;
  contextSentence?: string;
  paragraphContext?: string;
}

export function buildAnalyzePrompt(input: AnalyzeInput, targetLang: string, detail: PromptDetail): PromptSpec {
  return detail === 'full' ? buildFull(input, targetLang) : buildCompact(input, targetLang);
}

function buildFull({ text, type, contextSentence }: AnalyzeInput, targetLang: string): PromptSpec {
  const lang = getLanguageConfig(targetLang);

  if (type === 'word') {
    const system = `You are an elite bilingual lexicographer and contextual language expert.
Analyze the word "${text}" in the context of this sentence: "${contextSentence || ''}".
Return JSON adhering to WordAnalysisSchema:
{
  "selectedText": "${text}",
  "selectionType": "word",
  "contextualMeaning": "Precise meaning in this context",
  "simpleEnglishExplanation": "Plain English explanation",
  "bengaliTranslation": "${lang.targetLabel} meaning and explanation (${lang.promptTargetInstruction})",
  "whyFitsContext": "Why this specific meaning fits this sentence",
  "partOfSpeech": "Part of speech",
  "grammaticalNote": "Grammar / syntactic role",
  "collocations": ["collocation 1", "collocation 2"],
  "examples": ["example 1", "example 2"],
  "exampleBengali": "Natural ${lang.targetLabel} translation of example 1",
  "synonyms": ["synonym 1"],
  "antonyms": ["antonym 1"],
  "registerAndTone": "Tone description"
}`;
    return { system, user: `Target: ${text}\nSentence: ${contextSentence || ''}`, maxTokens: 650 };
  }
  if (type === 'phrase') {
    const system = `Analyze the phrase or idiom "${text}" in context: "${contextSentence || ''}".
Return JSON adhering to PhraseAnalysisSchema:
{
  "selectedText": "${text}",
  "selectionType": "phrase",
  "phraseType": "phrasal_verb" | "idiom" | "collocation" | "fixed_expression",
  "overallMeaning": "Meaning as a unified unit",
  "simpleEnglishExplanation": "Simple English explanation",
  "bengaliTranslation": "${lang.targetLabel} translation and explanation (${lang.promptTargetInstruction})",
  "literalVsFigurative": "Literal vs figurative distinction",
  "whyFitsContext": "Why it fits this context",
  "componentsBreakdown": "Breakdown of individual components",
  "examples": ["example 1"]
}`;
    return { system, user: `Phrase: ${text}\nContext: ${contextSentence || ''}`, maxTokens: 650 };
  }
  if (type === 'sentence') {
    const system = `You are a master English linguistics and pedagogy professor. Deconstruct this English sentence into a student-friendly 9-layer learning breakdown.
Strict educational instructions:
1. Explain WHAT it means in very simple, beginner-friendly everyday English (Layer 1).
2. Explain in natural, clear ${lang.targetLabel} (${lang.promptTargetInstruction}). All translation and explanation fields ("bengaliTranslation", "easyBengali", "explanationBengali") must be strictly written in ${lang.targetLabel} (${lang.targetNativeLabel}). Never output Bengali when target language is NOT Bengali. When target language is Bengali, write strictly in Bengali script.
3. Contiguous Sentence Partitioning (Layer 2): You MUST partition the ENTIRE sentence from the first word to the last word into sequential, contiguous chunks in chronological order without omitting any words (100% sentence coverage).
4. Clause Breakdown & Complexity: Classify sentence correctly as simple, compound, complex, or compound-complex using genuine coordination and subordination. NEVER determine complexity by clause count or comma splitting alone. Identify main/independent, subordinate/adverbial, relative, and noun clauses.
5. Detailed Syntactic Constituents: For each clause, identify Subject, Verb/Verb Phrase, Direct and Indirect Objects, Complements, and Adverbials with clear, accessible English and ${lang.targetLabel} explanations.
6. Conversational Language & Speech Repairs: Recognize conversational self-corrections (e.g. "sorry product"), interruptions, parentheticals, and discourse markers (e.g. "arguably"). NEVER classify conversational repairs as separate clauses or count them toward clause count! Explain that the speaker corrects the term in real-time.
7. Strict Grounding: Syntactic analysis must derive SOLELY from the words in the original sentence. Never introduce external entities, places, or products (e.g. SpaceX, Texas, Roadster) unless explicitly present in the analyzed sentence text.
8. Internal Phrase Structure: Provide internal breakdown for complex noun phrases (head noun, determiners, superlative adjectives, adverbs of stance).
9. Detail Important Grammar Rules, Connectors, Word-Level Grammar, Common Misconceptions, and Practice.

Return raw JSON adhering to SentenceAnalysisSchema:
{
  "selectedText": "${text}",
  "selectionType": "sentence",
  "plainEnglishParaphrase": "Very easy plain English paraphrase in short everyday words",
  "overallMeaning": "Core message",
  "mainMessage": "What the author is fundamentally saying in 1-2 simple sentences",
  "sentenceStructure": {
    "type": "simple" | "compound" | "complex" | "compound-complex",
    "explanation": "Why it is classified this way in simple English",
    "explanationBengali": "Natural explanation in ${lang.targetLabel} (${lang.targetNativeLabel})"
  },
  "bengaliTranslation": "Complete natural ${lang.targetLabel} translation (${lang.promptTargetInstruction})",
  "phraseBreakdown": [
    {
      "phrase": "Contiguous sequential chunk of the sentence",
      "easyEnglish": "Very simple everyday English explanation.",
      "easyBengali": "Natural ${lang.targetLabel} explanation",
      "grammaticalFunction": "Role performed by this chunk",
      "connection": "How it connects to other parts",
      "whyItMatters": "What information it contributes",
      "simplerExample": "A short simpler example using same structure"
    }
  ],
  "clauses": [
    {
      "text": "Exact clause text",
      "type": "main" | "subordinate" | "relative" | "noun",
      "typeExplanation": "Simple explanation of this clause type",
      "subject": "Subject text",
      "subjectExplanation": "Subject explanation in English",
      "subjectExplanationBengali": "Subject explanation in ${lang.targetLabel}",
      "verb": "Main finite verb",
      "verbPhrase": "Full verb phrase",
      "verbExplanation": "Verb explanation in English",
      "verbExplanationBengali": "Verb explanation in ${lang.targetLabel}",
      "directObject": "Direct object if present",
      "directObjectExplanation": "Direct object explanation in English",
      "directObjectExplanationBengali": "Direct object explanation in ${lang.targetLabel}",
      "indirectObject": "Indirect object if present",
      "complement": "Complement if present",
      "clausePattern": "e.g. S + V + DO",
      "role": "Syntactic role",
      "questionAnswered": "What question does it answer?",
      "dependsOn": "Which clause it depends on",
      "standalone": "Yes / No with reason",
      "example": "Short example demonstrating same pattern",
      "explanationBengali": "Clause explanation in ${lang.targetLabel}"
    }
  ],
  "phraseConstituents": [
    {
      "phrase": "e.g. arguably his greatest invention",
      "phraseType": "noun_phrase",
      "phraseTypeLabel": "Complex Noun Phrase",
      "headWord": "invention",
      "roleInClause": "Direct Object",
      "components": [
        { "text": "arguably", "role": "adverb", "roleLabel": "Modal Adverb", "roleBengali": "Role in ${lang.targetLabel}", "explanation": "Qualifies assertion" }
      ],
      "explanation": "Phrase explanation",
      "explanationBengali": "Natural explanation in ${lang.targetLabel}"
    }
  ],
  "conversationalElements": [
    {
      "text": "sorry product",
      "type": "self_correction",
      "typeLabel": "Conversational Self-Correction",
      "targetOriginal": "invention",
      "correctedTo": "product",
      "explanation": "The speaker initially uses 'invention' and immediately self-corrects to 'product'.",
      "explanationBengali": "Correction explanation in ${lang.targetLabel}"
    }
  ],
  "patternSummary": {
    "formula": "Subject + Transitive Verb + Object NP + Conversational Repair",
    "explanation": "Formula explanation in English",
    "explanationBengali": "Pattern explanation in ${lang.targetLabel}"
  },
  "structureMap": {
    "mainClause": "The main independent clause",
    "nodes": [
      {
        "clauseOrElement": "Clause text",
        "relationType": "main" | "contrast" | "condition" | "reason" | "description",
        "connectsTo": "Root or Main clause",
        "explanation": "Simple explanation of relationship",
        "bengaliExplanation": "Relationship explanation in ${lang.targetLabel}"
      }
    ]
  },
  "grammarRules": [
    {
      "ruleName": "Rule name (e.g. Preposition of Contrast: Despite + Noun Phrase)",
      "whatIsIt": "Simple definition",
      "whereIsIt": "Exact words in sentence",
      "whyUsed": "Purpose in this specific sentence",
      "howItWorks": "Beginner-friendly mechanism",
      "reusablePattern": "Reusable formula/pattern",
      "example": { "english": "Example", "easyEnglish": "Simple meaning", "bengali": "${lang.targetLabel} meaning" },
      "commonConfusion": "Common student misunderstanding or contrast"
    }
  ],
  "connectors": [
    {
      "connector": "Connector word",
      "meaning": "Meaning",
      "grammaticalPattern": "Pattern e.g. Despite + Noun vs Although + Clause",
      "logicalRelationship": "Relationship type",
      "whyAppropriate": "Why used here",
      "contrastWithSimilar": "Contrast with similar words"
    }
  ],
  "wordLevelGrammar": [
    {
      "word": "Key word",
      "partOfSpeech": "Part of speech in context",
      "syntacticRole": "Syntactic role in this sentence",
      "wordForms": ["form1", "form2"],
      "usageNotes": "Transitive/intransitive notes or dependent prepositions"
    }
  ],
  "commonMistakesAndAlternatives": {
    "commonMistake": "Typical learner error",
    "correctedExample": "Corrected example",
    "naturalAlternative": "Natural alternative construction",
    "nuanceDifference": "How the alternative shifts tone or emphasis"
  },
  "practice": {
    "reusablePattern": "Transferable pattern",
    "practiceQuestion": "Interactive question for student",
    "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
    "answer": "Correct answer",
    "explanation": "Why it is correct"
  },
  "grammaticalHighlights": ["Feature 1", "Feature 2"],
  "difficultVocabulary": [{"word": "word", "meaningInContext": "meaning", "bengali": "${lang.targetNativeHeader}"}],
  "toneAndRegister": "Formal / Academic / Conversational"
}`;
    return { system, user: `Sentence: ${text}`, maxTokens: 3500 };
  }
  const system = `Analyze this text for a learner using smart hierarchical segmentation:
1. Divide text into paragraphs.
2. For each paragraph, extract each sentence.
3. For each sentence, provide the complete natural ${lang.targetLabel} translation and sequential phrase-by-phrase breakdown with plain English and ${lang.targetLabel} explanations.
All translation and explanation fields ("bengaliTranslation", "easyBengali") must be strictly written in ${lang.targetLabel} (${lang.targetNativeLabel}).

Return JSON adhering to ParagraphAnalysisSchema:
{
  "selectedText": "${text}",
  "selectionType": "paragraph",
  "mainIdea": "Main thesis of the entire text",
  "conciseSummary": "Concise summary",
  "bengaliTranslation": "Complete natural ${lang.targetLabel} translation of text (${lang.promptTargetInstruction})",
  "paragraphs": [
    {
      "paragraphIndex": 1,
      "paragraphText": "Exact text of paragraph 1",
      "mainIdea": "Main idea of this paragraph",
      "bengaliTranslation": "Natural ${lang.targetLabel} translation of this paragraph",
      "sentences": [
        {
          "sentenceIndex": 1,
          "sentenceText": "Exact sentence text",
          "bengaliTranslation": "Natural ${lang.targetLabel} translation of this sentence",
          "phraseBreakdown": [
            {
              "phrase": "Exact sequential chunk from this sentence",
              "easyEnglish": "Very simple everyday English explanation.",
              "easyBengali": "Natural easy ${lang.targetLabel} explanation (${lang.promptTargetInstruction})"
            }
          ]
        }
      ]
    }
  ],
  "phraseBreakdown": [
    {
      "phrase": "Exact meaningful phrase from text",
      "easyEnglish": "Very simple everyday English explanation.",
      "easyBengali": "Natural easy ${lang.targetLabel} explanation"
    }
  ],
  "sentenceBreakdown": ["Sentence 1 summary", "Sentence 2 summary"],
  "keyVocabulary": [{"term": "term", "meaning": "meaning", "bengali": "${lang.targetNativeHeader}"}],
  "argumentStructure": "Flow description",
  "toneAndRegister": "Tone"
}`;
  return { system, user: `Paragraph:\n${text}`, maxTokens: 3500 };
}

function buildCompact({ text, type, contextSentence, paragraphContext }: AnalyzeInput, targetLang: string): PromptSpec {
  const lang = getLanguageConfig(targetLang);
  let system: string;

  if (type === 'word') {
    system = `You are an expert bilingual lexicographer for an ESL ${lang.targetLabel} learner.
In "bengaliTranslation", provide ${lang.promptTargetInstruction}.
Return a valid raw JSON object strictly adhering to this schema:
{
  "selectedText": "${text}",
  "selectionType": "word",
  "contextualMeaning": "Precise meaning in this context",
  "simpleEnglishExplanation": "Plain English explanation",
  "bengaliTranslation": "${lang.targetLabel} meaning and explanation",
  "whyFitsContext": "Why this specific meaning fits this sentence",
  "partOfSpeech": "noun / verb / adjective / adverb",
  "grammaticalNote": "Grammar or syntactic role",
  "collocations": ["collocation 1", "collocation 2"],
  "examples": ["example sentence 1"],
  "exampleBengali": "Natural ${lang.targetLabel} translation of example sentence 1",
  "synonyms": ["synonym 1"],
  "antonyms": ["antonym 1"],
  "registerAndTone": "Tone description"
}`;
  } else if (type === 'phrase') {
    system = `You are an expert bilingual tutor for an ESL ${lang.targetLabel} learner.
In "bengaliTranslation", provide ${lang.promptTargetInstruction}.
Return a valid raw JSON object strictly adhering to this schema:
{
  "selectedText": "${text}",
  "selectionType": "phrase",
  "phraseType": "idiom",
  "overallMeaning": "Meaning as a unified unit",
  "simpleEnglishExplanation": "Simple English explanation",
  "bengaliTranslation": "${lang.targetLabel} translation and explanation",
  "literalVsFigurative": "Literal vs figurative distinction",
  "whyFitsContext": "Why it fits this context",
  "examples": ["example sentence 1"]
}`;
  } else if (type === 'sentence') {
    system = `Analyze this sentence for an ESL ${lang.targetLabel} learner.
In "bengaliTranslation" and "easyBengali", provide ${lang.promptTargetInstruction}.
Important: All translation fields ("bengaliTranslation", "easyBengali", "explanationBengali") must be strictly written in ${lang.targetLabel} (${lang.targetNativeLabel}). Never output Bengali if the target language is NOT Bengali. If target language is Bengali, write strictly in Bengali script.
Important: In "phraseBreakdown", you MUST partition the ENTIRE sentence from the first word to the last word into sequential, contiguous chunks without skipping any words (100% sentence coverage).
Important Grammatical Instructions:
1. Classify sentence complexity (simple, compound, complex, compound-complex) using true coordination and subordination, NOT clause count alone.
2. For each clause, extract Subject, Verb, Direct Object, and Clause Pattern.
3. Recognize conversational self-corrections (e.g. "sorry product") and discourse markers. NEVER classify conversational repairs as separate clauses!
4. Strictly ground syntactic tree in the original sentence without introducing external details (e.g. no external names or locations not in sentence).
Return a valid raw JSON object strictly adhering to this schema:
{
  "selectedText": "${text}",
  "selectionType": "sentence",
  "plainEnglishParaphrase": "Very easy plain English paraphrase",
  "overallMeaning": "Overall meaning",
  "sentenceStructure": {
    "type": "simple" | "compound" | "complex" | "compound-complex",
    "explanation": "Structure explanation in English",
    "explanationBengali": "Structure explanation in ${lang.targetLabel}"
  },
  "bengaliTranslation": "Complete natural ${lang.targetLabel} translation",
  "phraseBreakdown": [
    {
      "phrase": "Sequential contiguous chunk of sentence (in chronological order, covering 100% of the sentence without skipping words)",
      "easyEnglish": "Very simple everyday English explanation.",
      "easyBengali": "Natural easy ${lang.targetLabel} explanation"
    }
  ],
  "clauses": [
    {
      "text": "Clause text",
      "type": "main" | "subordinate" | "relative" | "noun",
      "role": "Main Clause",
      "subject": "Subject",
      "verb": "Verb",
      "directObject": "Direct object if present",
      "clausePattern": "e.g. S + V + DO",
      "explanationBengali": "Clause explanation in ${lang.targetLabel}"
    }
  ],
  "conversationalElements": [
    {
      "text": "e.g. sorry product",
      "type": "self_correction",
      "typeLabel": "Conversational Repair",
      "targetOriginal": "invention",
      "correctedTo": "product",
      "explanation": "Self-correction in English",
      "explanationBengali": "Correction explanation in ${lang.targetLabel}"
    }
  ],
  "grammaticalHighlights": ["Key grammar point"],
  "difficultVocabulary": [{"word": "word", "meaningInContext": "meaning", "bengali": "translation", "grammaticalRole": "role"}],
  "toneAndRegister": "Standard English"
}`;
  } else {
    system = `Analyze this text for a learner using smart hierarchical segmentation:
1. Divide text into paragraphs.
2. For each paragraph, extract each sentence.
3. For each sentence, provide the complete natural ${lang.targetLabel} translation and sequential phrase-by-phrase breakdown with plain English and ${lang.targetLabel} explanations.
All translation and explanation fields ("bengaliTranslation", "easyBengali") must be strictly written in ${lang.targetLabel} (${lang.targetNativeLabel}).

Return a valid raw JSON object strictly adhering to this schema:
{
  "selectedText": "${text}",
  "selectionType": "paragraph",
  "mainIdea": "Main thesis of the entire text",
  "conciseSummary": "Concise summary",
  "bengaliTranslation": "Complete natural ${lang.targetLabel} translation of text (${lang.promptTargetInstruction})",
  "paragraphs": [
    {
      "paragraphIndex": 1,
      "paragraphText": "Exact text of paragraph 1",
      "mainIdea": "Main idea of this paragraph",
      "bengaliTranslation": "Natural ${lang.targetLabel} translation of this paragraph",
      "sentences": [
        {
          "sentenceIndex": 1,
          "sentenceText": "Exact sentence text",
          "bengaliTranslation": "Natural ${lang.targetLabel} translation of this sentence",
          "phraseBreakdown": [
            {
              "phrase": "Exact sequential chunk from this sentence",
              "easyEnglish": "Very simple everyday English explanation.",
              "easyBengali": "Natural easy ${lang.targetLabel} explanation (${lang.promptTargetInstruction})"
            }
          ]
        }
      ]
    }
  ],
  "phraseBreakdown": [
    {
      "phrase": "Exact meaningful phrase from text",
      "easyEnglish": "Simple English explanation",
      "easyBengali": "Natural easy ${lang.targetLabel} explanation"
    }
  ],
  "sentenceBreakdown": ["Sentence 1 summary", "Sentence 2 summary"],
  "keyVocabulary": [{"term": "term", "meaning": "meaning", "bengali": "translation"}],
  "toneAndRegister": "Standard English"
}`;
  }

  const user = `Text: ${text}\nType: ${type}\nSentence: ${contextSentence || ''}\nParagraph: ${paragraphContext || ''}`;
  const maxTokens = type === 'word' || type === 'phrase' ? 650 : 3500;
  return { system, user, maxTokens };
}
