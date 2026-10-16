import { CustomLanguageConfig } from '../types';

/**
 * Language Configuration Architecture.
 * Establishes a clean, centralized, and extensible interface for source and target language pairs.
 * Supports:
 * - 30+ pre-configured global languages with authentic scripts and headers
 * - Dynamic custom user-defined languages with custom LLM prompts and emojis
 * - Dynamic runtime fallback so no unknown language code ever crashes the application
 */

export interface LanguagePairConfig {
  sourceLang: string;          // ISO 639-1 code: 'en'
  targetLang: string;          // ISO 639-1 code: 'bn', 'es', etc.
  sourceLabel: string;         // 'English'
  targetLabel: string;         // 'Bengali'
  targetNativeLabel: string;   // 'বাংলা'
  targetNativeHeader: string;  // 'সহজ বাংলা'
  flagEmoji: string;           // '🇧🇩'
  pairId: string;              // 'en-bn'
  targetScriptRegex?: RegExp;  // Script verification regex if applicable
  promptTutorRole: string;     // Persona for LLM prompts
  promptTargetInstruction: string;
  isCustom?: boolean;          // Whether language was added by user
}

export const SUPPORTED_PAIRS: Record<string, LanguagePairConfig> = {
  'en-bn': {
    sourceLang: 'en',
    targetLang: 'bn',
    sourceLabel: 'English',
    targetLabel: 'Bengali',
    targetNativeLabel: 'বাংলা',
    targetNativeHeader: 'সহজ বাংলা',
    flagEmoji: '🇧🇩',
    pairId: 'en-bn',
    targetScriptRegex: /[\u0980-\u09FF]/,
    promptTutorRole: 'elite bilingual linguistic tutor specializing in immediate reading comprehension for ESL Bengali speakers',
    promptTargetInstruction: 'Natural, easy Bengali explanation written in Bengali script (বাংলা বর্ণমালা).'
  },
  'en-hi': {
    sourceLang: 'en',
    targetLang: 'hi',
    sourceLabel: 'English',
    targetLabel: 'Hindi',
    targetNativeLabel: 'हिन्दी',
    targetNativeHeader: 'सरल हिन्दी',
    flagEmoji: '🇮🇳',
    pairId: 'en-hi',
    targetScriptRegex: /[\u0900-\u097F]/,
    promptTutorRole: 'elite bilingual linguistic tutor specializing in immediate reading comprehension for ESL Hindi speakers',
    promptTargetInstruction: 'Natural, easy Hindi explanation written in Devanagari script (देवनागरी लिपि).'
  },
  'en-es': {
    sourceLang: 'en',
    targetLang: 'es',
    sourceLabel: 'English',
    targetLabel: 'Spanish',
    targetNativeLabel: 'Español',
    targetNativeHeader: 'Español fácil',
    flagEmoji: '🇪🇸',
    pairId: 'en-es',
    promptTutorRole: 'elite bilingual linguistic tutor specializing in immediate reading comprehension for ESL Spanish speakers',
    promptTargetInstruction: 'Natural, clear Spanish explanation written in modern conversational Spanish.'
  },
  'en-fr': {
    sourceLang: 'en',
    targetLang: 'fr',
    sourceLabel: 'English',
    targetLabel: 'French',
    targetNativeLabel: 'Français',
    targetNativeHeader: 'Français facile',
    flagEmoji: '🇫🇷',
    pairId: 'en-fr',
    promptTutorRole: 'elite bilingual linguistic tutor specializing in immediate reading comprehension for ESL French speakers',
    promptTargetInstruction: 'Natural, clear French explanation written in modern everyday French.'
  },
  'en-de': {
    sourceLang: 'en',
    targetLang: 'de',
    sourceLabel: 'English',
    targetLabel: 'German',
    targetNativeLabel: 'Deutsch',
    targetNativeHeader: 'Einfaches Deutsch',
    flagEmoji: '🇩🇪',
    pairId: 'en-de',
    promptTutorRole: 'elite bilingual linguistic tutor specializing in immediate reading comprehension for ESL German speakers',
    promptTargetInstruction: 'Natural, clear German explanation written in modern everyday German.'
  },
  'en-ar': {
    sourceLang: 'en',
    targetLang: 'ar',
    sourceLabel: 'English',
    targetLabel: 'Arabic',
    targetNativeLabel: 'العربية',
    targetNativeHeader: 'العربية المبسطة',
    flagEmoji: '🇸🇦',
    pairId: 'en-ar',
    targetScriptRegex: /[\u0600-\u06FF]/,
    promptTutorRole: 'elite bilingual linguistic tutor specializing in immediate reading comprehension for ESL Arabic speakers',
    promptTargetInstruction: 'Natural, clear Arabic explanation written in modern standard Arabic.'
  },
  'en-zh': {
    sourceLang: 'en',
    targetLang: 'zh',
    sourceLabel: 'English',
    targetLabel: 'Chinese',
    targetNativeLabel: '中文',
    targetNativeHeader: '简明中文',
    flagEmoji: '🇨🇳',
    pairId: 'en-zh',
    targetScriptRegex: /[\u4E00-\u9FFF]/,
    promptTutorRole: 'elite bilingual linguistic tutor specializing in immediate reading comprehension for ESL Chinese speakers',
    promptTargetInstruction: 'Natural, clear Chinese explanation written in Simplified Chinese.'
  },
  'en-ja': {
    sourceLang: 'en',
    targetLang: 'ja',
    sourceLabel: 'English',
    targetLabel: 'Japanese',
    targetNativeLabel: '日本語',
    targetNativeHeader: 'やさしい日本語',
    flagEmoji: '🇯🇵',
    pairId: 'en-ja',
    targetScriptRegex: /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/,
    promptTutorRole: 'elite bilingual linguistic tutor specializing in immediate reading comprehension for ESL Japanese speakers',
    promptTargetInstruction: 'Natural, clear Japanese explanation written in natural Japanese with simple kanji where appropriate.'
  },
  'en-ur': {
    sourceLang: 'en',
    targetLang: 'ur',
    sourceLabel: 'English',
    targetLabel: 'Urdu',
    targetNativeLabel: 'اردو',
    targetNativeHeader: 'آسان اردو',
    flagEmoji: '🇵🇰',
    pairId: 'en-ur',
    targetScriptRegex: /[\u0600-\u06FF]/,
    promptTutorRole: 'elite bilingual linguistic tutor specializing in immediate reading comprehension for ESL Urdu speakers',
    promptTargetInstruction: 'Natural, easy Urdu explanation written in Urdu script.'
  },
  'en-pt': {
    sourceLang: 'en',
    targetLang: 'pt',
    sourceLabel: 'English',
    targetLabel: 'Portuguese',
    targetNativeLabel: 'Português',
    targetNativeHeader: 'Português simples',
    flagEmoji: '🇧🇷',
    pairId: 'en-pt',
    promptTutorRole: 'elite bilingual linguistic tutor specializing in immediate reading comprehension for ESL Portuguese speakers',
    promptTargetInstruction: 'Natural, clear Portuguese explanation written in modern conversational Portuguese.'
  },
  'en-ru': {
    sourceLang: 'en',
    targetLang: 'ru',
    sourceLabel: 'English',
    targetLabel: 'Russian',
    targetNativeLabel: 'Русский',
    targetNativeHeader: 'Простой русский',
    flagEmoji: '🇷🇺',
    pairId: 'en-ru',
    targetScriptRegex: /[\u0400-\u04FF]/,
    promptTutorRole: 'elite bilingual linguistic tutor specializing in immediate reading comprehension for ESL Russian speakers',
    promptTargetInstruction: 'Natural, clear Russian explanation written in Cyrillic script.'
  },
  'en-it': {
    sourceLang: 'en',
    targetLang: 'it',
    sourceLabel: 'English',
    targetLabel: 'Italian',
    targetNativeLabel: 'Italiano',
    targetNativeHeader: 'Italiano semplice',
    flagEmoji: '🇮🇹',
    pairId: 'en-it',
    promptTutorRole: 'elite bilingual linguistic tutor specializing in immediate reading comprehension for ESL Italian speakers',
    promptTargetInstruction: 'Natural, clear Italian explanation written in modern conversational Italian.'
  },
  'en-tr': {
    sourceLang: 'en',
    targetLang: 'tr',
    sourceLabel: 'English',
    targetLabel: 'Turkish',
    targetNativeLabel: 'Türkçe',
    targetNativeHeader: 'Kolay Türkçe',
    flagEmoji: '🇹🇷',
    pairId: 'en-tr',
    promptTutorRole: 'elite bilingual linguistic tutor specializing in immediate reading comprehension for ESL Turkish speakers',
    promptTargetInstruction: 'Natural, easy Turkish explanation written in modern conversational Turkish.'
  },
  'en-ko': {
    sourceLang: 'en',
    targetLang: 'ko',
    sourceLabel: 'English',
    targetLabel: 'Korean',
    targetNativeLabel: '한국어',
    targetNativeHeader: '쉬운 한국어',
    flagEmoji: '🇰🇷',
    pairId: 'en-ko',
    targetScriptRegex: /[\uAC00-\uD7AF\u1100-\u11FF]/,
    promptTutorRole: 'elite bilingual linguistic tutor specializing in immediate reading comprehension for ESL Korean speakers',
    promptTargetInstruction: 'Natural, clear Korean explanation written in Hangul script.'
  },
  'en-id': {
    sourceLang: 'en',
    targetLang: 'id',
    sourceLabel: 'English',
    targetLabel: 'Indonesian',
    targetNativeLabel: 'Bahasa Indonesia',
    targetNativeHeader: 'Bahasa Indonesia mudah',
    flagEmoji: '🇮🇩',
    pairId: 'en-id',
    promptTutorRole: 'elite bilingual linguistic tutor specializing in immediate reading comprehension for ESL Indonesian speakers',
    promptTargetInstruction: 'Natural, clear Indonesian explanation written in everyday Bahasa Indonesia.'
  },
  'en-vi': {
    sourceLang: 'en',
    targetLang: 'vi',
    sourceLabel: 'English',
    targetLabel: 'Vietnamese',
    targetNativeLabel: 'Tiếng Việt',
    targetNativeHeader: 'Tiếng Việt dễ hiểu',
    flagEmoji: '🇻🇳',
    pairId: 'en-vi',
    promptTutorRole: 'elite bilingual linguistic tutor specializing in immediate reading comprehension for ESL Vietnamese speakers',
    promptTargetInstruction: 'Natural, clear Vietnamese explanation written in standard Vietnamese.'
  },
  'en-nl': {
    sourceLang: 'en',
    targetLang: 'nl',
    sourceLabel: 'English',
    targetLabel: 'Dutch',
    targetNativeLabel: 'Nederlands',
    targetNativeHeader: 'Eenvoudig Nederlands',
    flagEmoji: '🇳🇱',
    pairId: 'en-nl',
    promptTutorRole: 'elite bilingual linguistic tutor specializing in immediate reading comprehension for ESL Dutch speakers',
    promptTargetInstruction: 'Natural, clear Dutch explanation written in modern conversational Dutch.'
  },
  'en-pl': {
    sourceLang: 'en',
    targetLang: 'pl',
    sourceLabel: 'English',
    targetLabel: 'Polish',
    targetNativeLabel: 'Polski',
    targetNativeHeader: 'Prosty polski',
    flagEmoji: '🇵🇱',
    pairId: 'en-pl',
    promptTutorRole: 'elite bilingual linguistic tutor specializing in immediate reading comprehension for ESL Polish speakers',
    promptTargetInstruction: 'Natural, clear Polish explanation written in modern conversational Polish.'
  },
  'en-fa': {
    sourceLang: 'en',
    targetLang: 'fa',
    sourceLabel: 'English',
    targetLabel: 'Persian',
    targetNativeLabel: 'فارسی',
    targetNativeHeader: 'فارسی روان',
    flagEmoji: '🇮🇷',
    pairId: 'en-fa',
    targetScriptRegex: /[\u0600-\u06FF]/,
    promptTutorRole: 'elite bilingual linguistic tutor specializing in immediate reading comprehension for ESL Persian speakers',
    promptTargetInstruction: 'Natural, clear Persian explanation written in Persian script.'
  },
  'en-th': {
    sourceLang: 'en',
    targetLang: 'th',
    sourceLabel: 'English',
    targetLabel: 'Thai',
    targetNativeLabel: 'ภาษาไทย',
    targetNativeHeader: 'ภาษาไทยเข้าใจง่าย',
    flagEmoji: '🇹🇭',
    pairId: 'en-th',
    targetScriptRegex: /[\u0E00-\u0E7F]/,
    promptTutorRole: 'elite bilingual linguistic tutor specializing in immediate reading comprehension for ESL Thai speakers',
    promptTargetInstruction: 'Natural, clear Thai explanation written in Thai script.'
  },
  'en-el': {
    sourceLang: 'en',
    targetLang: 'el',
    sourceLabel: 'English',
    targetLabel: 'Greek',
    targetNativeLabel: 'Ελληνικά',
    targetNativeHeader: 'Απλά Ελληνικά',
    flagEmoji: '🇬🇷',
    pairId: 'en-el',
    targetScriptRegex: /[\u0370-\u03FF]/,
    promptTutorRole: 'elite bilingual linguistic tutor specializing in immediate reading comprehension for ESL Greek speakers',
    promptTargetInstruction: 'Natural, clear Greek explanation written in modern Greek script.'
  },
  'en-sv': {
    sourceLang: 'en',
    targetLang: 'sv',
    sourceLabel: 'English',
    targetLabel: 'Swedish',
    targetNativeLabel: 'Svenska',
    targetNativeHeader: 'Enkel svenska',
    flagEmoji: '🇸🇪',
    pairId: 'en-sv',
    promptTutorRole: 'elite bilingual linguistic tutor specializing in immediate reading comprehension for ESL Swedish speakers',
    promptTargetInstruction: 'Natural, clear Swedish explanation written in modern conversational Swedish.'
  },
  'en-uk': {
    sourceLang: 'en',
    targetLang: 'uk',
    sourceLabel: 'English',
    targetLabel: 'Ukrainian',
    targetNativeLabel: 'Українська',
    targetNativeHeader: 'Проста українська',
    flagEmoji: '🇺🇦',
    pairId: 'en-uk',
    targetScriptRegex: /[\u0400-\u04FF]/,
    promptTutorRole: 'elite bilingual linguistic tutor specializing in immediate reading comprehension for ESL Ukrainian speakers',
    promptTargetInstruction: 'Natural, clear Ukrainian explanation written in Ukrainian Cyrillic.'
  },
  'en-ms': {
    sourceLang: 'en',
    targetLang: 'ms',
    sourceLabel: 'English',
    targetLabel: 'Malay',
    targetNativeLabel: 'Bahasa Melayu',
    targetNativeHeader: 'Bahasa Melayu mudah',
    flagEmoji: '🇲🇾',
    pairId: 'en-ms',
    promptTutorRole: 'elite bilingual linguistic tutor specializing in immediate reading comprehension for ESL Malay speakers',
    promptTargetInstruction: 'Natural, clear Malay explanation written in modern Bahasa Melayu.'
  },
  'en-tl': {
    sourceLang: 'en',
    targetLang: 'tl',
    sourceLabel: 'English',
    targetLabel: 'Tagalog',
    targetNativeLabel: 'Tagalog',
    targetNativeHeader: 'Simpleng Tagalog',
    flagEmoji: '🇵🇭',
    pairId: 'en-tl',
    promptTutorRole: 'elite bilingual linguistic tutor specializing in immediate reading comprehension for ESL Tagalog speakers',
    promptTargetInstruction: 'Natural, clear Tagalog explanation written in conversational Tagalog.'
  },
  'en-sw': {
    sourceLang: 'en',
    targetLang: 'sw',
    sourceLabel: 'English',
    targetLabel: 'Swahili',
    targetNativeLabel: 'Kiswahili',
    targetNativeHeader: 'Kiswahili rahisi',
    flagEmoji: '🇰🇪',
    pairId: 'en-sw',
    promptTutorRole: 'elite bilingual linguistic tutor specializing in immediate reading comprehension for ESL Swahili speakers',
    promptTargetInstruction: 'Natural, clear Swahili explanation written in conversational Kiswahili.'
  },
  'en-ta': {
    sourceLang: 'en',
    targetLang: 'ta',
    sourceLabel: 'English',
    targetLabel: 'Tamil',
    targetNativeLabel: 'தமிழ்',
    targetNativeHeader: 'எளிய தமிழ்',
    flagEmoji: '🇮🇳',
    pairId: 'en-ta',
    targetScriptRegex: /[\u0B80-\u0BFF]/,
    promptTutorRole: 'elite bilingual linguistic tutor specializing in immediate reading comprehension for ESL Tamil speakers',
    promptTargetInstruction: 'Natural, clear Tamil explanation written in Tamil script.'
  },
  'en-te': {
    sourceLang: 'en',
    targetLang: 'te',
    sourceLabel: 'English',
    targetLabel: 'Telugu',
    targetNativeLabel: 'తెలుగు',
    targetNativeHeader: 'సరళమైన తెలుగు',
    flagEmoji: '🇮🇳',
    pairId: 'en-te',
    targetScriptRegex: /[\u0C00-\u0C7F]/,
    promptTutorRole: 'elite bilingual linguistic tutor specializing in immediate reading comprehension for ESL Telugu speakers',
    promptTargetInstruction: 'Natural, clear Telugu explanation written in Telugu script.'
  },
  'en-gu': {
    sourceLang: 'en',
    targetLang: 'gu',
    sourceLabel: 'English',
    targetLabel: 'Gujarati',
    targetNativeLabel: 'ગુજરાતી',
    targetNativeHeader: 'સરળ ગુજરાતી',
    flagEmoji: '🇮🇳',
    pairId: 'en-gu',
    targetScriptRegex: /[\u0A80-\u0AFF]/,
    promptTutorRole: 'elite bilingual linguistic tutor specializing in immediate reading comprehension for ESL Gujarati speakers',
    promptTargetInstruction: 'Natural, clear Gujarati explanation written in Gujarati script.'
  },
  'en-mr': {
    sourceLang: 'en',
    targetLang: 'mr',
    sourceLabel: 'English',
    targetLabel: 'Marathi',
    targetNativeLabel: 'मराठी',
    targetNativeHeader: 'सोपे मराठी',
    flagEmoji: '🇮🇳',
    pairId: 'en-mr',
    targetScriptRegex: /[\u0900-\u097F]/,
    promptTutorRole: 'elite bilingual linguistic tutor specializing in immediate reading comprehension for ESL Marathi speakers',
    promptTargetInstruction: 'Natural, clear Marathi explanation written in Devanagari script.'
  },
  'en-pa': {
    sourceLang: 'en',
    targetLang: 'pa',
    sourceLabel: 'English',
    targetLabel: 'Punjabi',
    targetNativeLabel: 'ਪੰਜਾਬੀ',
    targetNativeHeader: 'ਸਰਲ ਪੰਜਾਬੀ',
    flagEmoji: '🇮🇳',
    pairId: 'en-pa',
    targetScriptRegex: /[\u0A00-\u0A7F]/,
    promptTutorRole: 'elite bilingual linguistic tutor specializing in immediate reading comprehension for ESL Punjabi speakers',
    promptTargetInstruction: 'Natural, clear Punjabi explanation written in Gurmukhi script.'
  }
};

export const DEFAULT_LANGUAGE_PAIR = SUPPORTED_PAIRS['en-bn'];

// Dynamic In-Memory Registry for User-Created Custom Languages
const customLanguageRegistry = new Map<string, LanguagePairConfig>();

/**
 * Converts a CustomLanguageConfig into a full LanguagePairConfig.
 */
export function customToLanguagePair(custom: CustomLanguageConfig): LanguagePairConfig {
  const cleanCode = (custom.code || 'custom').toLowerCase().trim();
  const pairId = cleanCode.startsWith('en-') ? cleanCode : `en-${cleanCode}`;
  const targetCode = cleanCode.startsWith('en-') ? cleanCode.replace(/^en-/, '') : cleanCode;
  const name = custom.name?.trim() || cleanCode.toUpperCase();
  const nativeName = custom.nativeName?.trim() || name;
  const nativeHeader = custom.nativeHeader?.trim() || `Easy ${name}`;
  const emoji = custom.flagEmoji?.trim() || '🌐';

  return {
    sourceLang: 'en',
    targetLang: targetCode,
    sourceLabel: 'English',
    targetLabel: name,
    targetNativeLabel: nativeName,
    targetNativeHeader: nativeHeader,
    flagEmoji: emoji,
    pairId,
    promptTutorRole:
      custom.promptTutorRole?.trim() ||
      `elite bilingual linguistic tutor specializing in immediate reading comprehension for ESL ${name} speakers`,
    promptTargetInstruction:
      custom.promptTargetInstruction?.trim() ||
      `Natural, clear, everyday ${name} explanation written in ${nativeName}.`,
    isCustom: true
  };
}

/**
 * Registers a user-defined custom language into the runtime registry.
 */
export function registerCustomLanguage(custom: CustomLanguageConfig): LanguagePairConfig {
  const config = customToLanguagePair(custom);
  customLanguageRegistry.set(config.pairId, config);
  customLanguageRegistry.set(config.targetLang, config);
  return config;
}

/**
 * Registers multiple custom languages at once (e.g. from user settings).
 */
export function registerCustomLanguages(customs?: CustomLanguageConfig[]): void {
  if (!Array.isArray(customs)) return;
  customLanguageRegistry.clear();
  for (const c of customs) {
    registerCustomLanguage(c);
  }
}

/**
 * Unregisters a custom language by code or pairId.
 */
export function unregisterCustomLanguage(codeOrPairId: string): void {
  const clean = (codeOrPairId || '').toLowerCase().trim();
  const pairId = clean.startsWith('en-') ? clean : `en-${clean}`;
  const code = clean.startsWith('en-') ? clean.replace(/^en-/, '') : clean;
  customLanguageRegistry.delete(pairId);
  customLanguageRegistry.delete(code);
}

/**
 * Returns configuration for a specified language code or pair identifier.
 * Priority order:
 * 1. Matching item in explicit custom list (if passed)
 * 2. Matching item in registered custom languages registry
 * 3. Pre-configured built-in language pair
 * 4. Dynamic on-the-fly generated LanguagePairConfig (guarantees zero crashes and valid prompt)
 */
export function getLanguageConfig(
  targetLangOrPairId: string = 'bn',
  customs?: CustomLanguageConfig[]
): LanguagePairConfig {
  const clean = (targetLangOrPairId || 'bn').toLowerCase().trim();
  const pairId = clean.startsWith('en-') ? clean : `en-${clean}`;
  const targetCode = clean.startsWith('en-') ? clean.replace(/^en-/, '') : clean;

  // 1. Check passed customs
  if (Array.isArray(customs)) {
    const found = customs.find(
      (c) => c.code.toLowerCase().trim() === targetCode || `en-${c.code.toLowerCase().trim()}` === pairId
    );
    if (found) {
      return customToLanguagePair(found);
    }
  }

  // 2. Check registry
  if (customLanguageRegistry.has(pairId)) {
    return customLanguageRegistry.get(pairId)!;
  }
  if (customLanguageRegistry.has(targetCode)) {
    return customLanguageRegistry.get(targetCode)!;
  }

  // 3. Check built-in pairs
  if (SUPPORTED_PAIRS[pairId]) {
    return SUPPORTED_PAIRS[pairId];
  }

  // 4. Dynamic on-the-fly construction for unknown language codes
  if (targetCode && targetCode !== 'bn' && targetCode !== 'en') {
    const formattedName = targetCode.charAt(0).toUpperCase() + targetCode.slice(1);
    return {
      sourceLang: 'en',
      targetLang: targetCode,
      sourceLabel: 'English',
      targetLabel: formattedName,
      targetNativeLabel: formattedName,
      targetNativeHeader: `Easy ${formattedName}`,
      flagEmoji: '🌐',
      pairId,
      promptTutorRole: `elite bilingual linguistic tutor specializing in immediate reading comprehension for ESL ${formattedName} speakers`,
      promptTargetInstruction: `Natural, clear everyday ${formattedName} explanation.`,
      isCustom: true
    };
  }

  return DEFAULT_LANGUAGE_PAIR;
}

/**
 * Returns whether a given language pair or code is currently supported (built-in or custom).
 */
export function isLanguagePairSupported(
  targetLangOrPairId: string,
  customs?: CustomLanguageConfig[]
): boolean {
  const clean = (targetLangOrPairId || '').toLowerCase().trim();
  const pairId = clean.startsWith('en-') ? clean : `en-${clean}`;
  const targetCode = clean.startsWith('en-') ? clean.replace(/^en-/, '') : clean;

  if (SUPPORTED_PAIRS[pairId]) return true;
  if (customLanguageRegistry.has(pairId) || customLanguageRegistry.has(targetCode)) return true;
  if (Array.isArray(customs)) {
    return customs.some(
      (c) => c.code.toLowerCase().trim() === targetCode || `en-${c.code.toLowerCase().trim()}` === pairId
    );
  }
  return false;
}

/**
 * Returns a list of all available languages (built-in + user custom languages).
 */
export function getAllLanguages(
  customs?: CustomLanguageConfig[]
): Array<LanguagePairConfig & { isCustom?: boolean }> {
  const list: Array<LanguagePairConfig & { isCustom?: boolean }> = [];
  const seen = new Set<string>();

  // Add custom languages first
  if (Array.isArray(customs)) {
    for (const c of customs) {
      const config = customToLanguagePair(c);
      if (!seen.has(config.pairId)) {
        seen.add(config.pairId);
        list.push(config);
      }
    }
  }

  for (const config of customLanguageRegistry.values()) {
    if (!seen.has(config.pairId)) {
      seen.add(config.pairId);
      list.push(config);
    }
  }

  // Add built-ins
  for (const config of Object.values(SUPPORTED_PAIRS)) {
    if (!seen.has(config.pairId)) {
      seen.add(config.pairId);
      list.push(config);
    }
  }

  return list;
}

/**
 * Helper to construct a validated CustomLanguageConfig with sensible auto-defaults.
 */
export function createCustomLanguageConfig(
  data: Partial<CustomLanguageConfig> & { code: string; name: string }
): CustomLanguageConfig {
  const code = data.code.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '');
  const name = data.name.trim();
  const nativeName = data.nativeName?.trim() || name;
  const nativeHeader = data.nativeHeader?.trim() || `Easy ${name}`;
  const flagEmoji = data.flagEmoji?.trim() || '🌐';

  return {
    code,
    name,
    nativeName,
    nativeHeader,
    flagEmoji,
    promptTutorRole:
      data.promptTutorRole?.trim() ||
      `elite bilingual linguistic tutor specializing in immediate reading comprehension for ESL ${name} speakers`,
    promptTargetInstruction:
      data.promptTargetInstruction?.trim() ||
      `Natural, clear, everyday ${name} explanation written in ${nativeName}.`,
    createdAt: data.createdAt || new Date().toISOString()
  };
}
