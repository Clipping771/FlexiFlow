import { UserSettings, StageAExplanation, StageBDetailedVocabulary, SelectionType, LinguisticAnalysisResult } from '../../types';
import { SettingsService } from '../storage/settings';
import { registerCustomLanguages, getLanguageConfig } from '../../config/languages';
import { AnthropicProvider } from './anthropicProvider';
import { GeminiProvider } from './geminiProvider';
import { MockAIProvider } from './mockProvider';
import { OllamaProvider } from './ollamaProvider';
import { OpenAIProvider } from './openaiProvider';
import { TwoStageCacheService } from './cache';
import { CacheManager } from '../cache';
import { hashString } from '../cache/normalization';
import { AIProvider } from './types';

export class AIService {
  private static cache = new Map<string, unknown>();
  private static inFlightRequests = new Map<string, Promise<unknown>>();

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
      case 'ollama':
        return new OllamaProvider(
          userSettings.apiEndpoint || 'http://localhost:11434',
          userSettings.selectedModel || 'llama3.2',
          userSettings.targetLanguage || 'bn'
        );
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
      return {
        selectedText: text,
        lemma: text.toLowerCase(),
        partOfSpeech: generic.partOfSpeech || 'word',
        easyEnglish: generic.simpleEnglishExplanation || generic.contextualMeaning || 'Contextual meaning.',
        easyBengali: generic.bengaliTranslation || 'বাংলা অর্থ',
        contextMeaning: generic.contextualMeaning || generic.whyFitsContext || 'Meaning in this context.',
        example: generic.examples?.[0] || contextSentence,
        exampleBengali: 'উদাহরণ বাক্যের অর্থ',
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
            examples: (generic.examples || []).map((e: string) => ({ english: e, bengali: 'উদাহরণ' })),
            synonyms: (generic.synonyms || []).map((s: string) => ({ word: s, easyEnglish: 'Similar word', easyBengali: 'সমার্থক শব্দ' })),
            antonyms: []
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
      return {
        success: false,
        provider: customSettings?.aiProvider || 'unknown',
        model: customSettings?.selectedModel || 'unknown',
        latencyMs: Date.now() - start,
        error: err?.message || 'Connection test failed.'
      };
    }
  }

  static clearCache(): void {
    this.cache.clear();
  }
}

export * from './types';
export * from './schemas';
export * from './mockProvider';
export * from './geminiProvider';
export * from './openaiProvider';
export * from './anthropicProvider';
export * from './ollamaProvider';
export * from './safeJson';
