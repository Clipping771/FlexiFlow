import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isUrlDisabled, updateBadgeForTab, updateAllTabBadges, setupBadgeListeners } from '../badgeService';

describe('badgeService: Extension action OFF badge management', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('isUrlDisabled', () => {
    it('returns true when isGloballyPaused is true', () => {
      expect(isUrlDisabled('https://en.wikipedia.org/wiki/AI', [], true)).toBe(true);
      expect(isUrlDisabled(undefined, [], true)).toBe(true);
    });

    it('returns true when current site domain is in disabledSites', () => {
      const disabledSites = ['nytimes.com', 'facebook.com'];
      expect(isUrlDisabled('https://nytimes.com/world', disabledSites)).toBe(true);
      expect(isUrlDisabled('https://www.nytimes.com/tech', disabledSites)).toBe(true);
      expect(isUrlDisabled('https://m.facebook.com/home', disabledSites)).toBe(true);
    });

    it('returns false when current site is not in disabledSites', () => {
      const disabledSites = ['nytimes.com'];
      expect(isUrlDisabled('https://bbc.com/news', disabledSites)).toBe(false);
      expect(isUrlDisabled('https://google.com', disabledSites)).toBe(false);
    });

    it('returns false for non-http/https or invalid URLs', () => {
      expect(isUrlDisabled('chrome://extensions', ['extensions'])).toBe(false);
      expect(isUrlDisabled('about:blank', ['blank'])).toBe(false);
      expect(isUrlDisabled('', ['test.com'])).toBe(false);
      expect(isUrlDisabled(undefined, ['test.com'])).toBe(false);
    });
  });

  describe('updateBadgeForTab', () => {
    it('sets red OFF badge when site is paused/disabled', async () => {
      const setBadgeTextMock = vi.fn().mockResolvedValue(undefined);
      const setBadgeBgMock = vi.fn().mockResolvedValue(undefined);
      const setBadgeTextColorMock = vi.fn().mockResolvedValue(undefined);

      (global as any).chrome = {
        action: {
          setBadgeText: setBadgeTextMock,
          setBadgeBackgroundColor: setBadgeBgMock,
          setBadgeTextColor: setBadgeTextColorMock
        }
      };

      await updateBadgeForTab(101, 'https://paused-site.com', {
        disabledSites: ['paused-site.com']
      } as any);

      expect(setBadgeTextMock).toHaveBeenCalledWith({ tabId: 101, text: 'OFF' });
      expect(setBadgeBgMock).toHaveBeenCalledWith({ tabId: 101, color: '#EF4444' });
      expect(setBadgeTextColorMock).toHaveBeenCalledWith({ tabId: 101, color: '#FFFFFF' });
    });

    it('clears badge when site is enabled', async () => {
      const setBadgeTextMock = vi.fn().mockResolvedValue(undefined);

      (global as any).chrome = {
        action: {
          setBadgeText: setBadgeTextMock
        }
      };

      await updateBadgeForTab(102, 'https://active-site.com', {
        disabledSites: ['other-site.com']
      } as any);

      expect(setBadgeTextMock).toHaveBeenCalledWith({ tabId: 102, text: '' });
    });
  });

  describe('updateAllTabBadges', () => {
    it('iterates through all tabs and updates each tab badge', async () => {
      const setBadgeTextMock = vi.fn().mockResolvedValue(undefined);
      const setBadgeBgMock = vi.fn().mockResolvedValue(undefined);

      (global as any).chrome = {
        action: {
          setBadgeText: setBadgeTextMock,
          setBadgeBackgroundColor: setBadgeBgMock
        },
        tabs: {
          query: vi.fn().mockResolvedValue([
            { id: 1, url: 'https://siteA.com' },
            { id: 2, url: 'https://siteB.com' }
          ])
        }
      };

      await updateAllTabBadges({
        disabledSites: ['sitea.com']
      } as any);

      expect(setBadgeTextMock).toHaveBeenCalledWith({ tabId: 1, text: 'OFF' });
      expect(setBadgeTextMock).toHaveBeenCalledWith({ tabId: 2, text: '' });
    });
  });

  describe('setupBadgeListeners', () => {
    it('attaches onUpdated, onActivated, and storage onChanged listeners', () => {
      const onUpdatedAddListener = vi.fn();
      const onActivatedAddListener = vi.fn();
      const onChangedAddListener = vi.fn();

      (global as any).chrome = {
        tabs: {
          onUpdated: { addListener: onUpdatedAddListener },
          onActivated: { addListener: onActivatedAddListener }
        },
        storage: {
          onChanged: { addListener: onChangedAddListener }
        }
      };

      setupBadgeListeners();

      expect(onUpdatedAddListener).toHaveBeenCalledTimes(1);
      expect(onActivatedAddListener).toHaveBeenCalledTimes(1);
      expect(onChangedAddListener).toHaveBeenCalledTimes(1);
    });
  });
});
