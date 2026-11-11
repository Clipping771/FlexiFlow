// Tags translated text with its language and `dir="auto"` so the browser picks the right
// system font and glyph forms (Chinese vs Japanese Han), and lays out right-to-left
// scripts (Arabic, Urdu, Persian) correctly. Works for custom languages too: any text in a
// non-Latin script is tagged by script even without a known class.

/** Elements whose content is always in the reader's target language. */
export const TARGET_TEXT_SELECTOR = [
  '.lf-easy-bengali-text', '.lf-phrase-bengali', '.lf-bengali-meaning', '.lf-example-bengali',
  '.lf-vocab-bengali', '.lf-qa-bengali-text', '.lf-qa-example-bengali', '.lf-hl-summary-bengali',
  '.lf-gb-overview-target', '.lf-target-header', '.lf-target-badge', '.lf-clause-bengali',
  '.lf-bengali-explanation', '.lf-para-sentence-translation', '.lf-trans-text',
  '.result-bengali-pill', '.result-phrase-bengali', '.recent-word-bn', '.vocab-bengali'
].join(', ');

type Script =
  | 'Bengali' | 'Devanagari' | 'Arabic' | 'Han' | 'Hiragana' | 'Katakana' | 'Hangul' | 'Thai'
  | 'Tamil' | 'Telugu' | 'Gujarati' | 'Gurmukhi' | 'Cyrillic' | 'Greek' | 'Hebrew';

const SCRIPT_TESTS: Array<[Script, RegExp]> = [
  ['Bengali', /\p{Script=Bengali}/u], ['Devanagari', /\p{Script=Devanagari}/u], ['Arabic', /\p{Script=Arabic}/u],
  ['Hiragana', /\p{Script=Hiragana}/u], ['Katakana', /\p{Script=Katakana}/u], ['Han', /\p{Script=Han}/u],
  ['Hangul', /\p{Script=Hangul}/u], ['Thai', /\p{Script=Thai}/u], ['Tamil', /\p{Script=Tamil}/u],
  ['Telugu', /\p{Script=Telugu}/u], ['Gujarati', /\p{Script=Gujarati}/u], ['Gurmukhi', /\p{Script=Gurmukhi}/u],
  ['Cyrillic', /\p{Script=Cyrillic}/u], ['Greek', /\p{Script=Greek}/u], ['Hebrew', /\p{Script=Hebrew}/u]
];

/** Language assumed for a script when it is not the reader's target language. */
const SCRIPT_DEFAULT_LANG: Record<Script, string> = {
  Bengali: 'bn', Devanagari: 'hi', Arabic: 'ar', Han: 'zh', Hiragana: 'ja', Katakana: 'ja', Hangul: 'ko',
  Thai: 'th', Tamil: 'ta', Telugu: 'te', Gujarati: 'gu', Gurmukhi: 'pa', Cyrillic: 'ru', Greek: 'el', Hebrew: 'he'
};

/** Scripts each non-Latin language is written in. */
const LANG_SCRIPTS: Record<string, Script[]> = {
  bn: ['Bengali'], as: ['Bengali'], hi: ['Devanagari'], mr: ['Devanagari'], ne: ['Devanagari'],
  ar: ['Arabic'], ur: ['Arabic'], fa: ['Arabic'], ps: ['Arabic'], zh: ['Han'], ja: ['Han', 'Hiragana', 'Katakana'],
  ko: ['Hangul', 'Han'], th: ['Thai'], ta: ['Tamil'], te: ['Telugu'], gu: ['Gujarati'], pa: ['Gurmukhi'],
  ru: ['Cyrillic'], uk: ['Cyrillic'], bg: ['Cyrillic'], sr: ['Cyrillic'], el: ['Greek'], he: ['Hebrew']
};

function detectScript(text: string): Script | null {
  // Japanese kana wins over Han so mixed kanji/kana text reads as Japanese
  for (const [script, re] of SCRIPT_TESTS) if (re.test(text)) return script;
  return null;
}

function ownText(el: Element): string {
  let text = '';
  el.childNodes.forEach((n) => {
    if (n.nodeType === 3) text += n.textContent || '';
  });
  return text;
}

function setLang(el: Element, lang: string): void {
  if (el.getAttribute('lang') !== lang) el.setAttribute('lang', lang);
  if (el.getAttribute('dir') !== 'auto') el.setAttribute('dir', 'auto');
}

/** Language code to use for text in `script` when the reader's target is `targetLang`. */
export function langForScript(script: Script, targetLang: string): string {
  const base = targetLang.toLowerCase().split('-')[0];
  return LANG_SCRIPTS[base]?.includes(script) ? base : SCRIPT_DEFAULT_LANG[script];
}

/** Tags target-language text under `root`. Safe to call after every render. */
export function tagTargetLanguage(root: ParentNode, targetLang: string): void {
  const lang = (targetLang || 'bn').toLowerCase();
  root.querySelectorAll(TARGET_TEXT_SELECTOR).forEach((el) => {
    const script = detectScript(el.textContent || '');
    setLang(el, script ? langForScript(script, lang) : lang);
  });
  root.querySelectorAll('*').forEach((el) => {
    if (el.matches(TARGET_TEXT_SELECTOR) || el.closest('script, style, svg')) return;
    const text = ownText(el);
    if (!text.trim()) return;
    const script = detectScript(text);
    if (script) setLang(el, langForScript(script, lang));
  });
}

/**
 * Keeps a React-rendered page tagged as it re-renders. Returns a function that stops observing.
 * `getLang` is read on every pass so a changed target language takes effect on the next render.
 */
export function observeTargetLanguage(root: HTMLElement, getLang: () => string): () => void {
  let queued = false;
  const run = () => {
    queued = false;
    observer.disconnect();
    tagTargetLanguage(root, getLang());
    observer.observe(root, { childList: true, subtree: true, characterData: true });
  };
  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(run);
  });
  run();
  return () => observer.disconnect();
}
