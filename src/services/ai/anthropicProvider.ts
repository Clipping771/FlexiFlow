import {
  SelectionType,
  LinguisticAnalysisResult,
  WritingGoal,
  WritingAssistResult,
  FollowUpResponse,
  StageAExplanation,
  StageBDetailedVocabulary
} from '../../types';
import { getLanguageConfig } from '../../config/languages';
import {
  WordAnalysisSchema,
  PhraseAnalysisSchema,
  SentenceAnalysisSchema,
  ParagraphAnalysisSchema,
  WritingAssistSchema,
  FollowUpResponseSchema
} from './schemas';
import { AIProvider } from './types';
import { safeParseJSON } from './safeJson';
import { validateStageA, validateStageB } from './validation';

export class AnthropicProvider implements AIProvider {
  name = 'anthropic';
  private apiKey: string;
  private model: string;
  private targetLang: string;

  constructor(
    apiKey: string = '',
    model: string = 'claude-3-5-sonnet-20241022',
    targetLang: string = 'bn'
  ) {
    this.apiKey = apiKey;
    this.model = model;
    this.targetLang = targetLang || 'bn';
  }

  isAvailable(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  private async callAnthropic(systemPrompt: string, userPrompt: string, timeoutMs: number = 12000): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error('Anthropic API key is not configured.');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort(new Error(`Anthropic request timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    let res: Response;
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 1800,
          system: `${systemPrompt}\nOutput strictly valid raw JSON only. Do not add markdown backticks.`,
          messages: [{ role: 'user', content: userPrompt }]
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Anthropic API error (${res.status}): ${err}`);
    }

    const data = await res.json();
    const content = data.content?.[0]?.text;
    if (!content) throw new Error('Empty response from Anthropic API.');

    return content.replace(/```json/g, '').replace(/```/g, '').trim();
  }

  async analyzeStageA(
    text: string,
    contextSentence?: string,
    paragraphContext?: string
  ): Promise<StageAExplanation> {
    const cleanText = text.trim();
    const lang = getLanguageConfig(this.targetLang);
    const systemPrompt = `You are an ${lang.promptTutorRole}.
Your mission is to explain the selected word or phrase for someone reading a real webpage.
Strict guidelines:
1. "easyEnglish": Genuinely simple everyday English. Short sentence, conversational words, explain one idea at a time. No academic jargon.
2. "easyBengali": ${lang.promptTargetInstruction}
3. "contextMeaning": Explain what it specifically means in this sentence.
4. "example": One natural, short example sentence illustrating this sense.
5. "exampleBengali": Natural ${lang.targetLabel} translation of the example sentence.
6. "confidence": "high", "medium", or "low". If sentence provides minimal clues, set to "low" and give an honest "uncertaintyReason".
7. "contextualSenseId": "sense_1".

Return JSON adhering to StageAContextualSchema:
{
  "selectedText": "${cleanText}",
  "lemma": "base form",
  "partOfSpeech": "word / noun / verb / etc.",
  "easyEnglish": "Very simple everyday English explanation.",
  "easyBengali": "${lang.targetNativeHeader}",
  "contextMeaning": "Meaning in this sentence.",
  "example": "Natural English sentence.",
  "exampleBengali": "Example sentence translated into ${lang.targetLabel}.",
  "confidence": "high" | "medium" | "low",
  "uncertaintyReason": "Optional note if confidence is low",
  "contextualSenseId": "sense_1"
}`;

    const userPrompt = `Target: "${cleanText}"\nSentence Context: "${contextSentence || ''}"\nParagraph Context: "${(paragraphContext || '').slice(0, 300)}"`;

    let raw = await this.callAnthropic(systemPrompt, userPrompt);
    let parsed: any;
    try {
      parsed = safeParseJSON(raw);
    } catch {
      raw = await this.callAnthropic(systemPrompt, `${userPrompt}\n\nCRITICAL: Output ONLY valid JSON.`);
      parsed = safeParseJSON(raw);
    }

    let validation = validateStageA(parsed, this.targetLang);
    if (!validation.isValid) {
      console.warn('[LexiFlow Anthropic] Stage A validation failed, retrying once...', validation.errors);
      const correctionPrompt = `${userPrompt}\n\nYour previous response had validation errors:\n${validation.errors.join('\n')}\nPlease correct these errors and ensure "${lang.targetLabel}" explanation and all required fields are present.`;
      const retryRaw = await this.callAnthropic(systemPrompt, correctionPrompt);
      try {
        const retryParsed = safeParseJSON(retryRaw);
        const retryVal = validateStageA(retryParsed, this.targetLang);
        if (retryVal.isValid && retryVal.data) {
          if (cleanText && (!retryVal.data.selectedText || retryVal.data.selectedText.trim() !== cleanText)) {
            retryVal.data.selectedText = cleanText;
          }
          return retryVal.data;
        }
      } catch (err) {
        console.warn('[LexiFlow Anthropic] Stage A retry parse error:', err);
      }
    }

    if (validation.isValid && validation.data) {
      if (cleanText && (!validation.data.selectedText || validation.data.selectedText.trim() !== cleanText)) {
        validation.data.selectedText = cleanText;
      }
      return validation.data;
    }

    return {
      selectedText: cleanText,
      lemma: parsed?.lemma || cleanText.toLowerCase(),
      partOfSpeech: parsed?.partOfSpeech || 'word',
      easyEnglish: parsed?.easyEnglish || 'Used in this sentence to convey a specific idea.',
      easyBengali: parsed?.easyBengali || 'প্রাসঙ্গিক অর্থ',
      contextMeaning: parsed?.contextMeaning || 'Meaning in this context.',
      example: parsed?.example || contextSentence,
      exampleBengali: parsed?.exampleBengali || undefined,
      confidence: 'medium',
      contextualSenseId: 'sense_1'
    };
  }

  async analyzeStageB(
    lemma: string,
    partOfSpeech: string = 'word',
    contextualSenseId: string = 'sense_1'
  ): Promise<StageBDetailedVocabulary> {
    const cleanLemma = lemma.trim().toLowerCase();
    const lang = getLanguageConfig(this.targetLang);
    const systemPrompt = `You are an elite bilingual lexicographer. Provide a comprehensive, structured vocabulary entry for "${cleanLemma}".
Strict guidelines:
1. ORDER SENSES SO THE CONTEXTUAL SENSE IS FIRST in the "senses" array with id "${contextualSenseId}".
2. Provide easy English and natural ${lang.targetLabel} (${lang.promptTargetInstruction}) for every sense.
3. For each sense provide 1-2 natural examples with natural ${lang.targetLabel} translations.
4. Synonyms must be sense-specific.
5. Antonyms: ONLY GENUINE DIRECT OPPOSITES. NEVER invent an antonym if none exists; leave as empty array [].
6. Collocations, idioms / phrasal verbs, word forms, and confusing words if applicable.

Return JSON adhering to StageBDetailedVocabularySchema:
{
  "lemma": "${cleanLemma}",
  "partOfSpeech": "${partOfSpeech}",
  "contextualSenseId": "${contextualSenseId}",
  "senses": [
    {
      "id": "${contextualSenseId}",
      "partOfSpeech": "${partOfSpeech}",
      "easyEnglish": "Simple everyday English definition.",
      "easyBengali": "${lang.targetNativeHeader}",
      "isContextual": true,
      "registerOrType": "standard",
      "examples": [{"english": "Natural example.", "bengali": "Example translated into ${lang.targetLabel}."}],
      "synonyms": [{"word": "synonym", "easyEnglish": "Simple meaning", "easyBengali": "Meaning in ${lang.targetLabel}"}],
      "antonyms": []
    }
  ],
  "collocations": [{"english": "common phrase", "bengali": "${lang.targetLabel}"}],
  "idiomsAndPhrases": [{"phrase": "idiom", "easyEnglish": "simple meaning", "easyBengali": "${lang.targetLabel}"}],
  "wordForms": [{"form": "${cleanLemma}", "partOfSpeech": "${partOfSpeech}"}],
  "confusingWords": []
}`;

    const userPrompt = `Word: "${cleanLemma}"\nPart of Speech: "${partOfSpeech}"\nContextual Sense ID: "${contextualSenseId}"`;

    let raw = await this.callAnthropic(systemPrompt, userPrompt);
    let parsed: any;
    try {
      parsed = safeParseJSON(raw);
    } catch {
      raw = await this.callAnthropic(systemPrompt, `${userPrompt}\n\nCRITICAL: Output ONLY valid JSON.`);
      parsed = safeParseJSON(raw);
    }

    let validation = validateStageB(parsed, cleanLemma, this.targetLang);
    if (!validation.isValid) {
      console.warn('[LexiFlow Anthropic] Stage B validation failed, retrying once...', validation.errors);
      const correctionPrompt = `${userPrompt}\n\nYour previous response had validation errors:\n${validation.errors.join('\n')}\nPlease ensure the contextual sense is ordered first, all ${lang.targetLabel} fields are accurate, and return valid JSON.`;
      const retryRaw = await this.callAnthropic(systemPrompt, correctionPrompt);
      try {
        const retryParsed = safeParseJSON(retryRaw);
        const retryVal = validateStageB(retryParsed, cleanLemma, this.targetLang);
        if (retryVal.isValid && retryVal.data) {
          return retryVal.data;
        }
      } catch (err) {
        console.warn('[LexiFlow Anthropic] Stage B retry parse error:', err);
      }
    }

    if (validation.isValid && validation.data) {
      return validation.data;
    }

    return {
      lemma: cleanLemma,
      partOfSpeech,
      contextualSenseId,
      senses: [
        {
          id: contextualSenseId,
          partOfSpeech,
          easyEnglish: parsed?.senses?.[0]?.easyEnglish || `Main common meaning in daily English.`,
          easyBengali: parsed?.senses?.[0]?.easyBengali || 'Main meaning',
          isContextual: true,
          registerOrType: 'standard',
          examples: parsed?.senses?.[0]?.examples || [{ english: `He used the word ${cleanLemma} properly.`, bengali: `Example translation.` }],
          synonyms: parsed?.senses?.[0]?.synonyms || [],
          antonyms: parsed?.senses?.[0]?.antonyms || []
        }
      ],
      collocations: parsed?.collocations || [],
      idiomsAndPhrases: parsed?.idiomsAndPhrases || [],
      wordForms: parsed?.wordForms || [{ form: cleanLemma, partOfSpeech }]
    };
  }

  async analyze(
    text: string,
    type: SelectionType,
    contextSentence?: string,
    paragraphContext?: string
  ): Promise<LinguisticAnalysisResult> {
    const lang = getLanguageConfig(this.targetLang);
    let sys = '';

    if (type === 'word') {
      sys = `You are an expert bilingual lexicographer for an ESL ${lang.targetLabel} learner.
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
      sys = `You are an expert bilingual tutor for an ESL ${lang.targetLabel} learner.
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
      sys = `Analyze this sentence for an ESL ${lang.targetLabel} learner.
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
      sys = `Analyze this text for a learner using smart hierarchical segmentation:
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
              "easyEnglish": "Simple English explanation",
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

    const prompt = `Text: ${text}\nType: ${type}\nSentence: ${contextSentence || ''}\nParagraph: ${paragraphContext || ''}`;
    const raw = await this.callAnthropic(sys, prompt);
    let parsed: any;
    try {
      parsed = safeParseJSON(raw);
    } catch {
      parsed = {};
    }
    if (parsed && typeof parsed === 'object') {
      if (!parsed.selectedText) parsed.selectedText = text;
      if (!parsed.selectionType) parsed.selectionType = type;
    }

    if (type === 'word') return WordAnalysisSchema.parse(parsed);
    if (type === 'phrase') return PhraseAnalysisSchema.parse(parsed);
    if (type === 'sentence') return SentenceAnalysisSchema.parse(parsed);
    return ParagraphAnalysisSchema.parse(parsed);
  }

  async assistWriting(text: string, goal: WritingGoal): Promise<WritingAssistResult> {
    const lang = getLanguageConfig(this.targetLang);
    const prompt = `Writing assistant for goal "${goal}".
In "bengaliExplanation", provide ${lang.promptTargetInstruction}.
Return a valid raw JSON object strictly adhering to this schema:
{
  "originalText": "${text}",
  "goal": "${goal}",
  "improvedText": "Improved version of text",
  "changesExplanation": "Clear explanation of improvements made",
  "bengaliExplanation": "Explanation in ${lang.targetLabel}",
  "alternatives": ["Alternative phrasing 1", "Alternative phrasing 2"]
}`;
    const raw = await this.callAnthropic(prompt, text);
    return WritingAssistSchema.parse(safeParseJSON(raw));
  }

  async askFollowUp(text: string, context: string, question: string): Promise<FollowUpResponse> {
    const lang = getLanguageConfig(this.targetLang);
    const sys = `You are LexiFlow AI Language Coach, an expert, warm, and highly engaging bilingual English-${lang.targetLabel} tutor.
Answer the learner's question with pedagogical clarity, conversational engagement, and natural ${lang.targetLabel} insight (${lang.targetNativeHeader}).
In "bengaliSummary" and example translations, provide ${lang.promptTargetInstruction}.
Return JSON adhering to FollowUpResponseSchema:
{
  "question": "${question}",
  "keyTakeaway": "Short memorable punchline or rule",
  "answer": "Engaging, conversational, well-structured explanation",
  "bengaliSummary": "Clear, natural ${lang.targetLabel} summary (${lang.targetNativeHeader})",
  "suggestedFollowUps": ["Follow-up 1?", "Follow-up 2?"],
  "examples": [
    { "english": "Example sentence", "bengali": "${lang.targetLabel} translation of example" }
  ]
}`;
    const raw = await this.callAnthropic(sys, `Text: ${text}\nContext: ${context}\nQuestion: ${question}`);
    return FollowUpResponseSchema.parse(safeParseJSON(raw));
  }
}
