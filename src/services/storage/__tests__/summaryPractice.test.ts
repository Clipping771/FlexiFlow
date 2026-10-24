import { describe, it, expect, beforeEach } from 'vitest';
import { SummaryPracticeService } from '../summaryPractice';
import { parseSummaryEvaluation } from '../../ai/summarySchema';

const evaluation = parseSummaryEvaluation({
  criteria: [
    { id: 'main_idea', score: 3, comment: '' },
    { id: 'key_points', score: 2, comment: '' },
    { id: 'accuracy', score: 2, comment: '' },
    { id: 'expression', score: 1, comment: '' }
  ],
  overallFeedback: 'Good.',
  strengths: [],
  missedPoints: [],
  misunderstandings: [],
  modelSummary: 'Model.'
});

describe('SummaryPracticeService', () => {
  beforeEach(() => SummaryPracticeService._resetMemory());

  it('keeps unsent text when the same article is captured again, and drops it for a new article', async () => {
    await SummaryPracticeService.setDraft({ url: 'https://a.com/story', title: 'Story', text: 'Text' });
    await SummaryPracticeService.saveDraftSummary('half written');
    await SummaryPracticeService.setDraft({ url: 'https://www.a.com/story?utm_source=x', title: 'Story', text: 'Text' });
    expect((await SummaryPracticeService.getDraft())?.summary).toBe('half written');

    await SummaryPracticeService.setDraft({ url: 'https://a.com/other', title: 'Other', text: 'Text' });
    expect((await SummaryPracticeService.getDraft())?.summary).toBeUndefined();
  });

  it('stores marked attempts newest first, per article, and clears the unsent text once marked', async () => {
    await SummaryPracticeService.setDraft({ url: 'https://a.com/story', title: 'Story', text: 'Text' });
    await SummaryPracticeService.saveDraftSummary('my summary');
    const first = await SummaryPracticeService.addAttempt({ articleUrl: 'https://a.com/story', articleTitle: 'Story', summary: 's1', evaluation });
    await new Promise((r) => setTimeout(r, 5));
    const second = await SummaryPracticeService.addAttempt({ articleUrl: 'https://a.com/story#x', articleTitle: 'Story', summary: 's2', evaluation });
    await SummaryPracticeService.addAttempt({ articleUrl: 'https://b.com/x', articleTitle: 'B', summary: 's3', evaluation });

    expect((await SummaryPracticeService.getAttemptsForUrl('https://a.com/story')).map((a) => a.id)).toEqual([second.id, first.id]);
    expect((await SummaryPracticeService.getDraft())?.summary).toBeUndefined();

    await SummaryPracticeService.removeAttempt(first.id);
    expect(await SummaryPracticeService.getAttemptsForUrl('https://a.com/story')).toHaveLength(1);
  });
});
