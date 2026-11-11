import { describe, it, expect } from 'vitest';
import { hostOf, isSiteActive, siteModeOf, toggleSite, LOCAL_FILES, siteLabel } from '../siteAccess';
import { DEFAULT_SETTINGS } from '../../services/storage/settings';
import { cleanArticleText, paragraphsWithOffsets } from '../../services/examContent/articleClean';

describe('Where LexiFlow runs', () => {
  it('is off on every site by default', () => {
    expect(siteModeOf(DEFAULT_SETTINGS)).toBe('off');
    expect(isSiteActive('https://www.thedailystar.net/news', DEFAULT_SETTINGS)).toBe(false);
    expect(isSiteActive('https://en.wikipedia.org/wiki/AI', {})).toBe(false);
  });

  it('runs only on sites the learner turned on (and their subdomains)', () => {
    const s = { siteMode: 'off' as const, enabledSites: ['thedailystar.net'] };
    expect(isSiteActive('https://www.thedailystar.net/news', s)).toBe(true);
    expect(isSiteActive('https://bbc.com/news', s)).toBe(false);
  });

  it('in "on everywhere" mode runs everywhere except paused sites', () => {
    const s = { siteMode: 'on' as const, disabledSites: ['facebook.com'] };
    expect(isSiteActive('https://bbc.com/news', s)).toBe(true);
    expect(isSiteActive('https://m.facebook.com/home', s)).toBe(false);
  });

  it('a global pause wins in both modes', () => {
    expect(isSiteActive('https://bbc.com', { siteMode: 'on', isGloballyPaused: true })).toBe(false);
    expect(isSiteActive('https://bbc.com', { siteMode: 'off', enabledSites: ['bbc.com'], isGloballyPaused: true })).toBe(false);
  });

  it('never runs on browser pages', () => {
    expect(hostOf('chrome://extensions')).toBe('');
    expect(isSiteActive('chrome://extensions', { siteMode: 'on' })).toBe(false);
  });

  it('treats files opened from the computer as one site', () => {
    expect(hostOf('file:///C:/Users/me/notes.html')).toBe(LOCAL_FILES);
    expect(siteLabel(LOCAL_FILES)).toBe('Local files');
    expect(isSiteActive('file:///C:/a.html', { siteMode: 'on' })).toBe(true);
    expect(isSiteActive('file:///C:/a.html', { siteMode: 'off' })).toBe(false);
    expect(toggleSite('file:///C:/a.html', { siteMode: 'off', enabledSites: [] })).toEqual({ enabledSites: [LOCAL_FILES] });
    expect(isSiteActive('file:///D:/b.pdf', { siteMode: 'off', enabledSites: [LOCAL_FILES] })).toBe(true);
  });

  it('toggling flips the right list for the current mode', () => {
    expect(toggleSite('www.bbc.com', { siteMode: 'off', enabledSites: [] })).toEqual({ enabledSites: ['www.bbc.com'] });
    expect(toggleSite('www.bbc.com', { siteMode: 'off', enabledSites: ['bbc.com', 'x.com'] })).toEqual({ enabledSites: ['x.com'] });
    expect(toggleSite('bbc.com', { siteMode: 'on', disabledSites: [] })).toEqual({ disabledSites: ['bbc.com'] });
    expect(toggleSite('bbc.com', { siteMode: 'on', disabledSites: ['bbc.com'] })).toEqual({ disabledSites: [] });
  });
});

describe('Article clean-up', () => {
  const RAW = `Factory owners linked to AL regime fuelling garment unrest: Home minister
Salahuddin says some former MPs, ministers and state ministers are involved; minimum wage board may hold first meeting today
Published : 2 November 2026
•
Updated : 2 November 2026, 13:06
•
NEWS

SHARE
Star Online Report
Salauddin_RMG_Meeting_2Nov.PNG
Photo: Ministry of Home Affairs
Factory owners linked to the Awami League, including former ministers and lawmakers, are among those instigating unrest in the garment sector, Home Minister Salahuddin Ahmed said today.

Some industrialists are certainly involved in instigating unrest, and they had political identities linked to the organisation whose activities are banned, the minister said.

Tap here to add The Daily Star as a trusted source
google-preferred-source-badge
"Some of them were MPs, ministers or state ministers at different times," he added.`;

  it('keeps the story and drops page furniture', () => {
    const clean = cleanArticleText(RAW, 'Factory owners linked to AL regime fuelling garment unrest: Home minister');
    for (const junk of ['Published', 'Updated', 'SHARE', 'NEWS', 'Star Online Report', '.PNG', 'Photo:', 'Tap here', 'google-preferred', '•']) {
      expect(clean).not.toContain(junk);
    }
    expect(clean).toContain('Salahuddin says some former MPs');
    expect(clean).toContain('Factory owners linked to the Awami League');
    expect(clean).toContain('"Some of them were MPs, ministers or state ministers at different times," he added.');
    expect(clean.split('\n\n')).toHaveLength(4);
  });

  it('leaves a clean article untouched', () => {
    const text = 'Cities around the world are planting trees to cope with hotter summers and longer heatwaves.\n\nShade also protects pavements and roads, which last longer when they do not bake in direct sunlight.';
    expect(cleanArticleText(text)).toBe(text);
  });

  it('gives each paragraph its offset in the text', () => {
    const text = 'First paragraph here.\n\nSecond one.';
    expect(paragraphsWithOffsets(text)).toEqual([
      { text: 'First paragraph here.', start: 0 },
      { text: 'Second one.', start: 23 }
    ]);
  });
});
