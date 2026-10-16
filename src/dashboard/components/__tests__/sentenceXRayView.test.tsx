import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SentenceXRayView } from '../SentenceXRayView';

describe('SentenceXRayView Component Resilience', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    vi.restoreAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('renders initial form properly', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(<SentenceXRayView />);
    });

    expect(container.textContent).toContain('Sentence X-Ray');
    expect(container.textContent).toContain('Analyze Sentence Structures');
  });

  it('handles background EXPLAIN_SENTENCE response safely even when grammaticalFeatures is missing without crashing', async () => {
    const mockSendMessage = vi.fn((msg: any, callback: (res: any) => void) => {
      if (msg.type === 'EXPLAIN_SENTENCE') {
        callback({
          success: true,
          data: {
            sentence: msg.payload.sentence,
            bengaliTranslation: 'বৈশ্বিক সরবরাহ শৃঙ্খল বিঘ্নিত হওয়া সত্ত্বেও ওষুধ কোম্পানি তাদের উৎপাদনের লক্ষ্যমাত্রা বজায় রেখেছে।',
            paraphrase: 'The drug company met its production goals despite global supply issues.',
            clauses: [
              {
                text: 'Despite growing concerns regarding global supply chain disruptions',
                type: 'subordinate',
                role: 'Adverbial Prepositional Phrase / Clause',
                explanationBengali: 'বৈশ্বিক সরবরাহ বিঘ্ন সম্পর্কিত উদ্বেগ প্রকাশ করছে'
              },
              {
                text: 'the pharmaceutical company maintained its production targets',
                type: 'main',
                role: 'Main Clause',
                explanationBengali: 'মূল বক্তব্য: কোম্পানি লক্ষ্যমাত্রা বজায় রেখেছে'
              }
            ],
            phraseBreakdown: [
              {
                phrase: 'growing concerns',
                easyEnglish: 'increasing worries or problems',
                easyBengali: 'ক্রমবর্ধমান উদ্বেগ'
              }
            ],
            // grammaticalFeatures intentionally omitted/undefined
            grammaticalHighlights: ['Concessive clause using "Despite"', 'Complex sentence structure'],
            toneAndRegister: 'Formal / Business English'
          }
        });
      }
    });

    (global as any).chrome = {
      runtime: {
        sendMessage: mockSendMessage
      }
    };

    const root = createRoot(container);
    await act(async () => {
      root.render(<SentenceXRayView />);
    });

    const button = container.querySelector('button.btn-primary') as HTMLButtonElement;
    expect(button).toBeDefined();

    await act(async () => {
      button.click();
    });

    expect(container.textContent).toContain('Natural Bengali Translation:');
    expect(container.textContent).toContain('বৈশ্বিক সরবরাহ শৃঙ্খল');
    expect(container.textContent).toContain('Syntactic Clause Breakdown:');
    expect(container.textContent).toContain('Phrase-by-Phrase Breakdown:');
    expect(container.textContent).toContain('growing concerns');
    expect(container.textContent).toContain('Formal / Business English');
  });

  it('displays error gracefully when background service worker fails without white-screening', async () => {
    const mockSendMessage = vi.fn((_msg: any, callback: (res: any) => void) => {
      callback({
        success: false,
        error: 'API quota exceeded or network timeout.'
      });
    });

    (global as any).chrome = {
      runtime: {
        sendMessage: mockSendMessage
      }
    };

    const root = createRoot(container);
    await act(async () => {
      root.render(<SentenceXRayView />);
    });

    const button = container.querySelector('button.btn-primary') as HTMLButtonElement;
    await act(async () => {
      button.click();
    });

    expect(container.textContent).toContain('API quota exceeded or network timeout.');
  });
});
