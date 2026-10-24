import { describe, it, expect } from 'vitest';
import { tagTargetLanguage, langForScript } from '../targetLang';

function render(html: string): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = html;
  return root;
}

describe('tagTargetLanguage', () => {
  it('tags target-language classes and gives them automatic direction', () => {
    const root = render('<div class="lf-easy-bengali-text">সহজ বাংলা অর্থ</div><p>English stays untagged</p>');
    tagTargetLanguage(root, 'bn');
    const bn = root.querySelector('.lf-easy-bengali-text')!;
    expect(bn.getAttribute('lang')).toBe('bn');
    expect(bn.getAttribute('dir')).toBe('auto');
    expect(root.querySelector('p')!.hasAttribute('lang')).toBe(false);
  });

  it('uses the target language for Latin-script targets in known classes', () => {
    const root = render('<span class="lf-phrase-bengali">aunque los precios subieron</span>');
    tagTargetLanguage(root, 'es');
    expect(root.querySelector('span')!.getAttribute('lang')).toBe('es');
  });

  it('tags right-to-left text so it lays out correctly', () => {
    const root = render('<div class="lf-bengali-meaning">آسان اردو وضاحت</div><div>مثال</div>');
    tagTargetLanguage(root, 'ur');
    root.querySelectorAll('div').forEach((d) => {
      expect(d.getAttribute('lang')).toBe('ur');
      expect(d.getAttribute('dir')).toBe('auto');
    });
  });

  it('tells Japanese from Chinese so Han characters get the right glyph forms', () => {
    const root = render('<div id="ja">日本語の説明です</div><div id="zh">中文解释</div>');
    tagTargetLanguage(root, 'ja');
    expect(root.querySelector('#ja')!.getAttribute('lang')).toBe('ja');
    // Pure Han text with a Japanese target is read as Japanese, matching the reader's language
    expect(root.querySelector('#zh')!.getAttribute('lang')).toBe('ja');

    const zhRoot = render('<div>中文解释</div>');
    tagTargetLanguage(zhRoot, 'zh');
    expect(zhRoot.querySelector('div')!.getAttribute('lang')).toBe('zh');
  });

  it('labels text in another script by its own language (e.g. Bangla shown to a Hindi reader)', () => {
    const root = render('<div>বাংলা</div><div>हिन्दी</div>');
    tagTargetLanguage(root, 'hi');
    const [bn, hi] = Array.from(root.querySelectorAll('div'));
    expect(bn.getAttribute('lang')).toBe('bn');
    expect(hi.getAttribute('lang')).toBe('hi');
  });

  it('maps scripts to the reader language when they share it', () => {
    expect(langForScript('Devanagari', 'mr')).toBe('mr');
    expect(langForScript('Arabic', 'fa')).toBe('fa');
    expect(langForScript('Arabic', 'en')).toBe('ar');
    expect(langForScript('Cyrillic', 'uk-UA')).toBe('uk');
  });
});
