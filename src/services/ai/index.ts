import { UserSettings, StageAExplanation, StageBDetailedVocabulary, SelectionType, LinguisticAnalysisResult, HighlightExtractionResult } from '../../types';
import { SettingsService } from '../storage/settings';
import { registerCustomLanguages, getLanguageConfig } from '../../config/languages';
import { AnthropicProvider } from './anthropicProvider';
import { GeminiProvider } from './geminiProvider';
import { MockAIProvider } from './mockProvider';
import { OllamaProvider } from './ollamaProvider';
import { OpenAIProvider } from './openaiProvider';
import { CloudProvider } from './cloudProvider';
import { TwoStageCacheService } from './cache';
import { CacheManager } from '../cache';
import { hashString } from '../cache/normalization';
import { AIProvider } from './types';
import {
  HighlightIntelligenceService,
  splitArticleIntoChunks,
  HIGHLIGHT_CHUNK_CHARS,
  HIGHLIGHT_MAX_CHUNKS
} from './highlightIntelligence';

export class AIService {
  private static cache = new Map<string, unknown>();
  private static inFlightRequests = new Map<string, Promise<unknown>>();

  static clearCache(): void {
    this.cache.clear();
    this.inFlightRequests.clear();
    TwoStageCacheService.clear();
    CacheManager.getInstance().clear();
  }

  static async getProvider(settings?: UserSettings): Promise<AIProvider> {
    const userSettings = settings || await SettingsService.getSettings();
    if (userSettings.customLanguages) {
      registerCustomLanguages(userSettings.customLanguages);
    }

    // If an API key is configured but provider was left as 'mock', automatically use the key!
    let effectiveProvider = userSettings.aiProvider;
    if ((effectiveProvider === 'mock' || !effectiveProvider) && userSettings.apiKey?.trim()) {
      effectiveProvider = 'gemini';
    }

    switch (effectiveProvider) {
      case 'lexiflow':
        return new CloudProvider(userSettings.targetLanguage || 'bn');
      case 'gemini':
        if (userSettings.apiKey?.trim()) {
          const model = (!userSettings.selectedModel || userSettings.selectedModel === 'gemini-1.5-flash')
            ? 'gemini-2.0-flash'
            : userSettings.selectedModel;
          return new GeminiProvider(userSettings.apiKey.trim(), model, userSettings.targetLanguage || 'bn');
        }
        break;
      case 'openai':
        if (userSettings.apiKey) {
          return new OpenAIProvider(
            userSettings.apiKey,
            userSettings.selectedModel || 'gpt-4o-mini',
            userSettings.apiEndpoint,
            userSettings.targetLanguage || 'bn'
          );
        }
        break;
      case 'anthropic':
        if (userSettings.apiKey) {
          return new AnthropicProvider(
            userSettings.apiKey,
            userSettings.selectedModel || 'claude-3-5-sonnet-20241022',
            userSettings.targetLanguage || 'bn'
          );
        }
        break;
      case 'ollama': {
        const ep = userSettings.apiEndpoint?.trim() || 'http://127.0.0.1:11434';
        const model = (userSettings.selectedModel && userSettings.selectedModel !== 'llama3.2')
          ? userSettings.selectedModel
          : 'gemma4:31b-cloud';
        console.debug(`[LexiFlow AIService] Instantiating OllamaProvider with endpoint: ${ep}, model: ${model}`);
        return new OllamaProvider(
          ep,
          model,
          userSettings.targetLanguage || 'bn'
        );
      }
      default:
        break;
    }

    // Default honest fallback
    return new MockAIProvider(userSettings.targetLanguage || 'bn');
  }

  static async analyzeStageA(
    text: string,
    contextSentence?: string,
    paragraphContext?: string
  ): Promise<StageAExplanation> {
    const userSettings = await SettingsService.getSettings();
    const targetLang = userSettings.targetLanguage || 'bn';
    const cacheKey = TwoStageCacheService.getStageAKey(text, contextSentence, targetLang);
    return TwoStageCacheService.executeDeduplicatedStageA(cacheKey, async () => {
      const provider = await this.getProvider(userSettings);
      if (provider.analyzeStageA) {
        return provider.analyzeStageA(text, contextSentence, paragraphContext);
      }
      // Fallback: adapt from generic analyze
      const generic = await provider.analyze(text, 'word', contextSentence, paragraphContext) as any;
      const example = generic.examples?.[0] || contextSentence;
      let exampleBengali = generic.exampleBengali;
      if (!exampleBengali || exampleBengali === 'উদাহরণ বাক্যের অর্থ' || exampleBengali === 'বাক্যে এর ব্যবহার।') {
        if (example) {
          try {
            const tr = await provider.analyze(example, 'sentence') as any;
            exampleBengali = tr.bengaliTranslation || tr.easyBengali || '';
          } catch {
            exampleBengali = undefined;
          }
        }
      }
      return {
        selectedText: text,
        lemma: text.toLowerCase(),
        partOfSpeech: generic.partOfSpeech || 'word',
        easyEnglish: generic.simpleEnglishExplanation || generic.contextualMeaning || 'Contextual meaning.',
        easyBengali: generic.bengaliTranslation || 'বাংলা অর্থ',
        contextMeaning: generic.contextualMeaning || generic.whyFitsContext || 'Meaning in this context.',
        example,
        exampleBengali: exampleBengali || undefined,
        confidence: 'high',
        contextualSenseId: 'sense_1'
      };
    });
  }

  static async analyzeStageB(
    lemma: string,
    partOfSpeech?: string,
    contextualSenseId?: string
  ): Promise<StageBDetailedVocabulary> {
    const userSettings = await SettingsService.getSettings();
    const targetLang = userSettings.targetLanguage || 'bn';
    const cacheKey = TwoStageCacheService.getStageBKey(lemma, partOfSpeech, targetLang);
    return TwoStageCacheService.executeDeduplicatedStageB(cacheKey, async () => {
      const provider = await this.getProvider(userSettings);
      if (provider.analyzeStageB) {
        return provider.analyzeStageB(lemma, partOfSpeech, contextualSenseId);
      }
      // Fallback adapt from generic
      const generic = await provider.analyze(lemma, 'word') as any;
      return {
        lemma,
        partOfSpeech: partOfSpeech || generic.partOfSpeech || 'word',
        contextualSenseId: contextualSenseId || 'sense_1',
        senses: [
          {
            id: contextualSenseId || 'sense_1',
            partOfSpeech: partOfSpeech || generic.partOfSpeech || 'word',
            easyEnglish: generic.simpleEnglishExplanation || 'Primary meaning.',
            easyBengali: generic.bengaliTranslation || 'প্রধান অর্থ',
            isContextual: true,
            examples: (generic.examples || []).map((e: string, idx: number) => ({
              english: e,
              bengali: idx === 0 && generic.exampleBengali ? generic.exampleBengali : ''
            })),
            synonyms: (generic.synonyms || []).map((s: string) => ({
              word: s,
              easyEnglish: 'Similar word',
              easyBengali: ''
            })),
            antonyms: (generic.antonyms || []).map((a: string) => ({
              word: a,
              easyEnglish: 'Opposite word',
              easyBengali: ''
            }))
          }
        ],
        collocations: (generic.collocations || []).map((c: string) => ({ english: c })),
        idiomsAndPhrases: []
      };
    });
  }

  static async analyzeSelection(
    text: string,
    selectionType: SelectionType,
    contextSentence?: string,
    paragraphContext?: string
  ): Promise<LinguisticAnalysisResult> {
    const userSettings = await SettingsService.getSettings();
    const targetLang = userSettings.targetLanguage || 'bn';
    const key = `analyzeSelection:${selectionType}:${text.trim().toLowerCase()}::${contextSentence ? hashString(contextSentence) : ''}::${targetLang}`;
    return CacheManager.getInstance().executeDeduplicated(key, async () => {
      const provider = await this.getProvider(userSettings);
      return provider.analyze(text, selectionType, contextSentence, paragraphContext);
    });
  }

  static async extractHighlights(
    rawText: string,
    pageTitle?: string
  ): Promise<HighlightExtractionResult> {
    const userSettings = await SettingsService.getSettings();
    const targetLang = userSettings.targetLanguage || 'bn';
    const providerName = userSettings.aiProvider || 'mock';
    const isOllama = providerName === 'ollama';
    const hasApiKey = Boolean(userSettings.apiKey?.trim());
    const isLiveAI = providerName === 'lexiflow' || ((isOllama || hasApiKey) && providerName !== 'mock');
    const key = `extractHighlights:${hashString(rawText)}::${targetLang}::${providerName}::${isLiveAI ? 'ai' : 'offline'}`;

    return CacheManager.getInstance().executeDeduplicated(key, async () => {
      const provider = await this.getProvider(userSettings);
      let fallbackReason: HighlightExtractionResult['fallbackReason'] = isLiveAI ? 'ai_unsupported' : 'no_ai_configured';

      console.debug(`[LexiFlow AIService] extractHighlights starting with provider: "${providerName}", isLiveAI: ${isLiveAI}`);

      // 1. If an actual AI provider is configured and available (cloud with API key OR local Ollama)
      if (isLiveAI && provider.extractHighlights) {
        // Long articles go to the model in paragraph-aligned chunks so the end of the piece is read too
        const chunks = splitArticleIntoChunks(rawText, HIGHLIGHT_CHUNK_CHARS, HIGHLIGHT_MAX_CHUNKS);
        const candidates: HighlightExtractionResult['items'] = [];
        let articleSummary: string | undefined;
        let failures = 0;

        for (const chunk of chunks) {
          try {
            const aiResult = await provider.extractHighlights(chunk, pageTitle);
            if (aiResult && Array.isArray(aiResult.items)) {
              candidates.push(...aiResult.items);
              articleSummary = articleSummary || aiResult.articleSummary;
            }
          } catch (err) {
            failures++;
            console.warn(`[LexiFlow AIService] ${providerName} extractHighlights failed on a chunk:`, err);
          }
        }

        if (candidates.length > 0) {
          // Ids from separate chunks collide ("hl_1" in each), so renumber before merging
          const items = candidates.map((item, idx) => ({ ...item, id: `hl_${idx + 1}` }));
          const processed = HighlightIntelligenceService.processCandidates(
            { items, pageTitle, articleSummary, sourceMode: 'ai_reasoning', totalAnalyzedWords: 0 },
            rawText,
            { maxItems: Math.min(40, 20 + 10 * (chunks.length - 1)) }
          );
          processed.sourceMode = 'ai_reasoning';
          console.debug(`[LexiFlow AIService] AI extraction succeeded with ${processed.items.length} items from ${chunks.length} chunk(s) (provider: ${providerName})`);
          return processed;
        }

        fallbackReason = failures > 0 ? 'ai_failed' : 'ai_empty';
        console.warn(`[LexiFlow AIService] AI provider ${providerName} produced no usable items (${failures} failed chunk(s)).`);
      }

      // 2. Honest curated offline fallback when AI provider is unconfigured, mock, or failed
      console.debug(`[LexiFlow AIService] Using curated offline fallback for highlights`);
      const mock = new MockAIProvider(targetLang);
      const rawMock = await mock.extractHighlights(rawText, pageTitle);
      const processedMock = HighlightIntelligenceService.processCandidates(rawMock, rawText);
      processedMock.sourceMode = 'curated_offline_fallback';
      processedMock.fallbackReason = fallbackReason;
      return processedMock;
    });
  }

  static getCacheKey(action: string, args: Record<string, unknown>): string {
    return `${action}:${JSON.stringify(args)}`;
  }

  static getCached<T>(key: string): T | null {
    return (this.cache.get(key) as T) || null;
  }

  static setCached<T>(key: string, data: T): void {
    this.cache.set(key, data);
  }

  static async testConnection(customSettings?: Partial<UserSettings>): Promise<{
    success: boolean;
    provider: string;
    model: string;
    targetLanguage?: string;
    targetLabel?: string;
    flagEmoji?: string;
    latencyMs: number;
    sampleResult?: string;
    error?: string;
  }> {
    const start = Date.now();
    try {
      const current = await SettingsService.getSettings();
      const merged: UserSettings = { ...current, ...(customSettings || {}) };
      const provider = await this.getProvider(merged);

      if (merged.aiProvider !== 'mock' && !provider.isAvailable()) {
        throw new Error(`API key is required for ${merged.aiProvider.toUpperCase()} but was not provided.`);
      }

      // Perform a minimal, fast verification with the configured target language
      const res = await provider.analyze('resilient', 'word', 'They remained resilient during challenging times.');
      const latencyMs = Date.now() - start;

      const wordRes = res as any;
      const bText = wordRes.bengaliTranslation ? ` (${wordRes.bengaliTranslation})` : '';
      const meanText = wordRes.contextualMeaning || wordRes.simpleEnglishExplanation || 'Connected';
      const langConfig = getLanguageConfig(merged.targetLanguage || 'bn');

      return {
        success: true,
        provider: merged.aiProvider,
        model: merged.selectedModel || 'default',
        targetLanguage: merged.targetLanguage || 'bn',
        targetLabel: langConfig.targetLabel,
        flagEmoji: langConfig.flagEmoji,
        latencyMs,
        sampleResult: `"${wordRes.selectedText || 'resilient'}": ${meanText}${bText}`
      };
    } catch (err: any) {
      let errorMsg = err?.message || 'Connection test failed.';
      if (typeof errorMsg === 'string' && errorMsg.trim().startsWith('[') && errorMsg.includes('"message"')) {
        try {
          const issues = JSON.parse(errorMsg);
          if (Array.isArray(issues) && issues.length > 0) {
            errorMsg = `AI response schema validation failed: ${issues.map((i: any) => `${i.path?.join('.') || 'field'}: ${i.message}`).join('; ')}`;
          }
        } catch {
          // keep original errorMsg
        }
      }
      return {
        success: false,
        provider: customSettings?.aiProvider || 'unknown',
        model: customSettings?.selectedModel || 'unknown',
        latencyMs: Date.now() - start,
        error: errorMsg
      };
    }
  }
}

export * from './types';
export * from './schemas';
export * from './mockProvider';
export * from './geminiProvider';
export * from './openaiProvider';
export * from './anthropicProvider';
export * from './ollamaProvider';
export * from './cloudProvider';
export * from './safeJson';
