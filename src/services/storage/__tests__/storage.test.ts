import { describe, it, expect, beforeEach } from 'vitest';
import { StorageService } from '../db';
import { VocabularyItem } from '../../../types';
import { FSRSEngine } from '../../fsrs/engine';

describe('StorageService (IndexedDB & Fallback)', () => {
  const sampleItem: VocabularyItem = {
    id: 'vocab_test_1',
    word: 'scrutiny',
    selectionType: 'word',
    meaning: 'Critical observation or examination.',
    partOfSpeech: 'noun',
    definition: 'Critical observation or examination.',
    bengaliMeaning: 'পুঙ্খানুপুঙ্খ পরীক্ষা',
    dateAdded: new Date().toISOString(),
    tags: ['academic'],
    collection: 'Academic English',
    difficulty: 'medium',
    fsrs: FSRSEngine.createInitialState()
  };

  it('saves and retrieves a vocabulary item', async () => {
    await StorageService.saveItem(sampleItem);
    const found = await StorageService.findByWord('scrutiny');

    expect(found).not.toBeNull();
    expect(found?.word).toBe('scrutiny');
    expect(found?.bengaliMeaning).toBe('পুঙ্খানুপুঙ্খ পরীক্ষা');
  });

  it('exports library to JSON and re-imports safely', async () => {
    await StorageService.saveItem(sampleItem);
    const exportedJson = await StorageService.exportData();
    expect(exportedJson).toContain('scrutiny');

    const result = await StorageService.importData(exportedJson);
    expect(result.imported).toBeGreaterThan(0);
    expect(result.skipped).toBe(0);
  });

  it('deletes an item cleanly', async () => {
    await StorageService.saveItem(sampleItem);
    await StorageService.deleteItem('vocab_test_1');

    const retrieved = await StorageService.getItem('vocab_test_1');
    expect(retrieved).toBeNull();
  });

  it('updates and retrieves user settings with popupSize', async () => {
    const { SettingsService } = await import('../settings');
    const defaults = await SettingsService.getSettings();
    expect(defaults.popupSize).toBe('medium');

    await SettingsService.updateSettings({ popupSize: 'large' });
    const updated = await SettingsService.getSettings();
    expect(updated.popupSize).toBe('large');

    await SettingsService.updateSettings({ popupSize: 'small' });
    const smallSettings = await SettingsService.getSettings();
    expect(smallSettings.popupSize).toBe('small');
  });

  it('updates and retrieves user settings with targetLanguage', async () => {
    const { SettingsService } = await import('../settings');
    const defaults = await SettingsService.getSettings();
    expect(defaults.targetLanguage).toBe('bn');

    await SettingsService.updateSettings({ targetLanguage: 'es' });
    const spanish = await SettingsService.getSettings();
    expect(spanish.targetLanguage).toBe('es');

    await SettingsService.updateSettings({ targetLanguage: 'hi' });
    const hindi = await SettingsService.getSettings();
    expect(hindi.targetLanguage).toBe('hi');
  });

  describe('saveOrUpdate deduplication & FSRS preservation', () => {
    it('creates a new item when word does not exist yet', async () => {
      const newItem: VocabularyItem = {
        id: 'vocab_new_1',
        word: 'resilient',
        selectionType: 'word',
        meaning: 'Able to withstand hardship.',
        bengaliMeaning: 'সহনশীল',
        contextSentence: 'The community was resilient after the flood.',
        dateAdded: new Date().toISOString(),
        tags: ['reading'],
        collection: 'General',
        difficulty: 'medium',
        fsrs: FSRSEngine.createInitialState()
      };

      const saved = await StorageService.saveOrUpdate(newItem);
      expect(saved.id).toBe('vocab_new_1');
      expect(saved.word).toBe('resilient');
      expect(saved.fsrs.reps).toBe(0);

      const found = await StorageService.findByWord('resilient');
      expect(found).not.toBeNull();
      expect(found?.meaning).toBe('Able to withstand hardship.');
    });

    it('updates context and meaning but strictly preserves FSRS learning state when word matches', async () => {
      const matureFSRS = {
        stability: 4.5,
        difficulty: 3.2,
        elapsedDays: 7,
        scheduledDays: 14,
        reps: 5,
        lapses: 0,
        state: 'review' as const,
        lastReview: '2026-03-01T10:00:00.000Z',
        nextReview: '2026-03-15T10:00:00.000Z'
      };

      const existingCard: VocabularyItem = {
        id: 'vocab_existing_mature',
        word: 'mitigate',
        selectionType: 'word',
        meaning: 'Make less severe.',
        bengaliMeaning: 'উপশম করা',
        contextSentence: 'First old context sentence.',
        dateAdded: '2026-02-15T08:00:00.000Z',
        tags: ['academic'],
        collection: 'Academic English',
        difficulty: 'hard',
        fsrs: matureFSRS,
        reviewHistory: [
          { vocabId: 'vocab_existing_mature', rating: 3, reviewDate: '2026-03-01T10:00:00.000Z' }
        ]
      };

      await StorageService.saveItem(existingCard);

      // User encounters the same word in a new context and saves via popup (which creates a new temp id)
      const popupSaveAttempt: VocabularyItem = {
        id: 'vocab_temp_new_id_9999',
        word: 'mitigate',
        selectionType: 'word',
        meaning: 'To lessen in force or intensity.',
        bengaliMeaning: 'হ্রাস করা বা তীব্রতা কমানো',
        contextSentence: 'New technologies help mitigate risks.',
        dateAdded: new Date().toISOString(),
        tags: ['news-article'],
        collection: 'Daily Reading',
        difficulty: 'medium',
        fsrs: FSRSEngine.createInitialState() // popup passes initial blank state!
      };

      const result = await StorageService.saveOrUpdate(popupSaveAttempt);

      // 1. Must retain original stable ID (NOT the temp popup id)
      expect(result.id).toBe('vocab_existing_mature');

      // 2. Must update context sentence and new meaning
      expect(result.contextSentence).toBe('New technologies help mitigate risks.');
      expect(result.meaning).toBe('To lessen in force or intensity.');

      // 3. Must NEVER reset FSRS state!
      expect(result.fsrs.reps).toBe(5);
      expect(result.fsrs.stability).toBe(4.5);
      expect(result.fsrs.state).toBe('review');
      expect(result.fsrs.scheduledDays).toBe(14);
      expect(result.fsrs.nextReview).toBe('2026-03-15T10:00:00.000Z');

      // 4. Must preserve review history
      expect(result.reviewHistory?.length).toBe(1);

      // 5. Must merge tags
      expect(result.tags).toContain('academic');
      expect(result.tags).toContain('news-article');
    });

    it('does not touch or auto-merge other pre-existing duplicate items', async () => {
      // Simulate two pre-existing legacy duplicates with different IDs
      const dup1: VocabularyItem = {
        id: 'legacy_dup_1',
        word: 'tenacious',
        selectionType: 'word',
        meaning: 'Holding fast.',
        bengaliMeaning: 'দৃঢ়চেতা',
        dateAdded: '2026-01-01T00:00:00.000Z',
        tags: [],
        collection: 'General',
        difficulty: 'medium',
        fsrs: FSRSEngine.createInitialState()
      };
      const dup2: VocabularyItem = {
        id: 'legacy_dup_2',
        word: 'tenacious',
        selectionType: 'word',
        meaning: 'Persistent.',
        bengaliMeaning: 'অধ্যবসায়ী',
        dateAdded: '2026-01-05T00:00:00.000Z',
        tags: [],
        collection: 'General',
        difficulty: 'hard',
        fsrs: FSRSEngine.createInitialState()
      };

      await StorageService.saveItem(dup1);
      await StorageService.saveItem(dup2);

      // Verify both items still exist independently (no destructive auto-merge)
      const item1 = await StorageService.getItem('legacy_dup_1');
      const item2 = await StorageService.getItem('legacy_dup_2');
      expect(item1).not.toBeNull();
      expect(item2).not.toBeNull();
      expect(item1?.id).toBe('legacy_dup_1');
      expect(item2?.id).toBe('legacy_dup_2');
    });
  });

  describe('readingMode setting & host localStorage isolation', () => {
    it('defaults readingMode to quick and allows updating to learn', async () => {
      const { SettingsService, DEFAULT_SETTINGS } = await import('../settings');
      expect(DEFAULT_SETTINGS.readingMode).toBe('quick');

      const settings = await SettingsService.getSettings();
      expect(settings.readingMode).toBe('quick');

      await SettingsService.updateSettings({ readingMode: 'learn' });
      const updated = await SettingsService.getSettings();
      expect(updated.readingMode).toBe('learn');

      // Revert to quick
      await SettingsService.updateSettings({ readingMode: 'quick' });
      const reverted = await SettingsService.getSettings();
      expect(reverted.readingMode).toBe('quick');
    });
  });
});
