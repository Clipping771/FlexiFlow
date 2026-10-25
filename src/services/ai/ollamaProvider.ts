import {
  SelectionType,
  LinguisticAnalysisResult,
  WritingGoal,
  WritingAssistResult,
  FollowUpResponse,
  HighlightExtractionResult,
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
  withJsonOnlyReminder,
  toSinglePrompt
} from './prompts';
import { validateStageA, validateStageB } from './validation';

export class OllamaProvider implements AIProvider {
  name = 'ollama';
  private endpoint: string;
  private model: string;
  private targetLang: string;

  constructor(
    endpoint: string = 'http://localhost:11434',
    model: string = 'llama3.2',
    targetLang: string = 'bn'
  ) {
    this.endpoint = endpoint.replace(/\/+$/, '');
    this.model = model || 'llama3.2';
    this.targetLang = targetLang || 'bn';
  }

  isAvailable(): boolean {
    return true;
  }

  private async callOllama(prompt: string, numCtx?: number): Promise<string> {
    const formattedPrompt = `${prompt}\nRespond with JSON only adhering strictly to schema.`;
    // Ollama silently drops the start of a prompt longer than its context window (often only 2-4K tokens),
    // which for long prompts loses the instructions. Long-input calls pass an explicit window.
    const options = numCtx ? { options: { num_ctx: numCtx } } : {};

    // Try primary endpoint, with automatic fallback between localhost and 127.0.0.1
    const candidateEndpoints = [this.endpoint];
    if (this.endpoint.includes('localhost')) {
      candidateEndpoints.push(this.endpoint.replace('localhost', '127.0.0.1'));
    } else if (this.endpoint.includes('127.0.0.1')) {
      candidateEndpoints.push(this.endpoint.replace('127.0.0.1', 'localhost'));
    }

    let lastError: any = null;

    for (const ep of candidateEndpoints) {
      try {
        console.debug(`[LexiFlow Ollama] Dispatching request to endpoint: ${ep}, active model: ${this.model}`);
        
        // 1. Primary attempt: /api/chat
        let chatRes = await fetch(`${ep}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: this.model,
            messages: [{ role: 'user', content: formattedPrompt }],
            format: 'json',
            stream: false,
            ...options
          })
        });

        // If model not found (e.g. 404 or error text), try auto-detecting installed model from /api/tags
        if (!chatRes.ok && (chatRes.status === 404 || chatRes.status === 400)) {
          const errText = await chatRes.text().catch(() => '');
          if (errText.includes('not found') || chatRes.status === 404) {
            console.warn(`[LexiFlow Ollama] Model "${this.model}" not found at ${ep}. Attempting model auto-discovery from /api/tags...`);
            const discovered = await this.autoDiscoverModel(ep);
            if (discovered && discovered !== this.model) {
              console.debug(`[LexiFlow Ollama] Discovered and switched to active model: "${discovered}"`);
              this.model = discovered;
              chatRes = await fetch(`${ep}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  model: this.model,
                  messages: [{ role: 'user', content: formattedPrompt }],
                  format: 'json',
                  stream: false,
                  ...options
                })
              });
            }
          }
        }

        if (chatRes.ok) {
          this.endpoint = ep; // lock on working endpoint
          const data = await chatRes.json();
          const content = data?.message?.content || data?.response;
          if (content) return content;
        }

        // 2. Secondary fallback: /api/generate
        let genRes = await fetch(`${ep}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: this.model,
            prompt: formattedPrompt,
            format: 'json',
            stream: false,
            ...options
          })
        });

        if (genRes.ok) {
          this.endpoint = ep;
          const data = await genRes.json();
          return data.response;
        }

        const failedRes = (!chatRes.ok && chatRes.status !== 404) ? chatRes : genRes;
        if (failedRes.status === 401) {
          throw new Error('Run `ollama signin` in a terminal (only needed for -cloud models).');
        }
        if (failedRes.status === 403) {
          throw new Error('Ollama blocked the request.');
        }

        let errText = '';
        try {
          const errJson = await failedRes.json();
          errText = errJson?.error || JSON.stringify(errJson);
        } catch {
          errText = await failedRes.text().catch(() => '');
        }
        lastError = new Error(`Local Ollama error (${failedRes.status}): ${errText || failedRes.statusText}`);
      } catch (err: any) {
        lastError = err;
      }
    }

    if (
      !lastError ||
      lastError.name === 'TypeError' ||
      /fetch|connect|econnrefused/i.test(lastError.message || '')
    ) {
      throw new Error('Ollama is not running. Open the Ollama app and try again.');
    }

    throw lastError;
  }

  private async autoDiscoverModel(endpoint: string): Promise<string | null> {
    try {
      const res = await fetch(`${endpoint}/api/tags`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.models) && data.models.length > 0) {
          return data.models[0].name;
        }
      }
    } catch {
      // ignore
    }
    return null;
  }

  async analyzeStageA(
    text: string,
    contextSentence?: string,
    paragraphContext?: string
  ): Promise<StageAExplanation> {
    const cleanText = text.trim();
    const prompt = toSinglePrompt(buildStageAPrompt({ text, contextSentence, paragraphContext }, this.targetLang));

    let raw = await this.callOllama(prompt);
    let parsed: any;
    try {
      parsed = safeParseJSON(raw);
    } catch {
      raw = await this.callOllama(withJsonOnlyReminder(prompt));
      parsed = safeParseJSON(raw);
    }

    let validation = validateStageA(parsed, this.targetLang);
    if (!validation.isValid) {
      console.warn('[LexiFlow Ollama] Stage A validation failed, retrying once...', validation.errors);
      const correctionPrompt = buildStageACorrection(prompt, validation.errors, this.targetLang);
      const retryRaw = await this.callOllama(correctionPrompt);
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
        console.warn('[LexiFlow Ollama] Stage A retry parse error:', err);
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
    const prompt = toSinglePrompt(buildStageBPrompt({ lemma, partOfSpeech, contextualSenseId }, this.targetLang));

    let raw = await this.callOllama(prompt);
    let parsed: any;
    try {
      parsed = safeParseJSON(raw);
    } catch {
      raw = await this.callOllama(withJsonOnlyReminder(prompt));
      parsed = safeParseJSON(raw);
    }

    let validation = validateStageB(parsed, cleanLemma, this.targetLang);
    if (!validation.isValid) {
      console.warn('[LexiFlow Ollama] Stage B validation failed, retrying once...', validation.errors);
      const correctionPrompt = buildStageBCorrection(prompt, validation.errors, this.targetLang);
      const retryRaw = await this.callOllama(correctionPrompt);
      try {
        const retryParsed = safeParseJSON(retryRaw);
        const retryVal = validateStageB(retryParsed, cleanLemma, this.targetLang);
        if (retryVal.isValid && retryVal.data) {
          return retryVal.data;
        }
      } catch (err) {
        console.warn('[LexiFlow Ollama] Stage B retry parse error:', err);
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
    const prompt = toSinglePrompt(buildAnalyzePrompt({ text, type, contextSentence, paragraphContext }, this.targetLang, 'compact'));
    const raw = await this.callOllama(prompt);
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
    const prompt = toSinglePrompt(buildWritingAssistPrompt({ text, goal }, this.targetLang, 'compact'));
    const raw = await this.callOllama(prompt);
    return WritingAssistSchema.parse(safeParseJSON(raw));
  }

  async askFollowUp(text: string, context: string, question: string): Promise<FollowUpResponse> {
    const prompt = toSinglePrompt(buildFollowUpPrompt({ text, context, question }, this.targetLang, 'compact'));
    const raw = await this.callOllama(prompt);
    return FollowUpResponseSchema.parse(safeParseJSON(raw));
  }

  async evaluateUsage(targetWord: string, sentence: string): Promise<UsageCoachFeedback> {
    const prompt = toSinglePrompt(buildUsageEvaluationPrompt({ targetWord, sentence }, this.targetLang));
    const raw = await this.callOllama(prompt);
    return UsageCoachFeedbackSchema.parse({ ...(safeParseJSON(raw) as Record<string, unknown>), targetWord });
  }

  async evaluateSummary(input: SummaryEvaluationInput): Promise<SummaryEvaluation> {
    const spec = buildSummaryEvaluationPrompt(input, this.targetLang);
    const prompt = toSinglePrompt(spec);
    const raw = await this.callOllama(prompt, ollamaContextFor(prompt, spec.maxTokens));
    return parseSummaryEvaluation(safeParseJSON(raw));
  }

  async extractHighlights(rawText: string, pageTitle?: string): Promise<HighlightExtractionResult> {
    console.debug(`[LexiFlow Ollama] Extracting highlights using model: "${this.model}" at ${this.endpoint}`);

    const spec = buildHighlightsPrompt({ rawText, pageTitle }, this.targetLang, 'compact');
    const prompt = toSinglePrompt(spec);
    const raw = await this.callOllama(prompt, ollamaContextFor(prompt, spec.maxTokens));
    let parsed: any;
    try {
      parsed = safeParseJSON(raw);
    } catch (err) {
      console.warn('[LexiFlow Ollama] extractHighlights JSON parse error, raw was:', raw.slice(0, 200));
      parsed = { items: [] };
    }

    const items = Array.isArray(parsed?.items) ? parsed.items : [];
    return HighlightExtractionResultSchema.parse({
      items,
      pageTitle: pageTitle || parsed?.pageTitle || 'Webpage Vocabulary',
      totalAnalyzedWords: rawText.split(/\s+/).filter(Boolean).length,
      sourceMode: 'ai_reasoning',
      articleSummary: parsed?.articleSummary
    });
  }
}

/**
 * Context window big enough for the prompt plus the expected output, rounded up to a power of two
 * (so repeated calls reuse the same loaded model instead of reloading it for every size).
 * ~3.5 characters per token is a conservative estimate for English text.
 */
export function ollamaContextFor(prompt: string, outputTokens: number): number {
  const needed = Math.ceil(prompt.length / 3.5) + outputTokens + 256;
  let ctx = 4096;
  while (ctx < needed && ctx < 32768) ctx *= 2;
  return ctx;
}
