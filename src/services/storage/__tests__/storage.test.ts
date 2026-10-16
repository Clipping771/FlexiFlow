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
});
