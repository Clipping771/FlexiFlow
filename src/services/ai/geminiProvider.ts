import {
  SelectionType,
  LinguisticAnalysisResult,
  WritingGoal,
  WritingAssistResult,
  FollowUpResponse,
  StageAExplanation,
  StageBDetailedVocabulary
} from '../../types';
import {
  WordAnalysisSchema,
  PhraseAnalysisSchema,
  SentenceAnalysisSchema,
  ParagraphAnalysisSchema,
  WritingAssistSchema,
  FollowUpResponseSchema,
  StageAContextualSchema,
  StageBDetailedVocabularySchema
} from './schemas';
import { validateStageA, validateStageB } from './validation';
import { AIProvider } from './types';
import { getLanguageConfig } from '../../config/languages';
import { safeParseJSON } from './safeJson';

export class GeminiProvider implements AIProvider {
  name = 'gemini';
  private apiKey: string;
  private model: string;
  private targetLang: string;

  constructor(apiKey: string = '', model: string = 'gemini-2.0-flash', targetLang: string = 'bn') {
    this.apiKey = apiKey;
    this.model = model;
    this.targetLang = targetLang;
  }

  isAvailable(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  private async executeGeminiRequest(
    modelName: string,
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number = 750,
    withThinkingConfig: boolean = true,
    timeoutMs: number = 12000
  ): Promise<Response> {
    const cleanKey = this.apiKey.trim().replace(/^['"]|['"]$/g, '');
    const isOAuthToken = cleanKey.startsWith('ya29.');

    const url = isOAuthToken
      ? `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`
      : `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(cleanKey)}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (isOAuthToken) {
      headers['Authorization'] = `Bearer ${cleanKey}`;
    } else {
      headers['x-goog-api-key'] = cleanKey;
    }

    const generationConfig: Record<string, any> = {
      responseMimeType: 'application/json',
      temperature: 0.1,
      maxOutputTokens: maxTokens
    };

    // Zero-out thinking budget only on modern reasoning models (Gemini 2.5 / 2.0 Thinking) to eliminate multi-second latency
    // Standard models like gemini-2.0-flash / gemini-1.5 reject thinkingConfig with HTTP 400
    const isThinkingModel = modelName.includes('thinking') || modelName.includes('2.5');
    if (withThinkingConfig && isThinkingModel) {
      generationConfig.thinkingConfig = { thinkingBudget: 0 };
    }

    const payload = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: `${systemPrompt}\n\nRespond ONLY in valid raw JSON matching the requested schema without markdown fences.\n\nInput:\n${userPrompt}` }
          ]
        }
      ],
      generationConfig
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort(new Error(`Gemini request timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return res;
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  private async callGemini(
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number = 750
  ): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error('Gemini API key is not configured in LexiFlow settings.');
    }

    let targetModel = this.model;
    // Primary fast attempt with thinkingBudget: 0
    let res = await this.executeGeminiRequest(targetModel, systemPrompt, userPrompt, maxTokens, true);

    // If HTTP 400, model might not support thinkingConfig, immediately retry without it
    if (!res.ok && res.status === 400) {
      const retryNoThinking = await this.executeGeminiRequest(targetModel, systemPrompt, userPrompt, maxTokens, false);
      if (retryNoThinking.ok) {
        res = retryNoThinking;
      }
    }

    // If model returns 404 (e.g. deprecated gemini-1.5-flash), automatically attempt active modern models
    if (!res.ok && res.status === 404) {
      const candidates = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash-latest']
        .filter((m) => m !== targetModel);

      for (const fallbackModel of candidates) {
        console.warn(`[LexiFlow] Model "${targetModel}" returned 404. Trying fallback "${fallbackModel}"...`);
        let fallbackRes = await this.executeGeminiRequest(fallbackModel, systemPrompt, userPrompt, maxTokens, true);
        if (!fallbackRes.ok && fallbackRes.status === 400) {
          fallbackRes = await this.executeGeminiRequest(fallbackModel, systemPrompt, userPrompt, maxTokens, false);
        }
        if (fallbackRes.ok) {
          res = fallbackRes;
          targetModel = fallbackModel;
          this.model = fallbackModel; // adopt the working model
          break;
        }
      }
    }

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini API error (${res.status}): ${err}`);
    }

    const data = await res.json();
    const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidate) throw new Error('Empty response from Gemini API.');

    return candidate.replace(/```json/g, '').replace(/```/g, '').trim();
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

    let raw = await this.callGemini(systemPrompt, userPrompt, 550);
    let parsed: any;
    try {
      parsed = safeParseJSON(raw);
    } catch {
      // Retry once on parse error
      raw = await this.callGemini(systemPrompt, `${userPrompt}\n\nCRITICAL: Output ONLY valid JSON.`, 550);
      parsed = safeParseJSON(raw);
    }

    let validation = validateStageA(parsed, this.targetLang);
    if (!validation.isValid) {
      console.warn('[LexiFlow AI] Stage A validation failed, retrying once...', validation.errors);
      const correctionPrompt = `${userPrompt}\n\nYour previous response had validation errors:\n${validation.errors.join('\n')}\nPlease correct these errors and ensure "${lang.targetLabel}" explanation and all required fields are present.`;
      const retryRaw = await this.callGemini(systemPrompt, correctionPrompt, 550);
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
        console.warn('[LexiFlow AI] Stage A retry parse error:', err);
      }
    }

    if (validation.isValid && validation.data) {
      if (cleanText && (!validation.data.selectedText || validation.data.selectedText.trim() !== cleanText)) {
        validation.data.selectedText = cleanText;
      }
      return validation.data;
    }

    // Graceful fallback to prevent popup crash
    return {
      selectedText: cleanText,
      lemma: parsed?.lemma || cleanText.toLowerCase(),
      partOfSpeech: parsed?.partOfSpeech || 'word',
      easyEnglish: parsed?.easyEnglish || 'Used in this sentence to convey a specific idea.',
      easyBengali: parsed?.easyBengali && /[\u0980-\u09FF]/.test(parsed.easyBengali) ? parsed.easyBengali : 'প্রাসঙ্গিক অর্থ',
      contextMeaning: parsed?.contextMeaning || 'Meaning in this context.',
      example: parsed?.example || contextSentence,
      exampleBengali: parsed?.exampleBengali || 'বাক্যে এর ব্যবহার।',
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
      "registerOrType": "standard" | "literal" | "figurative" | "technical" | "idiomatic",
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

    let raw = await this.callGemini(systemPrompt, userPrompt, 1100);
    let parsed: any;
    try {
      parsed = safeParseJSON(raw);
    } catch {
      raw = await this.callGemini(systemPrompt, `${userPrompt}\n\nCRITICAL: Output ONLY valid JSON.`, 1100);
      parsed = safeParseJSON(raw);
    }

    let validation = validateStageB(parsed, cleanLemma, this.targetLang);
    if (!validation.isValid) {
      console.warn('[LexiFlow AI] Stage B validation failed, retrying once...', validation.errors);
      const correctionPrompt = `${userPrompt}\n\nYour previous response had validation errors:\n${validation.errors.join('\n')}\nPlease ensure the contextual sense is ordered first, all ${lang.targetLabel} fields are accurate, and return valid JSON.`;
      const retryRaw = await this.callGemini(systemPrompt, correctionPrompt, 1100);
      try {
        const retryParsed = safeParseJSON(retryRaw);
        const retryVal = validateStageB(retryParsed, cleanLemma, this.targetLang);
        if (retryVal.isValid && retryVal.data) {
          return retryVal.data;
        }
      } catch (err) {
        console.warn('[LexiFlow AI] Stage B retry parse error:', err);
      }
    }

    if (validation.isValid && validation.data) {
      return validation.data;
    }

    // Graceful fallback
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

    if (type === 'word') {
      const sys = `You are an elite bilingual lexicographer and contextual language expert.
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
  "synonyms": ["synonym 1"],
  "antonyms": ["antonym 1"],
  "registerAndTone": "Tone description"
}`;
      const raw = await this.callGemini(sys, `Target: ${text}\nSentence: ${contextSentence || ''}`, 650);
      return WordAnalysisSchema.parse(safeParseJSON(raw));
    } else if (type === 'phrase') {
      const sys = `Analyze the phrase or idiom "${text}" in context: "${contextSentence || ''}".
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
      const raw = await this.callGemini(sys, `Phrase: ${text}\nContext: ${contextSentence || ''}`, 650);
      return PhraseAnalysisSchema.parse(safeParseJSON(raw));
    } else if (type === 'sentence') {
      const sys = `Analyze this sentence for a learner. Divide the sentence into meaningful English phrases or clauses in their original order.
Do not split into arbitrary single words. For every phrase provide the exact phrase, very simple everyday English, and natural easy ${lang.targetLabel} (${lang.promptTargetInstruction}).
Return JSON adhering to SentenceAnalysisSchema:
{
  "selectedText": "${text}",
  "selectionType": "sentence",
  "plainEnglishParaphrase": "Very easy plain English paraphrase",
  "overallMeaning": "Overall meaning",
  "bengaliTranslation": "Complete natural ${lang.targetLabel} translation (${lang.promptTargetInstruction})",
  "phraseBreakdown": [
    {
      "phrase": "Exact meaningful phrase from sentence",
      "easyEnglish": "Very simple everyday English explanation in short sentences.",
      "easyBengali": "Natural easy ${lang.targetLabel} explanation or translation (${lang.promptTargetInstruction})"
    }
  ],
  "clauses": [
    {
      "text": "Clause text",
      "type": "main" | "subordinate" | "relative" | "participial" | "conditional",
      "role": "Syntactic role",
      "explanationBengali": "Clause explanation in ${lang.targetLabel}"
    }
  ],
  "grammaticalHighlights": ["feature 1"],
  "difficultVocabulary": [{"word": "word", "meaningInContext": "meaning", "bengali": "${lang.targetNativeHeader}"}],
  "toneAndRegister": "Tone"
}`;
      const raw = await this.callGemini(sys, `Sentence: ${text}`, 1100);
      return SentenceAnalysisSchema.parse(safeParseJSON(raw));
    } else {
      const sys = `Analyze this paragraph for a learner. Divide the text into meaningful English phrases or clauses in original order.
Return JSON adhering to ParagraphAnalysisSchema:
{
  "selectedText": "${text}",
  "selectionType": "paragraph",
  "mainIdea": "Main thesis",
  "conciseSummary": "Concise summary",
  "bengaliTranslation": "Complete natural ${lang.targetLabel} translation of paragraph (${lang.promptTargetInstruction})",
  "phraseBreakdown": [
    {
      "phrase": "Exact meaningful phrase from paragraph",
      "easyEnglish": "Very simple everyday English explanation in short sentences.",
      "easyBengali": "Natural easy ${lang.targetLabel} explanation or translation (${lang.promptTargetInstruction})"
    }
  ],
  "sentenceBreakdown": ["Sentence 1 summary", "Sentence 2 summary"],
  "keyVocabulary": [{"term": "term", "meaning": "meaning", "bengali": "${lang.targetNativeHeader}"}],
  "argumentStructure": "Flow description",
  "toneAndRegister": "Tone"
}`;
      const raw = await this.callGemini(sys, `Paragraph:\n${text}`, 1200);
      return ParagraphAnalysisSchema.parse(safeParseJSON(raw));
    }
  }

  async assistWriting(text: string, goal: WritingGoal): Promise<WritingAssistResult> {
    const sys = `You are a writing coach. Polish the learner's text for goal "${goal}".
Return JSON adhering to WritingAssistSchema:
{
  "originalText": "${text}",
  "goal": "${goal}",
  "improvedText": "Improved sentence",
  "changesExplanation": "What was improved and why",
  "bengaliExplanation": "Bengali explanation of changes",
  "alternatives": ["alternative 1", "alternative 2"]
}`;
    const raw = await this.callGemini(sys, `Goal: ${goal}\nText:\n${text}`, 800);
    return WritingAssistSchema.parse(safeParseJSON(raw));
  }

  async askFollowUp(text: string, context: string, question: string): Promise<FollowUpResponse> {
    const sys = `You are LexiFlow AI Language Coach, an expert, warm, and highly engaging bilingual English-Bengali tutor (inspired by Claude's conversational clarity, intellectual depth, and encouraging tone).
The learner is asking a follow-up question about the selected text: "${text}" in context: "${context}".

Provide a thoughtful, engaging, pedagogically rich response.
Guidelines:
1. "answer": Speak conversationally, directly addressing the learner's curiosity with clarity, vivid analogies, or concrete explanations. Use clean formatting with markdown emphasis.
2. "keyTakeaway": A concise 1-sentence memorable punchline or rule of thumb.
3. "bengaliSummary": Warm, natural, easy-to-understand Bengali summary and cultural/linguistic nuance.
4. "examples": 1-2 realistic, practical example sentences with English and Bengali translations.
5. "suggestedFollowUps": 2-3 engaging, highly relevant follow-up questions the learner might want to ask next to deepen their understanding.

Return JSON adhering to FollowUpResponseSchema:
{
  "question": "${question}",
  "keyTakeaway": "Short memorable punchline or key rule",
  "answer": "Engaging, conversational, well-structured explanation",
  "bengaliSummary": "সহজ ও প্রাঞ্জল বাংলা সারসংক্ষেপ ও ভাবার্থ",
  "suggestedFollowUps": ["Suggested follow-up 1?", "Suggested follow-up 2?"],
  "examples": [
    { "english": "Example sentence", "bengali": "উদাহরণ বাক্যের বাংলা" }
  ]
}`;
    const raw = await this.callGemini(sys, `Text: ${text}\nContext: ${context}\nQuestion: ${question}`, 850);
    return FollowUpResponseSchema.parse(safeParseJSON(raw));
  }
}
