import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PopupView } from '../popupView';
import { SentenceAnalysisResult } from '../../types';

const phrases = [
  ['Although inflation increased rapidly', 'Even though prices rose very quickly', 'যদিও দ্রব্যমূল্য দ্রুত বৃদ্ধি পেয়েছিল'],
  ['the central bank', 'the main bank of the country', 'কেন্দ্রীয় ব্যাংক'],
  ['maintained steady', 'kept unchanged', 'স্থির রেখেছিল'],
  ['interest rates', 'the cost of borrowing money', 'সুদের হার'],
  ['for the third quarter', 'for three months in a row', 'টানা তৃতীয় প্রান্তিকে']
].map(([phrase, easyEnglish, easyBengali]) => ({ phrase, easyEnglish, easyBengali }));

const sentence: SentenceAnalysisResult = {
  selectedText: 'Although inflation increased rapidly, the central bank maintained steady interest rates for the third quarter.',
  selectionType: 'sentence',
  plainEnglishParaphrase: 'Even though prices went up fast, the main bank did not change interest rates.',
  bengaliTranslation: 'মুদ্রাস্ফীতি দ্রুত বাড়লেও কেন্দ্রীয় ব্যাংক সুদের হার অপরিবর্তিত রেখেছে।',
  phraseBreakdown: phrases,
  clauses: [],
  grammaticalHighlights: ['Subordinate concessive clause introduced by "Although"'],
  difficultVocabulary: [],
  overallMeaning: 'The central bank held rates despite high inflation.',
  toneAndRegister: 'Formal'
};

describe('Reading card UX', () => {
  let onUpdateSettings: ReturnType<typeof vi.fn>;
  let onRetry: ReturnType<typeof vi.fn>;
  let popup: PopupView;

  beforeEach(() => {
    onUpdateSettings = vi.fn().mockResolvedValue(undefined);
    onRetry = vi.fn();
    popup = new PopupView({
      onClose: vi.fn(),
      onSave: vi.fn().mockResolvedValue(undefined),
      onChangeMode: vi.fn(),
      onWritingAssist: vi.fn().mockResolvedValue(null),
      onAskFollowUp: vi.fn().mockResolvedValue(null),
      onUpdateSettings,
      onRetry
    } as any);
    document.body.appendChild(popup.getElement());
  });

  it('text size menu opens from the header and applies the chosen size', () => {
    popup.showSentence(sentence, '', '');
    const el = popup.getElement();
    const btn = el.querySelector('.lf-textsize-btn') as HTMLElement;
    const menu = el.querySelector('.lf-textsize-menu') as HTMLElement;
    expect(menu.hidden).toBe(true);

    btn.click();
    expect(menu.hidden).toBe(false);
    expect(btn.getAttribute('aria-expanded')).toBe('true');

    (el.querySelector('.lf-textsize-opt[data-size="xlarge"]') as HTMLElement).click();
    expect(popup.getSize()).toBe('xlarge');
    expect(el.classList.contains('size-xlarge')).toBe(true);
    expect(onUpdateSettings).toHaveBeenCalledWith({ popupSize: 'xlarge' });
    expect(menu.hidden).toBe(true);
  });

  it('Escape closes the text size menu before closing the card', () => {
    popup.showSentence(sentence, '', '');
    const el = popup.getElement();
    (el.querySelector('.lf-textsize-btn') as HTMLElement).click();
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect((el.querySelector('.lf-textsize-menu') as HTMLElement).hidden).toBe(true);
  });

  it('long phrase lists show three phrases and reveal the rest on demand', () => {
    popup.showSentence(sentence, '', '');
    const el = popup.getElement();
    const list = el.querySelector('.lf-phrases-list') as HTMLElement;
    expect(list.classList.contains('is-collapsed')).toBe(true);
    expect(el.querySelectorAll('.lf-phrase-extra').length).toBe(2);

    const more = el.querySelector('.lf-phrases-more') as HTMLElement;
    expect(more.textContent).toContain('Show all 5 phrases');
    more.click();
    expect(list.classList.contains('is-collapsed')).toBe(false);
    expect(more.getAttribute('aria-expanded')).toBe('true');
  });

  it('secondary detail is folded in Quick mode and open in Learn mode', () => {
    popup.showSentence(sentence, '', '');
    expect((popup.getElement().querySelector('.lf-more-details') as HTMLDetailsElement).open).toBe(false);

    popup.setReadingMode('learn');
    popup.showSentence(sentence, '', '');
    expect((popup.getElement().querySelector('.lf-more-details') as HTMLDetailsElement).open).toBe(true);
  });

  it('tabs expose tab semantics and move with the arrow keys', () => {
    popup.showSentence(sentence, '', '');
    const el = popup.getElement();
    const tablist = el.querySelector('.lf-tabs') as HTMLElement;
    expect(tablist.getAttribute('role')).toBe('tablist');

    const active = el.querySelector('[role="tab"][aria-selected="true"]') as HTMLElement;
    expect(active.dataset.tab).toBe('breakdown');
    active.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

    const next = el.querySelector('[role="tab"][aria-selected="true"]') as HTMLElement;
    expect(next.dataset.tab).toBe('grammar');
  });

  it('error card offers a retry that re-runs the lookup', () => {
    popup.showError('Network error', 'scrutiny');
    const retry = popup.getElement().querySelector('.lf-retry-btn') as HTMLElement;
    expect(retry).not.toBeNull();
    retry.click();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('first-use tip shows once and reports its dismissal', () => {
    const onDismissTip = vi.fn();
    (popup as any).callbacks.onDismissTip = onDismissTip;
    popup.setFirstUseTip(true);
    popup.showSentence(sentence, '', '');
    const el = popup.getElement();
    expect(el.querySelector('.lf-first-tip')?.textContent).toContain('click any word');

    (el.querySelector('.lf-first-tip-close') as HTMLElement).click();
    expect(el.querySelector('.lf-first-tip')).toBeNull();
    expect(onDismissTip).toHaveBeenCalledTimes(1);

    popup.showSentence(sentence, '', '');
    expect(el.querySelector('.lf-first-tip')).toBeNull();
  });

  it('Tab from the last control wraps to the first so focus stays in the card', () => {
    popup.showError('Network error', 'scrutiny');
    const el = popup.getElement();
    // jsdom has no layout, so give every control a client rect
    el.querySelectorAll<HTMLElement>('button').forEach((b) => {
      b.getClientRects = () => [{} as DOMRect] as unknown as DOMRectList;
    });
    const buttons = Array.from(el.querySelectorAll<HTMLElement>('button'));
    buttons[buttons.length - 1].focus();
    const evt = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    buttons[buttons.length - 1].dispatchEvent(evt);
    expect(evt.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(buttons[0]);
  });

  it('loading card names the current step', () => {
    popup.showLoading('scrutiny', 'word');
    expect(popup.getElement().querySelector('.lf-loading-step')?.textContent).toContain('Reading the sentence');
  });
});
