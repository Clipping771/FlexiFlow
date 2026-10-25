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
  HighlightExtractionResultSchema
} from './schemas';
import { AIProvider } from './types';
import { safeParseJSON } from './safeJson';
import { SummaryEvaluation } from '../../types';
import { buildSummaryEvaluationPrompt, SummaryEvaluationInput } from './prompts';
import { parseSummaryEvaluation } from './summarySchema';
import { UsageCoachFeedback } from '../../types';
import { buildUsageEvaluationPrompt } from './prompts';
import { UsageCoachFeedbackSchema } from './usageCoachSchema';
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
import { validateStageA, validateStageB } from './validation';

export class OpenAIProvider implements AIProvider {
  name = 'openai';
  private apiKey: string;
  private model: string;
  private endpoint: string;
  private targetLang: string;

  constructor(
    apiKey: string = '',
    model: string = 'gpt-4o-mini',
    endpoint: string = 'https://api.openai.com/v1',
    targetLang: string = 'bn'
  ) {
    this.apiKey = apiKey;
    this.model = model;
    this.endpoint = endpoint.replace(/\/+$/, '');
    this.targetLang = targetLang || 'bn';
  }

  isAvailable(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  private async callOpenAI(systemPrompt: string, userPrompt: string, timeoutMs: number = 12000): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error('OpenAI API key is not configured in LexiFlow settings.');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort(new Error(`OpenAI request timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    let res: Response;
    try {
      res = await fetch(`${this.endpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: `${systemPrompt}\nOutput ONLY valid raw JSON.` },
            { role: 'user', content: userPrompt }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2
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
      throw new Error(`OpenAI API error (${res.status}): ${err}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('Empty response from OpenAI API.');

    return content.trim();
  }

  async analyzeStageA(
    text: string,
    contextSentence?: string,
    paragraphContext?: string
  ): Promise<StageAExplanation> {
    const cleanText = text.trim();
    const { system: systemPrompt, user: userPrompt } = buildStageAPrompt({ text, contextSentence, paragraphContext }, this.targetLang);

    let raw = await this.callOpenAI(systemPrompt, userPrompt);
    let parsed: any;
    try {
      parsed = safeParseJSON(raw);
    } catch {
      raw = await this.callOpenAI(systemPrompt, withJsonOnlyReminder(userPrompt));
      parsed = safeParseJSON(raw);
    }

    let validation = validateStageA(parsed, this.targetLang);
    if (!validation.isValid) {
      console.warn('[LexiFlow OpenAI] Stage A validation failed, retrying once...', validation.errors);
      const correctionPrompt = buildStageACorrection(userPrompt, validation.errors, this.targetLang);
      const retryRaw = await this.callOpenAI(systemPrompt, correctionPrompt);
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
        console.warn('[LexiFlow OpenAI] Stage A retry parse error:', err);
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
    const { system: systemPrompt, user: userPrompt } = buildStageBPrompt({ lemma, partOfSpeech, contextualSenseId }, this.targetLang);

    let raw = await this.callOpenAI(systemPrompt, userPrompt);
    let parsed: any;
    try {
      parsed = safeParseJSON(raw);
    } catch {
      raw = await this.callOpenAI(systemPrompt, withJsonOnlyReminder(userPrompt));
      parsed = safeParseJSON(raw);
    }

    let validation = validateStageB(parsed, cleanLemma, this.targetLang);
    if (!validation.isValid) {
      console.warn('[LexiFlow OpenAI] Stage B validation failed, retrying once...', validation.errors);
      const correctionPrompt = buildStageBCorrection(userPrompt, validation.errors, this.targetLang);
      const retryRaw = await this.callOpenAI(systemPrompt, correctionPrompt);
      try {
        const retryParsed = safeParseJSON(retryRaw);
        const retryVal = validateStageB(retryParsed, cleanLemma, this.targetLang);
        if (retryVal.isValid && retryVal.data) {
          return retryVal.data;
        }
      } catch (err) {
        console.warn('[LexiFlow OpenAI] Stage B retry parse error:', err);
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
    const prompt = buildAnalyzePrompt({ text, type, contextSentence, paragraphContext }, this.targetLang, 'compact');
    const raw = await this.callOpenAI(prompt.system, prompt.user);
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
    const prompt = buildWritingAssistPrompt({ text, goal }, this.targetLang, 'compact');
    const raw = await this.callOpenAI(prompt.system, prompt.user);
    return WritingAssistSchema.parse(safeParseJSON(raw));
  }

  async askFollowUp(text: string, context: string, question: string): Promise<FollowUpResponse> {
    const prompt = buildFollowUpPrompt({ text, context, question }, this.targetLang, 'compact');
    const raw = await this.callOpenAI(prompt.system, prompt.user);
    return FollowUpResponseSchema.parse(safeParseJSON(raw));
  }

  async evaluateUsage(targetWord: string, sentence: string): Promise<UsageCoachFeedback> {
    const prompt = buildUsageEvaluationPrompt({ targetWord, sentence }, this.targetLang);
    const raw = await this.callOpenAI(prompt.system, prompt.user, 30000);
    return UsageCoachFeedbackSchema.parse({ ...(safeParseJSON(raw) as Record<string, unknown>), targetWord });
  }

  async evaluateSummary(input: SummaryEvaluationInput): Promise<SummaryEvaluation> {
    const prompt = buildSummaryEvaluationPrompt(input, this.targetLang);
    const raw = await this.callOpenAI(prompt.system, prompt.user, 60000);
    return parseSummaryEvaluation(safeParseJSON(raw));
  }

  async extractHighlights(rawText: string, pageTitle?: string): Promise<HighlightExtractionResult> {
    const prompt = buildHighlightsPrompt({ rawText, pageTitle }, this.targetLang, 'full');
    // A whole article takes far longer than a single-word lookup
    const raw = await this.callOpenAI(prompt.system, prompt.user, 60000);
    const validated = HighlightExtractionResultSchema.parse(safeParseJSON(raw));
    validated.sourceMode = 'ai_reasoning';
    return validated;
  }
}
