/**
 * Where LexiFlow runs on web pages. One rule shared by the page script, the popup toggle and the
 * toolbar badge, so they always agree.
 *
 * - siteMode 'off' (the default): LexiFlow stays off on every site except those in `enabledSites`.
 * - siteMode 'on': LexiFlow runs on every site except those in `disabledSites`.
 * A global pause turns it off everywhere in both modes.
 */
import type { UserSettings } from '../types';

export type SiteMode = 'off' | 'on';

/** Pages opened from the computer (file://) have no host; together they count as one site. */
export const LOCAL_FILES = 'file://';

/** How a site key is shown to the reader. */
export const siteLabel = (host: string) => (host === LOCAL_FILES ? 'Local files' : host);
export const DEFAULT_SITE_MODE: SiteMode = 'off';

type AccessSettings = Pick<UserSettings, 'siteMode' | 'enabledSites' | 'disabledSites' | 'isGloballyPaused'>;

export function siteModeOf(settings?: Partial<AccessSettings> | null): SiteMode {
  return settings?.siteMode === 'on' ? 'on' : DEFAULT_SITE_MODE;
}

/** The host name of a URL, or the text itself when it is already a host. Empty for non-web pages. */
export function hostOf(urlOrHost?: string): string {
  if (!urlOrHost) return '';
  if (!urlOrHost.includes('/') && !urlOrHost.includes(':')) return urlOrHost.toLowerCase().trim();
  try {
    const parsed = new URL(urlOrHost);
    if (parsed.protocol === 'file:') return LOCAL_FILES;
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.hostname.toLowerCase() : '';
  } catch {
    return '';
  }
}

/** True when `host` is one of `sites` or a subdomain of one (www.bbc.com matches bbc.com). */
export function hostInList(host: string, sites?: string[]): boolean {
  if (!host || !Array.isArray(sites)) return false;
  return sites.some((site) => {
    const s = site.toLowerCase().trim();
    return Boolean(s) && (host === s || host.endsWith('.' + s));
  });
}

/** Is LexiFlow allowed to run on this page? */
export function isSiteActive(urlOrHost: string | undefined, settings?: Partial<AccessSettings> | null): boolean {
  if (settings?.isGloballyPaused) return false;
  const host = hostOf(urlOrHost);
  if (!host) return false;
  return siteModeOf(settings) === 'on' ? !hostInList(host, settings?.disabledSites) : hostInList(host, settings?.enabledSites);
}

/** The settings change that flips LexiFlow on or off for one site, in the current mode. */
export function toggleSite(
  urlOrHost: string,
  settings?: Partial<AccessSettings> | null
): Pick<UserSettings, 'enabledSites'> | Pick<UserSettings, 'disabledSites'> {
  const host = hostOf(urlOrHost);
  const active = isSiteActive(host, { ...settings, isGloballyPaused: false });
  const without = (list?: string[]) =>
    (Array.isArray(list) ? list : []).filter((s) => {
      const t = s.toLowerCase().trim();
      return t !== host && !host.endsWith('.' + t);
    });

  if (siteModeOf(settings) === 'on') {
    return { disabledSites: active ? [...without(settings?.disabledSites), host] : without(settings?.disabledSites) };
  }
  return { enabledSites: active ? without(settings?.enabledSites) : [...without(settings?.enabledSites), host] };
}
