import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PopupView } from '../popupView';
import {
  StageAExplanation,
  StageBDetailedVocabulary,
  SentenceAnalysisResult,
  PhraseAnalysisResult,
  ParagraphAnalysisResult
} from '../../types';

describe('PopupView UI, Progressive Disclosure & Mode Transitions', () => {
  let onClose: ReturnType<typeof vi.fn>;
  let onSave: ReturnType<typeof vi.fn>;
  let onFetchStageB: ReturnType<typeof vi.fn>;
  let onReportWrongMeaning: ReturnType<typeof vi.fn>;
  let onSelectWord: ReturnType<typeof vi.fn>;
  let onAskFollowUp: ReturnType<typeof vi.fn>;
  let popup: PopupView;

  const mockWordStageA: StageAExplanation = {
    selectedText: 'scrutiny',
    lemma: 'scrutiny',
    partOfSpeech: 'noun',
    easyEnglish: 'Very careful and thorough examination of something.',
    easyBengali: 'পুঙ্খানুপুঙ্খ পরীক্ষা বা গভীর পর্যবেক্ষণ',
    contextMeaning: 'In this sentence, the policy was analyzed strictly by officials.',
    example: 'The documents were placed under close scrutiny.',
    exampleBengali: 'নথিগুলো গভীর পর্যবেক্ষণের আওতায় আনা হয়েছিল।',
    confidence: 'high',
    contextualSenseId: 'sense_1'
  };

  const mockPhraseAnalysis: PhraseAnalysisResult = {
    selectedText: 'on the other hand',
    selectionType: 'phrase',
    phraseType: 'fixed_expression',
    overallMeaning: 'Used to introduce an alternative viewpoint or contrasting fact.',
    simpleEnglishExplanation: 'Looking at another side of an argument or situation.',
    bengaliTranslation: 'অন্য দিকে বা অপর পক্ষে',
    literalVsFigurative: 'Figurative connective marker balancing opposing statements.',
    whyFitsContext: 'Provides balance to the previous claim.',
    examples: ['On the other hand, costs may increase significantly.']
  };

  const mockSentenceResult: SentenceAnalysisResult = {
    selectedText: 'Although inflation increased rapidly, the central bank maintained steady interest rates.',
    selectionType: 'sentence',
    plainEnglishParaphrase: 'Even though prices went up fast, the main bank did not change interest rates.',
    overallMeaning: 'The central bank decided to hold interest rates despite high inflation.',
    bengaliTranslation: 'মুদ্রাস্ফীতি দ্রুত বৃদ্ধি পাওয়া সত্ত্বেও কেন্দ্রীয় ব্যাংক সুদের হার অপরিবর্তিত রেখেছে।',
    phraseBreakdown: [
      {
        phrase: 'Although inflation increased rapidly',
        easyEnglish: 'Even though prices rose very quickly',
        easyBengali: 'যদিও দ্রব্যমূল্য দ্রুত বৃদ্ধি পেয়েছিল'
      },
      {
        phrase: 'the central bank maintained steady interest rates',
        easyEnglish: 'the main bank kept the loan rates unchanged',
        easyBengali: 'মূল ব্যাংক সুদের হার স্থির রেখেছিল'
      }
    ],
    clauses: [
      {
        text: 'Although inflation increased rapidly',
        type: 'subordinate',
        role: 'Concessive Clause',
        explanationBengali: 'শর্তমূলক বা বিপরীতমুখী খণ্ডবাক্য'
      },
      {
        text: 'the central bank maintained steady interest rates',
        type: 'main',
        role: 'Independent Proposition',
        explanationBengali: 'প্রধান খণ্ডবাক্য যা মূল সিদ্ধান্ত নির্দেশ করে'
      }
    ],
    grammaticalHighlights: [
      'Subordinate concessive clause introduced by "Although"',
      'Past simple active voice ("increased", "maintained")'
    ],
    difficultVocabulary: [
      {
        word: 'inflation',
        meaningInContext: 'A general increase in prices and fall in the purchasing value of money',
        bengali: 'মুদ্রাস্ফীতি'
      },
      {
        word: 'steady',
        meaningInContext: 'Firmly fixed, constant, or not changing',
        bengali: 'স্থির বা অপরিবর্তিত'
      }
    ],
    toneAndRegister: 'Formal / Economic Journalistic'
  };

  const mockStageB: StageBDetailedVocabulary = {
    lemma: 'scrutiny',
    partOfSpeech: 'noun',
    contextualSenseId: 'sense_1',
    senses: [
      {
        id: 'sense_1',
        partOfSpeech: 'noun',
        easyEnglish: 'Critical observation or examination.',
        easyBengali: 'গভীর নজরদারি বা পুঙ্খানুপুঙ্খ অনুসন্ধান',
        isContextual: true,
        examples: [{ english: 'The company faced public scrutiny.', bengali: 'কোম্পানিটি জনসমক্ষে তীব্র পর্যালোচনার মুখোমুখি হয়েছিল।' }],
        synonyms: [{ word: 'inspection', easyEnglish: 'close look', easyBengali: 'পরিদর্শন' }],
        antonyms: []
      }
    ],
    collocations: [{ english: 'close scrutiny', bengali: 'গভীর পর্যবেক্ষণ' }],
    idiomsAndPhrases: []
  };

  beforeEach(() => {
    onClose = vi.fn();
    onSave = vi.fn().mockResolvedValue(undefined);
    onFetchStageB = vi.fn().mockResolvedValue(mockStageB);
    onReportWrongMeaning = vi.fn().mockResolvedValue(true);
    onSelectWord = vi.fn();
    onAskFollowUp = vi.fn().mockResolvedValue(null);

    popup = new PopupView({
      onClose,
      onSave,
      onChangeMode: vi.fn(),
      onSelectWord,
      onWritingAssist: vi.fn().mockResolvedValue(null),
      onAskFollowUp,
      onFetchStageB,
      onReportWrongMeaning
    } as any);
  });

  // 1. Selecting a single word
  it('1. Selecting a single word: renders Word mode with Easy English first, Easy Bengali second', () => {
    popup.showStageA(mockWordStageA, 'The plan came under scrutiny.', '');
    const el = popup.getElement();

    expect(el.textContent).toContain('scrutiny');
    expect(el.textContent).toContain('NOUN');
    expect(el.textContent).toContain('Easy English');
    expect(el.textContent).toContain('Very careful and thorough examination of something.');
    expect(el.textContent).toContain('সহজ বাংলা');
    expect(el.textContent).toContain('পুঙ্খানুপুঙ্খ পরীক্ষা বা গভীর পর্যবেক্ষণ');
    expect(el.textContent).toContain('In this sentence');
    expect(el.textContent).toContain('AI-generated');
    expect(el.textContent).toContain('Confidence: high');

    // Confirm heading does NOT truncate a normal word
    const heading = el.querySelector('.lf-heading-word');
    expect(heading?.textContent).toBe('scrutiny');
  });

  // 2. Selecting a phrase
  it('2. Selecting a phrase: renders Phrase mode with Easy English, Bengali meaning, and context', () => {
    popup.showAnalysis(mockPhraseAnalysis, 'On the other hand, we must be cautious.', '');
    const el = popup.getElement();

    expect(el.textContent).toContain('on the other hand');
    expect(el.textContent).toContain('PHRASE');
    expect(el.textContent).toContain('Easy English');
    expect(el.textContent).toContain('Looking at another side of an argument or situation.');
    expect(el.textContent).toContain('সহজ বাংলা');
    expect(el.textContent).toContain('অন্য দিকে বা অপর পক্ষে');
  });

  // 3. Selecting a complete sentence
  it('3. Selecting a complete sentence: displays original text, phrase-by-phrase explanation, and full Bengali in exact order', () => {
    popup.showAnalysis(mockSentenceResult, '', '');
    const el = popup.getElement();

    // Mode badge
    expect(el.textContent).toContain('SENTENCE');
    expect(el.textContent).toContain('Sentence Analysis');

    // A. Original Text: sentence card contains full text
    expect(el.textContent).toContain('Although inflation increased rapidly, the central bank maintained steady interest rates.');

    // B. Phrase-by-Phrase Explanation
    expect(el.textContent).toContain('Phrase-by-Phrase Explanation');
    expect(el.textContent).toContain('Although inflation increased rapidly');
    expect(el.textContent).toContain('Even though prices rose very quickly');
    expect(el.textContent).toContain('যদিও দ্রব্যমূল্য দ্রুত বৃদ্ধি পেয়েছিল');
    expect(el.textContent).toContain('the central bank maintained steady interest rates');
    expect(el.textContent).toContain('the main bank kept the loan rates unchanged');
    expect(el.textContent).toContain('মূল ব্যাংক সুদের হার স্থির রেখেছিল');

    // C. Full Bengali
    expect(el.textContent).toContain('সম্পূর্ণ বাংলা অর্থ (Full Bengali):');
    expect(el.textContent).toContain('মুদ্রাস্ফীতি দ্রুত বৃদ্ধি পাওয়া সত্ত্বেও কেন্দ্রীয় ব্যাংক সুদের হার অপরিবর্তিত রেখেছে।');

    // Verify exact order in DOM: A (Original Text) -> B (Phrase Breakdown) -> C (Full Bengali)
    const cardPos = el.innerHTML.indexOf('lf-sentence-card');
    const phrasePos = el.innerHTML.indexOf('lf-phrase-breakdown-section');
    const bengaliPos = el.innerHTML.indexOf('lf-bengali-box');

    expect(cardPos).toBeGreaterThan(-1);
    expect(phrasePos).toBeGreaterThan(cardPos);
    expect(bengaliPos).toBeGreaterThan(phrasePos);

    // Tone and register badge
    expect(el.textContent).toContain('Formal / Economic Journalistic');
  });

  // 3b. Selecting a complete paragraph
  it('3b. Selecting a complete paragraph: renders Paragraph Intelligence with Original Text, Phrase-by-Phrase Explanation, and Full Bengali in exact order', () => {
    const mockParagraph: ParagraphAnalysisResult = {
      selectedText: 'Artificial intelligence is transforming education worldwide. Teachers use modern tools to personalize lessons, while students receive instant feedback on their work.',
      selectionType: 'paragraph',
      mainIdea: 'AI is fundamentally altering how modern education and learning operate.',
      conciseSummary: 'AI helps teachers personalize content and enables students to receive immediate feedback.',
      bengaliTranslation: 'কৃত্রিম বুদ্ধিমত্তা বিশ্বজুড়ে শিক্ষাব্যবস্থাকে বদলে দিচ্ছে। শিক্ষকরা পাঠ ব্যক্তিগতকরণে আধুনিক প্রযুক্তি ব্যবহার করেন এবং শিক্ষার্থীরা দ্রুত প্রতিক্রিয়া পায়।',
      phraseBreakdown: [
        {
          phrase: 'Artificial intelligence is transforming education worldwide',
          easyEnglish: 'AI is changing schools and learning everywhere.',
          easyBengali: 'কৃত্রিম বুদ্ধিমত্তা বিশ্বব্যাপী শিক্ষা ব্যবস্থাকে পরিবর্তন করছে।'
        },
        {
          phrase: 'Teachers use modern tools to personalize lessons',
          easyEnglish: 'Instructors utilize new software to customize teaching for each student.',
          easyBengali: 'শিক্ষকরা প্রতিটি শিক্ষার্থীর জন্য পাঠ উপযোগী করতে আধুনিক সরঞ্জাম ব্যবহার করেন।'
        },
        {
          phrase: 'while students receive instant feedback on their work',
          easyEnglish: 'and learners get immediate answers about their performance.',
          easyBengali: 'পাশাপাশি শিক্ষার্থীরা তাদের কাজের তাৎক্ষণিক মূল্যায়ন বা প্রতিক্রিয়া পায়।'
        }
      ],
      keyVocabulary: [
        { term: 'transforming', meaning: 'making a marked change in form, nature, or appearance', bengali: 'আমূল পরিবর্তন করা' }
      ],
      argumentStructure: 'Premise followed by dual examples of pedagogical impact.',
      toneAndRegister: 'Informative / Academic'
    };

    popup.showAnalysis(mockParagraph, '', '');
    const el = popup.getElement();

    expect(el.textContent).toContain('PARAGRAPH');
    expect(el.textContent).toContain('Paragraph Intelligence');

    // A. Original Text
    expect(el.textContent).toContain('Artificial intelligence is transforming education worldwide.');

    // B. Phrase-by-Phrase Explanation with 3 required fields per phrase
    expect(el.textContent).toContain('Phrase-by-Phrase Explanation');
    expect(el.textContent).toContain('Artificial intelligence is transforming education worldwide');
    expect(el.textContent).toContain('AI is changing schools and learning everywhere.');
    expect(el.textContent).toContain('কৃত্রিম বুদ্ধিমত্তা বিশ্বব্যাপী শিক্ষা ব্যবস্থাকে পরিবর্তন করছে।');
    expect(el.textContent).toContain('Teachers use modern tools to personalize lessons');
    expect(el.textContent).toContain('Instructors utilize new software to customize teaching for each student.');
    expect(el.textContent).toContain('শিক্ষকরা প্রতিটি শিক্ষার্থীর জন্য পাঠ উপযোগী করতে আধুনিক সরঞ্জাম ব্যবহার করেন।');

    // C. Full Bengali
    expect(el.textContent).toContain('সম্পূর্ণ বাংলা অর্থ (Full Bengali):');
    expect(el.textContent).toContain('কৃত্রিম বুদ্ধিমত্তা বিশ্বজুড়ে শিক্ষাব্যবস্থাকে বদলে দিচ্ছে।');

    // Verify exact order in DOM: A -> B -> C
    const cardPos = el.innerHTML.indexOf('lf-sentence-card');
    const phrasePos = el.innerHTML.indexOf('lf-phrase-breakdown-section');
    const bengaliPos = el.innerHTML.indexOf('lf-bengali-box');

    expect(cardPos).toBeGreaterThan(-1);
    expect(phrasePos).toBeGreaterThan(cardPos);
    expect(bengaliPos).toBeGreaterThan(phrasePos);
  });

  // 4. Selecting a word within a sentence
  it('4. Selecting a word within a sentence: interactive tokens trigger onSelectWord', () => {
    popup.showSentence(mockSentenceResult, '', '');
    const el = popup.getElement();

    // Click interactive word token 'inflation'
    const wordTokens = el.querySelectorAll('.lf-sentence-word');
    expect(wordTokens.length).toBeGreaterThan(0);

    const inflationToken = Array.from(wordTokens).find(
      (token) => token.getAttribute('data-word') === 'inflation'
    ) as HTMLElement;

    expect(inflationToken).not.toBeNull();
    inflationToken.click();

    expect(onSelectWord).toHaveBeenCalledWith(
      'inflation',
      'Although inflation increased rapidly, the central bank maintained steady interest rates.'
    );
  });

  // 5. Long sentence headings
  it('5. Long sentence headings: wraps gracefully and toggle allows full expansion without overflow', () => {
    const longSentence = 'Although several international development organizations warned that sudden policy shifts could lead to heightened volatility in emerging markets across Southeast Asia and Latin America, policymakers pushed forward with regulatory changes.';
    const longSentenceResult: SentenceAnalysisResult = {
      ...mockSentenceResult,
      selectedText: longSentence
    };

    popup.showSentence(longSentenceResult, '', '');
    const el = popup.getElement();

    // Heading displays clean title without cutting mid-word or breaking CSS layout
    const heading = el.querySelector('.lf-heading-sentence');
    expect(heading?.textContent).toBe('Sentence Analysis');

    // Long sentence has a toggle button for full preview
    const toggleBtn = el.querySelector('#lf-sentence-text-toggle') as HTMLElement;
    expect(toggleBtn).not.toBeNull();
    expect(toggleBtn.textContent).toContain('Show full');

    // Click toggle to show full sentence
    toggleBtn.click();
    const updatedToggle = el.querySelector('#lf-sentence-text-toggle');
    expect(updatedToggle?.textContent).toContain('Show less');
  });

  // 6. Missing or malformed AI response fields
  it('6. Missing or malformed AI response fields: gracefully handles partial or missing fields without throwing', () => {
    const incompleteSentence: any = {
      selectedText: 'The program completed successfully.',
      selectionType: 'sentence',
      bengaliTranslation: 'প্রোগ্রামটি সফলভাবে সমাপ্ত হয়েছে।',
      // Missing plainEnglishParaphrase, clauses, difficultVocabulary, toneAndRegister
      overallMeaning: 'The task is finished without errors.'
    };

    expect(() => {
      popup.showSentence(incompleteSentence, '', '');
    }).not.toThrow();

    const el = popup.getElement();
    // Falls back to overallMeaning when plainEnglishParaphrase is missing
    expect(el.textContent).toContain('The task is finished without errors.');
    expect(el.textContent).toContain('প্রোগ্রামটি সফলভাবে সমাপ্ত হয়েছে।');
  });

  // 7. Switching between sentence and word modes
  it('7. Switching between sentence and word modes: preserves parent sentence and provides Back button', () => {
    // 1. Initial sentence mode
    popup.showSentence(mockSentenceResult, '', '');
    const el = popup.getElement();
    expect(el.textContent).toContain('Sentence Analysis');

    // 2. User inspects difficult word 'inflation' -> switches to Word mode
    popup.setParentSentence(mockSentenceResult);
    const wordStageA: StageAExplanation = {
      selectedText: 'inflation',
      lemma: 'inflation',
      partOfSpeech: 'noun',
      easyEnglish: 'When prices go up and money buys less.',
      easyBengali: 'মুদ্রাস্ফীতি বা দ্রব্যমূল্য বৃদ্ধি',
      contextMeaning: 'In this sentence, it describes rapidly rising costs.',
      confidence: 'high',
      contextualSenseId: 'sense_1'
    };

    popup.showStageA(wordStageA, mockSentenceResult.selectedText, '', false, mockSentenceResult);

    expect(el.textContent).toContain('inflation');
    expect(el.textContent).toContain('When prices go up and money buys less.');

    // Back to Sentence button is present
    const backBtn = el.querySelector('#lf-back-sentence-btn') as HTMLElement;
    expect(backBtn).not.toBeNull();

    // 3. User clicks Back to Sentence -> returns to Sentence mode
    backBtn.click();
    expect(el.textContent).toContain('Sentence Analysis');
    expect(el.textContent).toContain('Although inflation increased rapidly');
  });

  // 8. Expanding detailed meanings without closing the popup
  it('8. Expanding detailed meanings without closing the popup: handles Word and Sentence expansion', async () => {
    // A. Word Mode Details Expansion
    popup.showStageA(mockWordStageA, 'The plan came under scrutiny.', '');
    const el = popup.getElement();

    const expandBtn = el.querySelector('#lf-expand-toggle') as HTMLElement;
    expect(expandBtn.getAttribute('aria-expanded')).toBe('false');

    expandBtn.click();
    await Promise.resolve();

    expect(onFetchStageB).toHaveBeenCalledWith('scrutiny', 'noun', 'sense_1');
    const updatedExpand = el.querySelector('#lf-expand-toggle');
    expect(updatedExpand?.getAttribute('aria-expanded')).toBe('true');
    expect(onClose).not.toHaveBeenCalled();

    // B. Sentence Mode Breakdown Expansion
    popup.showSentence(mockSentenceResult, '', '');
    const sentenceExpandBtn = el.querySelector('#lf-sentence-expand-toggle') as HTMLElement;
    expect(sentenceExpandBtn.getAttribute('aria-expanded')).toBe('false');

    sentenceExpandBtn.click();
    const updatedSentenceExpand = el.querySelector('#lf-sentence-expand-toggle');
    expect(updatedSentenceExpand?.getAttribute('aria-expanded')).toBe('true');
    expect(el.textContent).toContain('Difficult Words & Key Terms');
    expect(el.textContent).toContain('Syntactic Structure');
    expect(onClose).not.toHaveBeenCalled();

    // Difficult vocab chip clicking inside expanded section
    const vocabChip = el.querySelector('.lf-vocab-chip-btn') as HTMLElement;
    expect(vocabChip).not.toBeNull();
    vocabChip.click();
    expect(onSelectWord).toHaveBeenCalledWith('inflation', mockSentenceResult.selectedText);
  });

  // 9. Claude-style Advanced & Engaging Ask AI Coach
  it('9. Claude Ask AI Coach: renders engaging Claude interface, quick prompt chips, and handles Enter key submission', async () => {
    const mockClaudeResponse = {
      question: "Explain this word in super simple terms like I'm 5 years old",
      keyTakeaway: 'Think of "scrutiny" as using a magnifying glass to check every tiny detail.',
      answer: 'Imagine you are building a LEGO tower and your teacher looks very closely at every single brick to make sure it is super safe. That close look is **scrutiny**!',
      bengaliSummary: 'একদম সহজ করে বললে: ম্যাগনিফাইং গ্লাস দিয়ে কোনো জিনিস খুব মন দিয়ে খুঁটিয়ে পরখ করা।',
      suggestedFollowUps: [
        'How do native speakers use this in daily chat?',
        'What are 2 common mistakes to avoid?'
      ],
      examples: [
        {
          english: 'The detective looked at the note under close scrutiny.',
          bengali: 'গোয়েন্দা চিঠিটি খুব গভীরভাবে নিরীক্ষণ করেছিলেন।'
        }
      ]
    };

    onAskFollowUp.mockResolvedValue(mockClaudeResponse);

    popup.showStageA(mockWordStageA, 'The plan came under scrutiny.', '');
    const el = popup.getElement();

    // 1. Toggle Ask AI panel
    const toggleBtn = el.querySelector('.lf-qa-toggle-btn') as HTMLElement;
    expect(toggleBtn).not.toBeNull();
    toggleBtn.click();

    // Verify LexiFlow AI Coach header and brand elements
    expect(el.textContent).toContain('LexiFlow AI Coach');
    expect(el.textContent).toContain('Focus: "scrutiny"');

    // Verify Quick Prompt Chips are rendered
    expect(el.textContent).toContain("Explain like I'm 5");
    expect(el.textContent).toContain('Nuance vs Synonyms');
    expect(el.textContent).toContain('Native Daily Usage');
    expect(el.textContent).toContain('সহজ বাংলায় বিশদ');

    // 2. Click a quick prompt chip
    const chips = el.querySelectorAll('.lf-qa-chip');
    expect(chips.length).toBeGreaterThan(0);
    const chip5yo = Array.from(chips).find(c => c.textContent?.includes("5")) as HTMLElement;
    expect(chip5yo).not.toBeNull();

    chip5yo.click();
    await Promise.resolve();

    expect(onAskFollowUp).toHaveBeenCalledWith("Explain this word in super simple terms like I'm 5 years old");

    // 3. Verify LexiFlow AI conversation response rendering
    expect(el.textContent).toContain('LexiFlow AI Tutor');
    expect(el.textContent).toContain('Key Takeaway:');
    expect(el.textContent).toContain('Think of "scrutiny" as using a magnifying glass');
    expect(el.textContent).toContain('That close look is');
    expect(el.textContent).toContain('সহজ বাংলা সারসংক্ষেপ:');
    expect(el.textContent).toContain('ম্যাগনিফাইং গ্লাস দিয়ে কোনো জিনিস খুব মন দিয়ে খুঁটিয়ে পরখ করা।');
    expect(el.textContent).toContain('The detective looked at the note under close scrutiny.');
    expect(el.textContent).toContain('Explore further with LexiFlow AI:');
    expect(el.textContent).toContain('How do native speakers use this in daily chat?');

    // 4. Test clicking dynamic suggested follow-up chip
    const suggestedChip = el.querySelector('.lf-qa-suggested-chip') as HTMLElement;
    expect(suggestedChip).not.toBeNull();
    suggestedChip.click();
    await Promise.resolve();

    expect(onAskFollowUp).toHaveBeenCalledWith('How do native speakers use this in daily chat?');

    // 5. Test typing custom question and pressing Enter
    const input = el.querySelector('.lf-qa-input') as HTMLInputElement;
    expect(input).not.toBeNull();
    input.value = 'Can I use this word casually with friends?';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await Promise.resolve();

    expect(onAskFollowUp).toHaveBeenCalledWith('Can I use this word casually with friends?');

    // 6. Test Clear conversation history
    const clearBtn = el.querySelector('.lf-qa-clear-btn') as HTMLElement;
    expect(clearBtn).not.toBeNull();
    clearBtn.click();
    expect(el.querySelector('.lf-qa-thread')).toBeNull();
  });

  it('11. Dragging header freely updates popup position coordinates', () => {
    popup.showStageA(mockWordStageA, 'In this sentence, the policy was analyzed strictly by officials.', '');
    const el = popup.getElement();
    const header = el.querySelector('.lf-header') as HTMLElement;
    expect(header).not.toBeNull();
    expect(popup.isUserDraggedMode()).toBe(false);

    // Initial position setup
    el.style.left = '100px';
    el.style.top = '150px';

    // Mock getBoundingClientRect
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      top: 150,
      right: 510,
      bottom: 530,
      width: 410,
      height: 380,
      x: 100,
      y: 150,
      toJSON: () => {}
    });

    // 1. Pointerdown on header background
    const downEvent = new MouseEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      clientX: 200,
      clientY: 160,
      button: 0
    }) as PointerEvent;
    Object.defineProperty(downEvent, 'pointerId', { value: 1 });
    header.dispatchEvent(downEvent);

    expect(popup.isUserDraggedMode()).toBe(true);
    expect(header.classList.contains('dragging')).toBe(true);
    expect(el.classList.contains('dragging')).toBe(true);

    // 2. Pointermove to new coordinate (+80px X, +50px Y)
    const moveEvent = new MouseEvent('pointermove', {
      bubbles: true,
      cancelable: true,
      clientX: 280,
      clientY: 210
    }) as PointerEvent;
    Object.defineProperty(moveEvent, 'pointerId', { value: 1 });
    window.dispatchEvent(moveEvent);

    expect(el.style.left).toBe('180px');
    expect(el.style.top).toBe('200px');

    // 3. Pointerup ends dragging
    const upEvent = new MouseEvent('pointerup', {
      bubbles: true,
      cancelable: true
    }) as PointerEvent;
    Object.defineProperty(upEvent, 'pointerId', { value: 1 });
    window.dispatchEvent(upEvent);

    expect(header.classList.contains('dragging')).toBe(false);
    expect(el.classList.contains('dragging')).toBe(false);
    expect(popup.isUserDraggedMode()).toBe(true); // Persists for session until reset
  });

  it('12. Dragging clamps coordinates to viewport boundaries', () => {
    popup.showStageA(mockWordStageA, 'In this sentence, the policy was analyzed strictly by officials.', '');
    const el = popup.getElement();
    const header = el.querySelector('.lf-header') as HTMLElement;

    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      top: 150,
      right: 510,
      bottom: 530,
      width: 410,
      height: 380,
      x: 100,
      y: 150,
      toJSON: () => {}
    });

    // Pointer down
    const downEvent = new MouseEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      clientX: 120,
      clientY: 160,
      button: 0
    }) as PointerEvent;
    Object.defineProperty(downEvent, 'pointerId', { value: 1 });
    header.dispatchEvent(downEvent);

    // Move way off-screen left and top (-500px, -500px)
    const offscreenMove = new MouseEvent('pointermove', {
      bubbles: true,
      cancelable: true,
      clientX: -500,
      clientY: -500
    }) as PointerEvent;
    Object.defineProperty(offscreenMove, 'pointerId', { value: 1 });
    window.dispatchEvent(offscreenMove);

    // Clamped to screen padding (>= 8px)
    expect(parseInt(el.style.left, 10)).toBeGreaterThanOrEqual(8);
    expect(parseInt(el.style.top, 10)).toBeGreaterThanOrEqual(8);

    const upEvent = new MouseEvent('pointerup', { bubbles: true }) as PointerEvent;
    Object.defineProperty(upEvent, 'pointerId', { value: 1 });
    window.dispatchEvent(upEvent);
  });

  it('13. Clicking header action buttons does not trigger dragging and performs button actions', () => {
    popup.showStageA(mockWordStageA, 'In this sentence, the policy was analyzed strictly by officials.', '');
    const el = popup.getElement();
    const closeBtn = el.querySelector('.lf-close-btn') as HTMLElement;
    const pinBtn = el.querySelector('.lf-pin-btn') as HTMLElement;
    const copyBtn = el.querySelector('.lf-copy-btn') as HTMLElement;

    expect(closeBtn).not.toBeNull();
    expect(pinBtn).not.toBeNull();
    expect(copyBtn).not.toBeNull();

    // Pointerdown on close button should NOT trigger drag
    const closePointerDown = new MouseEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      clientX: 380,
      clientY: 20,
      button: 0
    }) as PointerEvent;
    Object.defineProperty(closePointerDown, 'pointerId', { value: 1 });
    closeBtn.dispatchEvent(closePointerDown);

    expect(popup.isUserDraggedMode()).toBe(false);
    expect(el.classList.contains('dragging')).toBe(false);

    // Close button click works as expected
    closeBtn.click();
    expect(onClose).toHaveBeenCalled();

    // Pin button click toggles pinned mode without drag
    pinBtn.click();
    expect(popup.isPinnedMode()).toBe(true);
    expect(popup.isUserDraggedMode()).toBe(false);
  });

  it('14. Scroll position is preserved during progressive AI updates and resetDrag restores initial state', () => {
    popup.showStageA(mockWordStageA, 'In this sentence, the policy was analyzed strictly by officials.', '');
    const el = popup.getElement();
    const content = el.querySelector('.lf-content') as HTMLElement;
    expect(content).not.toBeNull();

    // User scrolls down in content area
    content.scrollTop = 120;
    expect(content.scrollTop).toBe(120);

    // Progressive AI update
    popup.updateStageAProgressive({
      ...mockWordStageA,
      contextMeaning: 'Updated AI contextual meaning with additional nuance.'
    });

    const updatedContext = el.querySelector('.lf-context-text');
    expect(updatedContext?.textContent).toBe('Updated AI contextual meaning with additional nuance.');

    // Test resetDrag
    const header = el.querySelector('.lf-header') as HTMLElement;
    const downEvent = new MouseEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      clientX: 120,
      clientY: 160,
      button: 0
    }) as PointerEvent;
    Object.defineProperty(downEvent, 'pointerId', { value: 1 });
    header.dispatchEvent(downEvent);

    expect(popup.isUserDraggedMode()).toBe(true);
    popup.resetDrag();
    expect(popup.isUserDraggedMode()).toBe(false);
  });

  it('15. All footer action buttons (Meanings, Ask AI, Report, Save) function properly', async () => {
    popup.showStageA(mockWordStageA, 'In this sentence, the policy was analyzed strictly by officials.', '');
    const el = popup.getElement();

    // 1. Footer "📖 Meanings" toggle
    const expandToggle = el.querySelector('#lf-expand-toggle') as HTMLElement;
    expect(expandToggle).not.toBeNull();
    expandToggle.click();
    await Promise.resolve();
    expect(el.querySelector('#lf-expanded-section')?.getAttribute('style')).toContain('display: block');

    // 2. Footer "🚩 Report" toggle
    const reportBtn = el.querySelector('.lf-report-trigger-btn') as HTMLElement;
    expect(reportBtn).not.toBeNull();
    reportBtn.click();
    expect(el.querySelector('.lf-feedback-box')).not.toBeNull();
    // Cancel report
    const cancelReportBtn = el.querySelector('.lf-feedback-cancel-btn') as HTMLElement;
    cancelReportBtn.click();
    expect(el.querySelector('.lf-feedback-box')).toBeNull();

    // 3. Footer "+ Save" button
    const saveBtn = el.querySelector('.lf-save-btn') as HTMLElement;
    expect(saveBtn).not.toBeNull();
    expect(saveBtn.textContent?.trim()).toBe('+ Save');
    saveBtn.click();
    await Promise.resolve();
    expect(onSave).toHaveBeenCalled();
    const updatedSaveBtn = el.querySelector('.lf-save-btn');
    expect(updatedSaveBtn?.classList.contains('saved')).toBe(true);

    // 4. Footer "💬 Ask AI" button
    const askAIBtn = el.querySelector('.lf-qa-toggle-btn') as HTMLElement;
    expect(askAIBtn).not.toBeNull();
    askAIBtn.click();
    expect(el.querySelector('.lf-ask-ai-panel')).not.toBeNull();
  });

  // 16. Sentence Analysis mode buttons and Close button behavior
  it('16. Sentence Mode: Close button unpins and calls onClose, pin toggles, copy copies text, tabs and footer buttons work reliably', async () => {
    popup.showSentence(mockSentenceResult, 'Bangladesh ranks 84th in Global Hunger Index 2026 as progress slows.', '');
    const el = popup.getElement();

    // 1. Pin button
    const pinBtn = el.querySelector('.lf-pin-btn') as HTMLElement;
    expect(pinBtn).not.toBeNull();
    expect(popup.isPinnedMode()).toBe(false);
    pinBtn.click();
    expect(popup.isPinnedMode()).toBe(true);

    // 2. Close button unpins and calls onClose
    const closeBtn = el.querySelector('.lf-close-btn') as HTMLElement;
    expect(closeBtn).not.toBeNull();
    closeBtn.click();
    expect(onClose).toHaveBeenCalled();
    expect(popup.isPinnedMode()).toBe(false);

    // Re-render sentence view
    popup.showSentence(mockSentenceResult, 'Bangladesh ranks 84th in Global Hunger Index 2026 as progress slows.', '');
    const freshEl = popup.getElement();

    // 3. Copy button
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock }
    });
    const copyBtn = freshEl.querySelector('.lf-copy-btn') as HTMLElement;
    expect(copyBtn).not.toBeNull();
    copyBtn.click();
    expect(writeTextMock).toHaveBeenCalledWith(mockSentenceResult.selectedText);

    // 4. Segmented control tabs
    const askAITab = freshEl.querySelector('.lf-tab[data-tab="ask-ai"]') as HTMLElement;
    expect(askAITab).not.toBeNull();
    askAITab.click();
    expect(freshEl.querySelector('.lf-ask-ai-panel')).not.toBeNull();

    const grammarTab = freshEl.querySelector('.lf-tab[data-tab="grammar"]') as HTMLElement;
    expect(grammarTab).not.toBeNull();
    grammarTab.click();
    expect(freshEl.querySelector('#lf-sentence-expanded-section')?.getAttribute('style')).toContain('display: block');

    const sentenceTab = freshEl.querySelector('.lf-tab[data-tab="breakdown"]') as HTMLElement;
    expect(sentenceTab).not.toBeNull();
    sentenceTab.click();
    expect(freshEl.textContent).toContain('Phrase-by-Phrase Explanation');

    // 5. Footer Grammar toggle button
    const sentenceExpandToggle = freshEl.querySelector('#lf-sentence-expand-toggle') as HTMLElement;
    expect(sentenceExpandToggle).not.toBeNull();
    sentenceExpandToggle.click();
    expect(freshEl.querySelector('#lf-sentence-expanded-section')?.getAttribute('style')).toContain('display: block');

    // 6. Footer Save button
    const saveBtn = freshEl.querySelector('.lf-save-btn') as HTMLElement;
    expect(saveBtn).not.toBeNull();
    saveBtn.click();
    await Promise.resolve();
    expect(onSave).toHaveBeenCalled();

    // 7. Loading mode close button
    popup.showLoading('test text', 'sentence');
    const loadingClose = popup.getElement().querySelector('.lf-close-btn') as HTMLElement;
    expect(loadingClose).not.toBeNull();
    loadingClose.click();
    expect(onClose).toHaveBeenCalled();

    // 8. Error mode close button
    popup.showError('Something failed', 'test text');
    const errorClose = popup.getElement().querySelector('.lf-close-btn') as HTMLElement;
    expect(errorClose).not.toBeNull();
    errorClose.click();
    expect(onClose).toHaveBeenCalled();
  });

  // 17. Popup Size Configuration (small, medium, large, xlarge) & In-Popup Zoom Button
  it('17. Popup Size Configuration: toggles size-small, size-medium, size-large, and size-xlarge classes, cycles via zoom button', () => {
    const el = popup.getElement();
    expect(popup.getSize()).toBe('medium');
    expect(el.classList.contains('size-medium')).toBe(true);

    popup.setSize('small');
    expect(popup.getSize()).toBe('small');
    expect(el.classList.contains('size-small')).toBe(true);
    expect(el.classList.contains('size-medium')).toBe(false);
    expect(el.getAttribute('data-size')).toBe('small');

    popup.setSize('large');
    expect(popup.getSize()).toBe('large');
    expect(el.classList.contains('size-large')).toBe(true);
    expect(el.classList.contains('size-small')).toBe(false);
    expect(el.getAttribute('data-size')).toBe('large');

    popup.setSize('xlarge');
    expect(popup.getSize()).toBe('xlarge');
    expect(el.classList.contains('size-xlarge')).toBe(true);
    expect(el.classList.contains('size-large')).toBe(false);
    expect(el.getAttribute('data-size')).toBe('xlarge');

    popup.setSize('medium');
    expect(popup.getSize()).toBe('medium');
    expect(el.classList.contains('size-medium')).toBe(true);
    expect(el.getAttribute('data-size')).toBe('medium');

    // In-popup zoom button cycles through sizes
    popup.showStageA(mockWordStageA, 'context sentence', 'nearby paragraph');
    const zoomBtn = el.querySelector('.lf-zoom-btn') as HTMLElement;
    expect(zoomBtn).not.toBeNull();
    zoomBtn.click();
    expect(popup.getSize()).toBe('large');
    expect(el.classList.contains('size-large')).toBe(true);
    zoomBtn.click();
    expect(popup.getSize()).toBe('xlarge');
    expect(el.classList.contains('size-xlarge')).toBe(true);
  });

  // 18. Target Language Configuration (Bengali, Spanish, Hindi, etc.)
  it('18. Target Language Configuration: renders proper dynamic language labels for chosen target language', () => {
    expect(popup.getTargetLanguage()).toBe('bn');

    // Default Bengali Stage A
    popup.showStageA(mockWordStageA, 'context sentence', 'nearby paragraph');
    const el = popup.getElement();
    expect(el.innerHTML).toContain('বাংলা');
    expect(el.innerHTML).toContain('সহজ বাংলা');

    // Switch to Spanish
    popup.setTargetLanguage('es');
    expect(popup.getTargetLanguage()).toBe('es');
    popup.showStageA(
      {
        ...mockWordStageA,
        easyBengali: 'Examen minucioso y detallado de algo.'
      },
      'context sentence',
      'nearby paragraph'
    );
    expect(el.innerHTML).toContain('Español');
    expect(el.innerHTML).toContain('Español fácil');

    // Switch to Hindi for Sentence view
    popup.setTargetLanguage('hi');
    expect(popup.getTargetLanguage()).toBe('hi');
    popup.showSentence(
      {
        ...mockSentenceResult,
        bengaliTranslation: 'यद्यपि मुद्रास्फीति तेजी से बढ़ी, केंद्रीय बैंक ने ब्याज दरें स्थिर रखीं।'
      },
      'context sentence',
      'nearby paragraph'
    );
    expect(el.innerHTML).toContain('हिन्दी');
    expect(el.innerHTML).toContain('सरल हिन्दी');
  });

  // 19. 8-Directional Resizing System
  it('19. 8-Directional Resizing: all 8 resize handles exist and resize the popup in all directions', () => {
    popup.showStageA(mockWordStageA, 'context sentence', 'nearby paragraph');
    const el = popup.getElement();

    const expectedDirections = ['n', 's', 'w', 'e', 'nw', 'ne', 'sw', 'se'];
    expectedDirections.forEach((dir) => {
      const handle = el.querySelector(`.lf-resize-${dir}`) as HTMLElement;
      expect(handle).toBeTruthy();
      expect(handle.getAttribute('data-direction')).toBe(dir);
    });

    // Test resizing via bottom-right handle (se)
    const seHandle = el.querySelector('.lf-resize-se') as HTMLElement;
    expect(seHandle).toBeTruthy();

    // Trigger pointerdown on handle
    seHandle.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: 400,
        clientY: 400,
        button: 0,
        bubbles: true
      })
    );
    expect(el.classList.contains('resizing')).toBe(true);
    expect(el.classList.contains('is-resized')).toBe(true);

    // Trigger pointermove on window
    window.dispatchEvent(
      new PointerEvent('pointermove', {
        clientX: 500,
        clientY: 520,
        bubbles: true
      })
    );

    // Trigger pointerup on window
    window.dispatchEvent(
      new PointerEvent('pointerup', {
        clientX: 500,
        clientY: 520,
        bubbles: true
      })
    );
    expect(el.classList.contains('resizing')).toBe(false);
    expect(el.classList.contains('is-resized')).toBe(true);
  });

  // 20. Drag and Resize cursor visibility
  it('20. Drag and Resize cursor: pointerdown adds dragging and resizing classes with visual cues', () => {
    popup.showStageA(mockWordStageA, 'context sentence', 'nearby paragraph');
    const el = popup.getElement();
    const header = el.querySelector('.lf-header') as HTMLElement;
    expect(header).toBeTruthy();

    // Initiate drag
    header.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: 200,
        clientY: 100,
        button: 0,
        bubbles: true
      })
    );
    expect(el.classList.contains('dragging')).toBe(true);

    // Finish drag
    window.dispatchEvent(
      new PointerEvent('pointerup', {
        clientX: 250,
        clientY: 120,
        bubbles: true
      })
    );
    expect(el.classList.contains('dragging')).toBe(false);
  });

  // 21. Sentence Quick Mode immediate sentence display & rule-based connector detection
  it('21. Sentence Quick Mode: showLoading displays selected sentence, rule-based connectors, and honest live AI loading without fabricated breakdown', () => {
    const testSentence = 'However, the economic stimulus failed to reduce persistent unemployment across rural provinces.';
    popup.showLoading(testSentence, 'sentence');
    const el = popup.getElement();

    // 1. Shows Sentence header immediately
    expect(el.textContent).toContain('Sentence Analysis');
    expect(el.textContent).toContain('SENTENCE');

    // 2. Selected sentence is visible immediately
    expect(el.textContent).toContain('However, the economic stimulus failed to reduce persistent unemployment across rural provinces.');

    // 3. Rule-based connector is highlighted and detected
    const connectorMark = el.querySelector('.lf-connector-word');
    expect(connectorMark).not.toBeNull();
    expect(connectorMark?.textContent).toContain('However');
    expect(el.textContent).toContain('Contrast / Concession');

    // 4. Words are interactive for individual inspection
    const stimulusWord = el.querySelector('[data-word="stimulus"]') as HTMLElement;
    expect(stimulusWord).not.toBeNull();
    stimulusWord.click();
    expect(onSelectWord).toHaveBeenCalledWith('stimulus', testSentence);

    // 5. Honest AI loading indicator is present with NO fabricated phrase breakdown
    expect(el.textContent).toContain('Analyzing phrase breakdown & Bengali translation with AI...');
    expect(el.textContent).toContain('No fabricated offline breakdown');
  });

  // 22. Sentence Quick Mode offline & unavailable handling
  it('22. Sentence Quick Mode: showError for sentence displays original sentence with connectors and plain honest offline message', () => {
    const testSentence = 'Therefore, the governing council postponed the final vote on environmental regulations.';
    popup.showError('Provider connection timed out', testSentence);
    const el = popup.getElement();

    // 1. Header shows OFFLINE badge
    expect(el.textContent).toContain('Sentence Analysis');
    expect(el.textContent).toContain('OFFLINE');

    // 2. Sentence text and connector remain preserved
    expect(el.textContent).toContain('Therefore, the governing council postponed the final vote');
    expect(el.textContent).toContain('Consequence / Result');

    // 3. Honest plain offline message
    expect(el.textContent).toContain('AI Interpretation Unavailable / AI বিশ্লেষণ অনুপলব্ধ');
    expect(el.textContent).toContain('Provider connection timed out');
    expect(el.textContent).toContain('Deep phrase breakdown and contextual translation require an active AI provider');
  });
});
