import { UserSettings } from '../../types';

export const DEFAULT_SETTINGS: UserSettings = {
  triggerMode: 'auto_selection',
  autoAnalyzeOnSelection: true,
  autoPronounce: false,
  showBengaliByDefault: true,
  theme: 'dark',
  aiProvider: 'mock',
  selectedModel: 'gemini-2.0-flash',
  dailyNewLimit: 10,
  dailyReviewLimit: 30,
  popupSize: 'medium',
  targetLanguage: 'bn',
  customLanguages: [],
  disabledSites: [],
  isGloballyPaused: false,
  highlightModeEnabled: true,
  highlightColor: 'yellow',
  highlightFilters: {
    words: true,
    phrases: true,
    idioms: true
  },
  readingMode: 'quick'
};

const SETTINGS_KEY = 'lexiflow_user_settings';

/**
 * Returns true if running within a content script context on an external web page.
 * Crucial rule: In content scripts, localStorage belongs to the host webpage.
 * Accessing or mutating host localStorage can pollute the page or leak data.
 */
function isContentScriptEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    typeof chrome !== 'undefined' &&
    Boolean(chrome.runtime?.id) &&
    typeof window.location !== 'undefined' &&
    window.location.protocol !== 'chrome-extension:'
  );
}

export class SettingsService {
  static async getSettings(): Promise<UserSettings> {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return new Promise((resolve) => {
        chrome.storage.local.get([SETTINGS_KEY], (result) => {
          if (result && result[SETTINGS_KEY]) {
            const raw = { ...DEFAULT_SETTINGS, ...result[SETTINGS_KEY] };
            if (raw.selectedModel === 'gemini-1.5-flash' || (raw.aiProvider === 'gemini' && !raw.selectedModel)) {
              raw.selectedModel = 'gemini-2.0-flash';
            }
            raw.customLanguages = Array.isArray(raw.customLanguages) ? raw.customLanguages : [];
            raw.disabledSites = Array.isArray(raw.disabledSites) ? raw.disabledSites : [];
            raw.readingMode = raw.readingMode === 'learn' ? 'learn' : 'quick';
            resolve(raw);
          } else {
            resolve(DEFAULT_SETTINGS);
          }
        });
      });
    }

    // Never use localStorage fallback in the content-script path (host page's storage)
    if (isContentScriptEnvironment()) {
      return DEFAULT_SETTINGS;
    }

    // LocalStorage fallback for tests / extension pages without chrome.storage
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) {
        const raw = { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
        if (raw.selectedModel === 'gemini-1.5-flash' || (raw.aiProvider === 'gemini' && !raw.selectedModel)) {
          raw.selectedModel = 'gemini-2.0-flash';
        }
        raw.customLanguages = Array.isArray(raw.customLanguages) ? raw.customLanguages : [];
        raw.disabledSites = Array.isArray(raw.disabledSites) ? raw.disabledSites : [];
        raw.readingMode = raw.readingMode === 'learn' ? 'learn' : 'quick';
        return raw;
      }
    } catch {
      // ignore
    }
    return DEFAULT_SETTINGS;
  }

  static async updateSettings(updates: Partial<UserSettings>): Promise<UserSettings> {
    const current = await this.getSettings();
    const updated: UserSettings = { ...current, ...updates };

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await new Promise<void>((resolve) => {
        chrome.storage.local.set({ [SETTINGS_KEY]: updated }, () => resolve());
      });
    } else if (!isContentScriptEnvironment()) {
      // Only write to localStorage in extension pages or test environments
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
      } catch {
        // ignore
      }
    }

    return updated;
  }
}
