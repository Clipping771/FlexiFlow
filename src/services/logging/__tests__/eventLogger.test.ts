import { describe, it, expect, beforeEach } from 'vitest';
import { EventLogger } from '../eventLogger';

describe('EventLogger (Privacy-first Telemetry & Daily Aggregates)', () => {
  beforeEach(async () => {
    EventLogger.resetMemoryStore();
    await EventLogger.clearLogs();
  });

  it('records all 5 approved events with strict sanitization', async () => {
    // 1. popup_shown
    const evt1 = await EventLogger.log('popup_shown', {
      selectionType: 'word',
      triggerMode: 'auto_selection',
      readingMode: 'quick'
    });
    expect(evt1.event).toBe('popup_shown');
    expect(evt1.data.selectionType).toBe('word');
    expect(evt1.data.readingMode).toBe('quick');

    // 2. mode_changed
    const evt2 = await EventLogger.log('mode_changed', {
      from: 'quick',
      to: 'learn'
    });
    expect(evt2.event).toBe('mode_changed');
    expect(evt2.data.from).toBe('quick');
    expect(evt2.data.to).toBe('learn');

    // 3. word_saved
    const evt3 = await EventLogger.log('word_saved', {
      selectionType: 'word',
      hasContext: true,
      readingMode: 'learn'
    });
    expect(evt3.event).toBe('word_saved');
    expect(evt3.data.hasContext).toBe(true);

    // 4. review_completed
    const evt4 = await EventLogger.log('review_completed', {
      rating: 3,
      elapsedDays: 2,
      scheduledDays: 5
    });
    expect(evt4.event).toBe('review_completed');
    expect(evt4.data.rating).toBe(3);

    // 5. report_submitted
    const evt5 = await EventLogger.log('report_submitted', {
      reason: 'wrong_meaning',
      hasUserNote: true,
      hasContextSentence: false
    });
    expect(evt5.event).toBe('report_submitted');
    expect(evt5.data.hasUserNote).toBe(true);

    const store = await EventLogger.getStore();
    expect(store.events.length).toBe(5);
  });

  it('strictly rejects any attempts to log text, URLs or personal content', async () => {
    // Attempt to pass malicious/leaked fields in raw payload
    const maliciousPayload = {
      selectionType: 'sentence',
      readingMode: 'quick',
      url: 'https://secret-bank.com/user/123',
      text: 'Confidential client contract text',
      userNote: 'Super private password note'
    } as any;

    const logged = await EventLogger.log('popup_shown', maliciousPayload);
    const dataObj = logged.data as Record<string, any>;

    // Verify sanitization
    expect(dataObj.url).toBeUndefined();
    expect(dataObj.text).toBeUndefined();
    expect(dataObj.userNote).toBeUndefined();
    expect(dataObj.selectionType).toBe('sentence');
    expect(dataObj.readingMode).toBe('quick');
  });

  it('rejects unauthorized event names', async () => {
    await expect(
      EventLogger.log('page_visited' as any, {} as any)
    ).rejects.toThrow(/Unauthorized event/);
  });

  it('increments daily aggregates permanently', async () => {
    await EventLogger.log('popup_shown', { selectionType: 'word', readingMode: 'quick' });
    await EventLogger.log('popup_shown', { selectionType: 'phrase', readingMode: 'learn' });
    await EventLogger.log('word_saved', { selectionType: 'word', hasContext: true });
    await EventLogger.log('review_completed', { rating: 4 });

    const aggregates = await EventLogger.getDailyAggregates();
    expect(aggregates.length).toBe(1);

    const today = aggregates[0];
    expect(today.totals.popup_shown).toBe(2);
    expect(today.totals.word_saved).toBe(1);
    expect(today.totals.review_completed).toBe(1);
    expect(today.breakdowns.popup_by_mode['quick']).toBe(1);
    expect(today.breakdowns.popup_by_mode['learn']).toBe(1);
    expect(today.breakdowns.reviews_by_rating['4']).toBe(1);
  });

  it('exports telemetry as separate clean JSON without sensitive data', async () => {
    await EventLogger.log('popup_shown', { selectionType: 'word', readingMode: 'quick' });
    const jsonStr = await EventLogger.exportLogsAsJson();
    const parsed = JSON.parse(jsonStr);

    expect(parsed.format).toBe('lexiflow_telemetry_export');
    expect(parsed.version).toBe(1);
    expect(parsed.summary.totalRawEvents).toBe(1);
    expect(parsed.events[0].event).toBe('popup_shown');
  });

  it('clears logs and resets state', async () => {
    await EventLogger.log('popup_shown', { selectionType: 'word', readingMode: 'quick' });
    let store = await EventLogger.getStore();
    expect(store.events.length).toBe(1);

    await EventLogger.clearLogs();
    store = await EventLogger.getStore();
    expect(store.events.length).toBe(0);
    expect(Object.keys(store.dailyAggregates).length).toBe(0);
  });
});
