import { describe, it, expect, beforeEach } from 'vitest';
import {
  getLanguageConfig,
  getAllLanguages,
  isLanguagePairSupported,
  registerCustomLanguage,
  registerCustomLanguages,
  unregisterCustomLanguage,
  createCustomLanguageConfig,
  SUPPORTED_PAIRS,
  DEFAULT_LANGUAGE_PAIR
} from '../languages';
import { SettingsService } from '../../services/storage/settings';

describe('Multilingual Architecture & Custom Language Studio', () => {
  beforeEach(() => {
    registerCustomLanguages([]); // reset custom registry
  });

  it('supports 30+ pre-configured global languages', () => {
    const keys = Object.keys(SUPPORTED_PAIRS);
    expect(keys.length).toBeGreaterThanOrEqual(30);

    // Verify key world languages
    expect(SUPPORTED_PAIRS['en-bn'].targetLabel).toBe('Bengali');
    expect(SUPPORTED_PAIRS['en-hi'].targetLabel).toBe('Hindi');
    expect(SUPPORTED_PAIRS['en-es'].targetLabel).toBe('Spanish');
    expect(SUPPORTED_PAIRS['en-fr'].targetLabel).toBe('French');
    expect(SUPPORTED_PAIRS['en-de'].targetLabel).toBe('German');
    expect(SUPPORTED_PAIRS['en-tr'].targetLabel).toBe('Turkish');
    expect(SUPPORTED_PAIRS['en-tr'].targetNativeHeader).toBe('Kolay Türkçe');
    expect(SUPPORTED_PAIRS['en-pt'].targetLabel).toBe('Portuguese');
    expect(SUPPORTED_PAIRS['en-ru'].targetLabel).toBe('Russian');
    expect(SUPPORTED_PAIRS['en-ko'].targetLabel).toBe('Korean');
    expect(SUPPORTED_PAIRS['en-ja'].targetLabel).toBe('Japanese');
  });

  it('correctly creates a custom language config with smart defaults', () => {
    const custom = createCustomLanguageConfig({
      code: 'sw',
      name: 'Swahili'
    });

    expect(custom.code).toBe('sw');
    expect(custom.name).toBe('Swahili');
    expect(custom.nativeName).toBe('Swahili');
    expect(custom.nativeHeader).toBe('Easy Swahili');
    expect(custom.flagEmoji).toBe('🌐');
    expect(custom.promptTutorRole).toContain('Swahili');
    expect(custom.promptTargetInstruction).toContain('Swahili');
  });

  it('registers and retrieves custom languages dynamically', () => {
    const turkishCustom = createCustomLanguageConfig({
      code: 'tr-custom',
      name: 'Turkish Custom',
      nativeName: 'Türkçe Özel',
      nativeHeader: 'Kolay Türkçe Özel',
      flagEmoji: '🇹🇷',
      promptTutorRole: 'elite Turkish educator for ESL readers',
      promptTargetInstruction: 'Write clear explanation in Turkish.'
    });

    registerCustomLanguage(turkishCustom);

    const config = getLanguageConfig('tr-custom');
    expect(config.targetLang).toBe('tr-custom');
    expect(config.targetLabel).toBe('Turkish Custom');
    expect(config.targetNativeLabel).toBe('Türkçe Özel');
    expect(config.targetNativeHeader).toBe('Kolay Türkçe Özel');
    expect(config.flagEmoji).toBe('🇹🇷');
    expect(config.promptTutorRole).toBe('elite Turkish educator for ESL readers');
    expect(config.isCustom).toBe(true);
  });

  it('checks isLanguagePairSupported for built-in and custom languages', () => {
    expect(isLanguagePairSupported('es')).toBe(true);
    expect(isLanguagePairSupported('bn')).toBe(true);
    expect(isLanguagePairSupported('unknown_xyz')).toBe(false);

    const esperanto = createCustomLanguageConfig({ code: 'eo', name: 'Esperanto' });
    registerCustomLanguage(esperanto);
    expect(isLanguagePairSupported('eo')).toBe(true);

    unregisterCustomLanguage('eo');
    expect(isLanguagePairSupported('eo')).toBe(false);
  });

  it('getAllLanguages returns custom languages prioritized before built-ins', () => {
    const sylheti = createCustomLanguageConfig({
      code: 'syl',
      name: 'Sylheti',
      nativeName: 'ছিলটী',
      flagEmoji: '🇧🇩'
    });

    const all = getAllLanguages([sylheti]);
    expect(all[0].targetLang).toBe('syl');
    expect(all[0].isCustom).toBe(true);
    expect(all.length).toBeGreaterThan(30);
  });

  it('dynamically constructs fallback config for arbitrary unknown codes without crashing', () => {
    const arbitrary = getLanguageConfig('klingon');
    expect(arbitrary.targetLang).toBe('klingon');
    expect(arbitrary.targetLabel).toBe('Klingon');
    expect(arbitrary.targetNativeHeader).toBe('Easy Klingon');
    expect(arbitrary.isCustom).toBe(true);
  });

  it('persists and loads custom languages via SettingsService', async () => {
    const custom = createCustomLanguageConfig({
      code: 'lat',
      name: 'Latin',
      nativeName: 'Latina',
      flagEmoji: '🏛️'
    });

    await SettingsService.updateSettings({
      targetLanguage: 'lat',
      customLanguages: [custom]
    });

    const loaded = await SettingsService.getSettings();
    expect(loaded.targetLanguage).toBe('lat');
    expect(loaded.customLanguages?.length).toBe(1);
    expect(loaded.customLanguages?.[0].code).toBe('lat');
    expect(loaded.customLanguages?.[0].name).toBe('Latin');
  });
});
