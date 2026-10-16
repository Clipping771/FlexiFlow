import { UserSettings } from '../types';
import { SettingsService } from '../services/storage/settings';

/**
 * Checks if a given URL is considered paused/disabled based on disabledSites or global pause.
 */
export function isUrlDisabled(
  url?: string,
  disabledSites?: string[],
  isGloballyPaused?: boolean
): boolean {
  if (isGloballyPaused) return true;
  if (!url || !disabledSites || !Array.isArray(disabledSites) || disabledSites.length === 0) {
    return false;
  }

  try {
    const parsed = new URL(url);
    // Ignore internal chrome/edge/about pages
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }

    const host = parsed.hostname.toLowerCase();
    if (!host) return false;

    return disabledSites.some((site) => {
      const s = site.toLowerCase().trim();
      if (!s) return false;
      return host === s || host.endsWith('.' + s);
    });
  } catch {
    return false;
  }
}

/**
 * Updates the action badge for a specific tab.
 * Shows vibrant red 'OFF' when LexiFlow is paused/disabled on this site or globally.
 */
export async function updateBadgeForTab(
  tabId: number,
  url?: string,
  settings?: UserSettings
): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.action) return;

  const currentSettings = settings || (await SettingsService.getSettings());
  const disabled = isUrlDisabled(url, currentSettings.disabledSites, currentSettings.isGloballyPaused);

  try {
    if (disabled) {
      await chrome.action.setBadgeText({ tabId, text: 'OFF' });
      await chrome.action.setBadgeBackgroundColor({ tabId, color: '#EF4444' });
      if ((chrome.action as any).setBadgeTextColor) {
        await (chrome.action as any).setBadgeTextColor({ tabId, color: '#FFFFFF' });
      }
    } else {
      await chrome.action.setBadgeText({ tabId, text: '' });
    }
  } catch {
    // Tab might have navigated or closed, ignore silently
  }
}

/**
 * Updates the action badge across all active browser tabs.
 */
export async function updateAllTabBadges(settings?: UserSettings): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.action) return;

  const currentSettings = settings || (await SettingsService.getSettings());

  try {
    // Set global fallback badge
    if (currentSettings.isGloballyPaused) {
      await chrome.action.setBadgeText({ text: 'OFF' });
      await chrome.action.setBadgeBackgroundColor({ color: '#EF4444' });
      if ((chrome.action as any).setBadgeTextColor) {
        await (chrome.action as any).setBadgeTextColor({ color: '#FFFFFF' });
      }
    } else {
      await chrome.action.setBadgeText({ text: '' });
    }

    if (chrome.tabs && chrome.tabs.query) {
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        if (typeof tab.id === 'number') {
          await updateBadgeForTab(tab.id, tab.url, currentSettings);
        }
      }
    }
  } catch (err) {
    console.warn('[LexiFlow] Failed to update all tab badges:', err);
  }
}

/**
 * Attaches Chrome tab and storage listeners to keep the 'OFF' badge synchronized in real-time.
 */
export function setupBadgeListeners(): void {
  if (typeof chrome === 'undefined') return;

  // 1. Tab updated (navigation, URL change)
  if (chrome.tabs?.onUpdated) {
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      const targetUrl = changeInfo.url || tab?.url;
      if (targetUrl) {
        updateBadgeForTab(tabId, targetUrl);
      }
    });
  }

  // 2. Tab activated (user switches tabs)
  if (chrome.tabs?.onActivated) {
    chrome.tabs.onActivated.addListener((activeInfo) => {
      if (chrome.tabs?.get) {
        chrome.tabs.get(activeInfo.tabId, (tab) => {
          if (chrome.runtime?.lastError || !tab) return;
          updateBadgeForTab(activeInfo.tabId, tab.url);
        });
      }
    });
  }

  // 3. Storage changes (settings updated from popup or dashboard)
  if (chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.lexiflow_user_settings) {
        const newSettings = changes.lexiflow_user_settings.newValue as UserSettings;
        updateAllTabBadges(newSettings);
      }
    });
  }
}
