import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DOMHighlighter } from '../highlighter';
import { HighlightVocabularyItem } from '../../types';

describe('DOMHighlighter Safe Webpage Highlighting', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    container = document.createElement('div');
    container.id = 'test-container';
    document.body.appendChild(container);
  });

  const sampleItems: HighlightVocabularyItem[] = [
    {
      id: 'hl_test_1',
      text: 'scrutiny',
      type: 'word',
      easyEnglish: 'close and careful examination',
      easyBengali: 'পুঙ্খানুপুঙ্খ পরীক্ষা',
      contextSentence: 'Under close scrutiny, the hypothesis failed.',
      reason: 'Academic vocabulary',
      difficulty: 'hard'
    },
    {
      id: 'hl_test_2',
      text: 'look into',
      type: 'phrase',
      easyEnglish: 'investigate or check',
      easyBengali: 'তদন্ত করা বা খতিয়ে দেখা',
      contextSentence: 'The committee will look into the matter.',
      reason: 'Common phrasal verb',
      difficulty: 'medium'
    },
    {
      id: 'hl_test_3',
      text: 'break the ice',
      type: 'idiom',
      easyEnglish: 'make people feel relaxed',
      easyBengali: 'আড়ষ্টতা দূর করা',
      contextSentence: 'He told a funny joke to break the ice.',
      reason: 'Popular idiom',
      difficulty: 'medium'
    }
  ];

  it('safely highlights words, phrases, and idioms with correct CSS classes', () => {
    container.innerHTML = `
      <p>Under close scrutiny, the hypothesis failed.</p>
      <p>The committee will look into the matter immediately.</p>
      <p>He told a funny joke to break the ice at the party.</p>
    `;

    const highlighter = new DOMHighlighter({
      color: 'yellow',
      filters: { words: true, phrases: true, idioms: true }
    });

    const count = highlighter.applyHighlights(sampleItems, container);
    expect(count).toBe(3);
    expect(highlighter.getHighlightCount()).toBe(3);

    const marks = container.querySelectorAll('mark.lexiflow-highlight');
    expect(marks.length).toBe(3);

    const markWord = container.querySelector('mark[data-category="word"]');
    expect(markWord?.textContent).toBe('scrutiny');
    expect(markWord?.classList.contains('lexiflow-color-yellow')).toBe(true);

    const markPhrase = container.querySelector('mark[data-category="phrase"]');
    expect(markPhrase?.textContent).toBe('look into');

    const markIdiom = container.querySelector('mark[data-category="idiom"]');
    expect(markIdiom?.textContent).toBe('break the ice');
  });

  it('respects content filters by hiding or showing filtered categories', () => {
    container.innerHTML = `
      <p>We need scrutiny and to look into how to break the ice.</p>
    `;

    const highlighter = new DOMHighlighter({
      color: 'blue',
      filters: { words: true, phrases: true, idioms: true }
    });

    highlighter.applyHighlights(sampleItems, container);

    // Disable phrases and idioms
    highlighter.updateFilters({ words: true, phrases: false, idioms: false });

    const markWord = container.querySelector('mark[data-category="word"]') as HTMLElement;
    const markPhrase = container.querySelector('mark[data-category="phrase"]') as HTMLElement;
    const markIdiom = container.querySelector('mark[data-category="idiom"]') as HTMLElement;

    expect(markWord.classList.contains('lf-highlight-hidden')).toBe(false);
    expect(markPhrase.classList.contains('lf-highlight-hidden')).toBe(true);
    expect(markIdiom.classList.contains('lf-highlight-hidden')).toBe(true);

    // Re-enable all
    highlighter.updateFilters({ words: true, phrases: true, idioms: true });
    expect(markPhrase.classList.contains('lf-highlight-hidden')).toBe(false);
    expect(markIdiom.classList.contains('lf-highlight-hidden')).toBe(false);
  });

  it('switches highlight color dynamically across all marks', () => {
    container.innerHTML = `<p>Under close scrutiny, the hypothesis held.</p>`;

    const highlighter = new DOMHighlighter({
      color: 'yellow',
      filters: { words: true, phrases: true, idioms: true }
    });

    highlighter.applyHighlights([sampleItems[0]], container);
    let mark = container.querySelector('mark.lexiflow-highlight');
    expect(mark?.classList.contains('lexiflow-color-yellow')).toBe(true);

    highlighter.updateColor('purple');
    mark = container.querySelector('mark.lexiflow-highlight');
    expect(mark?.classList.contains('lexiflow-color-purple')).toBe(true);
    expect(mark?.classList.contains('lexiflow-color-yellow')).toBe(false);
  });

  it('restores original DOM tree completely on clearHighlights (non-destructive)', () => {
    const originalText = 'Under close scrutiny, the hypothesis failed.';
    container.innerHTML = `<p id="target-p">${originalText}</p>`;

    const highlighter = new DOMHighlighter();
    highlighter.applyHighlights([sampleItems[0]], container);

    expect(container.querySelectorAll('mark.lexiflow-highlight').length).toBe(1);

    highlighter.clearHighlights();

    expect(container.querySelectorAll('mark.lexiflow-highlight').length).toBe(0);
    const p = container.querySelector('#target-p');
    expect(p?.textContent).toBe(originalText);
    expect(highlighter.getHighlightCount()).toBe(0);
  });

  it('supports next and previous navigation with pulse animations', () => {
    container.innerHTML = `
      <p>First scrutiny here.</p>
      <p>Second scrutiny here.</p>
    `;

    const highlighter = new DOMHighlighter();
    highlighter.applyHighlights([sampleItems[0]], container);

    expect(highlighter.getHighlightCount()).toBe(2);

    const first = highlighter.navigateToNext();
    expect(first).not.toBeNull();
    expect(first?.classList.contains('lexiflow-highlight-active')).toBe(true);

    const second = highlighter.navigateToNext();
    expect(second).not.toBeNull();
    expect(second).not.toBe(first);

    const prev = highlighter.navigateToPrev();
    expect(prev).toBe(first);
  });

  it('does not touch scripts, styles, textareas, or contenteditable elements', () => {
    container.innerHTML = `
      <script>const scrutiny = 1;</script>
      <style>.scrutiny { color: red; }</style>
      <textarea>Do not highlight scrutiny inside textarea</textarea>
      <div contenteditable="true">Editable scrutiny here</div>
      <p>Normal text scrutiny here.</p>
    `;

    const highlighter = new DOMHighlighter();
    highlighter.applyHighlights([sampleItems[0]], container);

    const script = container.querySelector('script');
    expect(script?.querySelector('mark')).toBeNull();

    const textarea = container.querySelector('textarea');
    expect(textarea?.querySelector('mark')).toBeNull();

    const editable = container.querySelector('[contenteditable="true"]');
    expect(editable?.querySelector('mark')).toBeNull();

    const normal = container.querySelector('p');
    expect(normal?.querySelector('mark.lexiflow-highlight')).not.toBeNull();
  });

  it('triggers onHighlightClick callback when user clicks a highlight', () => {
    container.innerHTML = `<p>Under close scrutiny, the test passed.</p>`;
    const onClickMock = vi.fn();

    const highlighter = new DOMHighlighter({
      onHighlightClick: onClickMock
    });

    highlighter.applyHighlights([sampleItems[0]], container);

    const mark = container.querySelector('mark.lexiflow-highlight') as HTMLElement;
    mark.click();

    expect(onClickMock).toHaveBeenCalledTimes(1);
    expect(onClickMock).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'scrutiny',
        category: 'word'
      }),
      expect.anything()
    );
  });

  it('highlights a phrase split by source line breaks, non-breaking spaces and inline tags', () => {
    container.innerHTML = `<p>New rules could pave
   the <a href="#">way</a> for talks, officials said.</p>
      <p>The deal was struck in the wake of the protests.</p>`;
    const highlighter = new DOMHighlighter();
    highlighter.applyHighlights(
      [
        { ...sampleItems[2], id: 'hl_a', text: 'pave the way', contextSentence: 'New rules could pave the way for talks, officials said.' },
        { ...sampleItems[1], id: 'hl_b', text: 'in the wake of', contextSentence: 'The deal was struck in the wake of the protests.' }
      ],
      container
    );

    // One occurrence each, even though "pave the way" became two mark pieces around the link
    expect(highlighter.getHighlightCount()).toBe(2);
    const paveMarks = container.querySelectorAll('mark[data-lexiflow-id="hl_a"]');
    expect(Array.from(paveMarks).map((m) => m.textContent).join('|')).toBe('pave\n   the |way');
    expect(container.querySelector('a mark')).not.toBeNull();
    expect(container.querySelector('mark[data-lexiflow-id="hl_b"]')?.textContent).toBe('in the wake of');

    // Clearing restores the original text exactly
    const before = container.textContent;
    highlighter.clearHighlights();
    expect(container.querySelectorAll('mark').length).toBe(0);
    expect(container.textContent).toBe(before);
  });

  it('matches curly apostrophes and never marks text inside a longer word', () => {
    container.innerHTML = `<p>Investors won’t back down at the start of trading.</p>`;
    const highlighter = new DOMHighlighter();
    highlighter.applyHighlights(
      [
        { ...sampleItems[1], id: 'hl_c', text: "won't back down", contextSentence: '' },
        { ...sampleItems[0], id: 'hl_d', text: 'tart', contextSentence: '' }
      ],
      container
    );
    expect(container.querySelector('mark[data-lexiflow-id="hl_c"]')?.textContent).toBe('won’t back down');
    expect(container.querySelector('mark[data-lexiflow-id="hl_d"]')).toBeNull();
  });

  it('activates every piece of a split phrase together', () => {
    container.innerHTML = `<p>They hope to <em>pave</em> the way.</p>`;
    const highlighter = new DOMHighlighter();
    highlighter.applyHighlights([{ ...sampleItems[2], id: 'hl_e', text: 'pave the way', contextSentence: '' }], container);
    const marks = container.querySelectorAll('mark[data-lexiflow-id="hl_e"]');
    expect(marks.length).toBe(2);
    (marks[1] as HTMLElement).click();
    marks.forEach((m) => expect(m.classList.contains('lexiflow-highlight-active')).toBe(true));
  });
});
