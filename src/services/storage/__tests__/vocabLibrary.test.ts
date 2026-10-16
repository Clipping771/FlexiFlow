import { describe, it, expect, beforeEach } from 'vitest';
import { StorageService } from '../db';
import { VocabularyItem } from '../../../types';
import { FSRSEngine } from '../../fsrs/engine';
import { WeaknessDetector } from '../../weakness/detector';

describe('Advanced Vocabulary Library & Persistence', () => {
  beforeEach(() => {
    StorageService.clearMemory();
  });

  const createItem = (id: string, word: string, overrides: Partial<VocabularyItem> = {}): VocabularyItem => ({
    id,
    word,
    selectionType: 'word',
    meaning: `Meaning of ${word}`,
    definition: `Definition of ${word}`,
    bengaliMeaning: `বাংলা অর্থ ${word}`,
    dateAdded: '2026-01-01T00:00:00.000Z',
    tags: ['academic'],
    collection: 'General',
    difficulty: 'medium',
    starred: false,
    fsrs: FSRSEngine.createInitialState(),
    ...overrides
  });

  it('stars and unstars a word with persistent state', async () => {
    const item = createItem('vocab_1', 'scrutiny', { starred: false });
    await StorageService.saveItem(item);

    let retrieved = await StorageService.getItem('vocab_1');
    expect(retrieved?.starred).toBe(false);

    // Toggle star to true
    item.starred = true;
    await StorageService.saveItem(item);

    retrieved = await StorageService.getItem('vocab_1');
    expect(retrieved?.starred).toBe(true);

    // Toggle star to false
    item.starred = false;
    await StorageService.saveItem(item);

    retrieved = await StorageService.getItem('vocab_1');
    expect(retrieved?.starred).toBe(false);
  });

  it('filters correctly by Starred, Due for Review, and Difficult', async () => {
    const now = new Date();
    const pastDate = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const futureDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const item1 = createItem('item_1', 'scrutiny', {
      starred: true,
      fsrs: { ...FSRSEngine.createInitialState(), nextReview: pastDate } // due
    });

    const item2 = createItem('item_2', 'mitigate', {
      starred: false,
      difficulty: 'hard',
      isMarkedDifficult: true,
      fsrs: { ...FSRSEngine.createInitialState(), nextReview: futureDate } // not due, difficult
    });

    const item3 = createItem('item_3', 'ubiquitous', {
      starred: true,
      fsrs: { ...FSRSEngine.createInitialState(), nextReview: futureDate } // not due, starred
    });

    await StorageService.saveItem(item1);
    await StorageService.saveItem(item2);
    await StorageService.saveItem(item3);

    const all = await StorageService.getAllItems();
    expect(all.length).toBe(3);

    // Starred filter
    const starred = all.filter((i) => i.starred);
    expect(starred.length).toBe(2);
    expect(starred.map((i) => i.word).sort()).toEqual(['scrutiny', 'ubiquitous']);

    // Due filter
    const due = all.filter((i) => FSRSEngine.isDue(i.fsrs, now));
    expect(due.length).toBe(1);
    expect(due[0].word).toBe('scrutiny');

    // Difficult filter
    const difficult = all.filter(
      (i) => i.isMarkedDifficult || i.difficulty === 'hard' || WeaknessDetector.calculateWeakness(i).score >= 35
    );
    expect(difficult.length).toBe(1);
    expect(difficult[0].word).toBe('mitigate');
  });

  it('combines filters with multi-field search and sorting', async () => {
    const item1 = createItem('item_1', 'alleviate', {
      dateAdded: '2026-01-01T00:00:00.000Z',
      meaning: 'Make less severe or painful',
      notes: 'Synonym of mitigate'
    });
    const item2 = createItem('item_2', 'scrutiny', {
      dateAdded: '2026-01-03T00:00:00.000Z',
      meaning: 'Careful observation',
      notes: 'Important for legal texts'
    });
    const item3 = createItem('item_3', 'ubiquitous', {
      dateAdded: '2026-01-02T00:00:00.000Z',
      meaning: 'Omnipresent everywhere'
    });

    await StorageService.saveItem(item1);
    await StorageService.saveItem(item2);
    await StorageService.saveItem(item3);

    const all = await StorageService.getAllItems();

    // Search query matching notes
    const searchNotes = all.filter((i) => (i.notes || '').toLowerCase().includes('legal'));
    expect(searchNotes.length).toBe(1);
    expect(searchNotes[0].word).toBe('scrutiny');

    // Alphabetical sort
    const alphabetical = [...all].sort((a, b) => a.word.localeCompare(b.word));
    expect(alphabetical.map((i) => i.word)).toEqual(['alleviate', 'scrutiny', 'ubiquitous']);

    // Recent sort
    const recent = [...all].sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime());
    expect(recent.map((i) => i.word)).toEqual(['scrutiny', 'ubiquitous', 'alleviate']);
  });

  it('exports and safely imports data while preventing duplicate entries', async () => {
    const item1 = createItem('v1', 'resilient', { meaning: 'Able to recover quickly' });
    await StorageService.saveItem(item1);

    const exportedJson = await StorageService.exportData();
    expect(exportedJson).toContain('resilient');

    // Re-importing exact same export should NOT create duplicates
    const res = await StorageService.importData(exportedJson);
    expect(res.imported).toBe(1);

    const allAfter = await StorageService.getAllItems();
    expect(allAfter.length).toBe(1);
    expect(allAfter[0].word).toBe('resilient');
  });

  it('safely handles legacy records with missing optional fields during import', async () => {
    const legacyExport = JSON.stringify({
      vocabulary: [
        {
          id: 'legacy_1',
          word: 'ephemeral'
          // missing fsrs, missing difficulty, missing dateAdded
        }
      ]
    });

    const res = await StorageService.importData(legacyExport);
    expect(res.imported).toBe(1);

    const item = await StorageService.getItem('legacy_1');
    expect(item).not.toBeNull();
    expect(item?.word).toBe('ephemeral');
    expect(item?.fsrs).toBeDefined();
    expect(item?.fsrs.state).toBe('new');
    expect(item?.collection).toBe('General');
  });
});
