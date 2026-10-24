// Bundled Bengali typeface so Bangla text looks the same on every computer,
// whether or not Kalpurush / SolaimanLipi are installed.
//
// Files: assets/fonts/noto-sans-bengali-bengali-{400,700}-normal.woff2 (Noto Sans Bengali 5.3.0,
// from @fontsource/noto-sans-bengali, SIL Open Font License 1.1, see assets/fonts/OFL.txt).
// The unicode-range limits the face to Bengali characters, so Latin text keeps its own font.

export const BENGALI_FONT_FAMILY = 'LexiFlow Bengali';

const STYLE_ID = 'lexiflow-bengali-font';
const UNICODE_RANGE =
  'U+0951-0952, U+0964-0965, U+0980-09FE, U+1CD0, U+1CD2, U+1CD5-1CD6, U+1CD8, U+1CE1, U+1CEA, U+1CED, ' +
  'U+1CF2, U+1CF5-1CF7, U+200C-200D, U+20B9, U+25CC, U+A8F1';
const FILES: Array<[weight: number, file: string]> = [
  [400, 'noto-sans-bengali-bengali-400-normal.woff2'],
  [700, 'noto-sans-bengali-bengali-700-normal.woff2']
];

/**
 * Declares the bundled Bengali face once per document. Font faces must live in the document,
 * not a shadow root, for the reading card's shadow DOM to use them.
 */
export function installBengaliFont(doc: Document, urlFor: (file: string) => string): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = FILES.map(([weight, file]) => `@font-face {
  font-family: '${BENGALI_FONT_FAMILY}';
  font-style: normal;
  font-weight: ${weight};
  font-display: swap;
  src: url('${urlFor(file)}') format('woff2');
  unicode-range: ${UNICODE_RANGE};
}`).join('\n');
  (doc.head || doc.documentElement).appendChild(style);
}

/** URL for a bundled font from an extension page (popup, dashboard) or a content script. */
export function extensionFontUrl(file: string): string {
  const path = `assets/fonts/${file}`;
  if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) return chrome.runtime.getURL(path);
  return `/${path}`;
}
