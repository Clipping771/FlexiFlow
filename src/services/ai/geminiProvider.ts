import {
  SelectionType,
  LinguisticAnalysisResult,
  WritingGoal,
  WritingAssistResult,
  FollowUpResponse,
  StageAExplanation,
  StageBDetailedVocabulary,
  HighlightExtractionResult
} from '../../types';
import {
  WordAnalysisSchema,
  PhraseAnalysisSchema,
  SentenceAnalysisSchema,
  ParagraphAnalysisSchema,
  WritingAssistSchema,
  FollowUpResponseSchema,
  StageAContextualSchema,
  StageBDetailedVocabularySchema,
  HighlightExtractionResultSchema
} from './schemas';
import { validateStageA, validateStageB } from './validation';
import { AIProvider } from './types';
import { safeParseJSON } from './safeJson';
import {
  buildStageAPrompt,
  buildStageACorrection,
  buildStageBPrompt,
  buildStageBCorrection,
  buildAnalyzePrompt,
  buildWritingAssistPrompt,
  buildFollowUpPrompt,
  buildHighlightsPrompt,
  withJsonOnlyReminder
} from './prompts';

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
    maxTokens: number = 1500,
    withThinkingConfig: boolean = true,
    timeoutMs: number = 15000
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
    const { system: systemPrompt, user: userPrompt, maxTokens } = buildStageAPrompt({ text, contextSentence, paragraphContext }, this.targetLang);

    let raw = await this.callGemini(systemPrompt, userPrompt, maxTokens);
    let parsed: any;
    try {
      parsed = safeParseJSON(raw);
    } catch {
      // Retry once on parse error
      raw = await this.callGemini(systemPrompt, withJsonOnlyReminder(userPrompt), maxTokens);
      parsed = safeParseJSON(raw);
    }

    let validation = validateStageA(parsed, this.targetLang);
    if (!validation.isValid) {
      console.warn('[LexiFlow AI] Stage A validation failed, retrying once...', validation.errors);
      const correctionPrompt = buildStageACorrection(userPrompt, validation.errors, this.targetLang);
      const retryRaw = await this.callGemini(systemPrompt, correctionPrompt, maxTokens);
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
    const { system: systemPrompt, user: userPrompt, maxTokens } = buildStageBPrompt({ lemma, partOfSpeech, contextualSenseId }, this.targetLang);

    let raw = await this.callGemini(systemPrompt, userPrompt, maxTokens);
    let parsed: any;
    try {
      parsed = safeParseJSON(raw);
    } catch {
      raw = await this.callGemini(systemPrompt, withJsonOnlyReminder(userPrompt), maxTokens);
      parsed = safeParseJSON(raw);
    }

    let validation = validateStageB(parsed, cleanLemma, this.targetLang);
    if (!validation.isValid) {
      console.warn('[LexiFlow AI] Stage B validation failed, retrying once...', validation.errors);
      const correctionPrompt = buildStageBCorrection(userPrompt, validation.errors, this.targetLang);
      const retryRaw = await this.callGemini(systemPrompt, correctionPrompt, maxTokens);
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
    const prompt = buildAnalyzePrompt({ text, type, contextSentence, paragraphContext }, this.targetLang, 'full');
    const raw = await this.callGemini(prompt.system, prompt.user, prompt.maxTokens);
    if (type === 'word') return WordAnalysisSchema.parse(safeParseJSON(raw));
    if (type === 'phrase') return PhraseAnalysisSchema.parse(safeParseJSON(raw));
    if (type === 'sentence') return SentenceAnalysisSchema.parse(safeParseJSON(raw));
    return ParagraphAnalysisSchema.parse(safeParseJSON(raw));
  }

  async assistWriting(text: string, goal: WritingGoal): Promise<WritingAssistResult> {
    const prompt = buildWritingAssistPrompt({ text, goal }, this.targetLang, 'full');
    const raw = await this.callGemini(prompt.system, prompt.user, prompt.maxTokens);
    return WritingAssistSchema.parse(safeParseJSON(raw));
  }

  async askFollowUp(text: string, context: string, question: string): Promise<FollowUpResponse> {
    const prompt = buildFollowUpPrompt({ text, context, question }, this.targetLang, 'full');
    const raw = await this.callGemini(prompt.system, prompt.user, prompt.maxTokens);
    return FollowUpResponseSchema.parse(safeParseJSON(raw));
  }

  async extractHighlights(rawText: string, pageTitle?: string): Promise<HighlightExtractionResult> {
    const prompt = buildHighlightsPrompt({ rawText, pageTitle }, this.targetLang, 'full');
    const raw = await this.callGemini(prompt.system, prompt.user, prompt.maxTokens);
    const parsed = safeParseJSON(raw);
    const validated = HighlightExtractionResultSchema.parse(parsed);
    validated.sourceMode = 'ai_reasoning';
    return validated;
  }
}
