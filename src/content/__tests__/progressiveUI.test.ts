import { describe, it, expect, vi } from 'vitest';
import { PopupView } from '../popupView';
import { StageAExplanation } from '../../types';

describe('Stage 5: Progressive UI and Non-Blocking AI', () => {
  const initialDictStageA: StageAExplanation = {
    selectedText: 'scrutiny',
    lemma: 'scrutiny',
    partOfSpeech: 'noun',
    easyEnglish: 'Critical observation or examination; close and careful inspection.',
    easyBengali: 'পুঙ্খানুপুঙ্খ পরীক্ষা / তীক্ষ্ণ নজরদারি',
    contextMeaning: 'গভীর মনোযোগ সহকারে কোনো বিষয় বা তথ্যের চুলচেরা বিশ্লেষণ করা।',
    example: 'The government policies have come under increasing scrutiny.',
    exampleBengali: 'নীতিগুলো গভীর পর্যবেক্ষণের আওতায় আনা হয়েছিল।',
    confidence: 'high',
    contextualSenseId: 'sense_dict_1'
  };

  const enrichedAiStageA: StageAExplanation = {
    selectedText: 'scrutiny',
    lemma: 'scrutiny',
    partOfSpeech: 'noun',
    easyEnglish: 'Critical observation or examination; close and careful inspection.',
    easyBengali: 'পুঙ্খানুপুঙ্খ পরীক্ষা / তীক্ষ্ণ নজরদারি',
    contextMeaning: 'In this sentence, fertiliser subsidies are being examined carefully by fiscal analysts.',
    example: 'Fertiliser subsidies need a rethink under intense fiscal scrutiny.',
    exampleBengali: 'তীব্র রাজস্ব নজরদারির মুখে সার ভর্তুকি পুনর্বিবেচনা প্রয়োজন।',
    confidence: 'high',
    contextualSenseId: 'sense_ai_1'
  };

  it('1. Renders local dictionary result immediately with language-learning hierarchy', () => {
    const view = new PopupView({
      onClose: vi.fn(),
      onSave: vi.fn(),
      onChangeMode: vi.fn(),
      onWritingAssist: vi.fn(),
      onAskFollowUp: vi.fn()
    });

    view.showStageA(initialDictStageA, 'Under close scrutiny.', '');
    const el = view.getElement();

    // 1. Easy English First
    const englishEl = el.querySelector('.lf-easy-english-text');
    expect(englishEl).not.toBeNull();
    expect(englishEl?.textContent).toContain('Critical observation');

    // 2. Easy Bengali Second
    const bengaliEl = el.querySelector('.lf-easy-bengali-text');
    expect(bengaliEl).not.toBeNull();
    expect(bengaliEl?.textContent).toContain('পুঙ্খানুপুঙ্খ পরীক্ষা');

    // 3. In this sentence
    const contextEl = el.querySelector('.lf-context-text');
    expect(contextEl).not.toBeNull();
    expect(contextEl?.textContent).toContain('গভীর মনোযোগ সহকারে');

    // 4. Natural Example
    const exampleEl = el.querySelector('.lf-example-text');
    expect(exampleEl).not.toBeNull();
    expect(exampleEl?.textContent).toContain('The government policies');

    // 5. Honesty badge
    const badgeEl = el.querySelector('.lf-ai-badge');
    expect(badgeEl?.textContent).toContain('Verified Lexicon');
  });

  it('2. Updates contextual AI interpretation in-place without whole-popup rerender', () => {
    const view = new PopupView({
      onClose: vi.fn(),
      onSave: vi.fn(),
      onChangeMode: vi.fn(),
      onWritingAssist: vi.fn(),
      onAskFollowUp: vi.fn()
    });

    view.showStageA(initialDictStageA, 'Under close scrutiny.', '');
    const el = view.getElement();

    // Capture initial DOM element reference
    const initialHeader = el.querySelector('.lf-header');
    const initialMainContent = el.querySelector('#lf-main-content');

    // Now AI responds in background and updates Stage A
    view.showStageA(enrichedAiStageA, 'Under close scrutiny.', '');

    // Header and main content elements MUST NOT have been blown away or re-created!
    expect(el.querySelector('.lf-header')).toBe(initialHeader);
    expect(el.querySelector('#lf-main-content')).toBe(initialMainContent);

    // Contextual meaning section MUST be updated smoothly
    const contextEl = el.querySelector('.lf-context-text');
    expect(contextEl?.textContent).toBe('In this sentence, fertiliser subsidies are being examined carefully by fiscal analysts.');

    // Honesty badge updates to AI
    const badgeEl = el.querySelector('.lf-ai-badge');
    expect(badgeEl?.textContent).toContain('AI-generated');
  });

  it('3. Preserves Easy English and Bengali content stability during progressive update', () => {
    const view = new PopupView({
      onClose: vi.fn(),
      onSave: vi.fn(),
      onChangeMode: vi.fn(),
      onWritingAssist: vi.fn(),
      onAskFollowUp: vi.fn()
    });

    view.showStageA(initialDictStageA, 'Under close scrutiny.', '');
    const el = view.getElement();

    const initialEnglish = el.querySelector('.lf-easy-english-text')?.textContent;
    const initialBengali = el.querySelector('.lf-easy-bengali-text')?.textContent;

    // AI arrives with enriched contextual nuance
    view.showStageA(enrichedAiStageA, 'Under close scrutiny.', '');

    // English and Bengali definitions remain stable without flicker
    expect(el.querySelector('.lf-easy-english-text')?.textContent).toBe(initialEnglish);
    expect(el.querySelector('.lf-easy-bengali-text')?.textContent).toBe(initialBengali);
  });
});
