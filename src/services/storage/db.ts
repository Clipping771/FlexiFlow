import { VocabularyItem } from '../../types';
import { FSRSEngine } from '../fsrs/engine';

const DB_NAME = 'lexiflow_db';
const DB_VERSION = 1;
const STORE_VOCAB = 'vocabulary';
const STORE_LOGS = 'review_logs';

export class StorageService {
  private static dbPromise: Promise<IDBDatabase> | null = null;
  private static memoryFallback: Map<string, VocabularyItem> = new Map();

  private static getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    if (typeof indexedDB === 'undefined') {
      // In-memory mock if indexedDB is unavailable (e.g. some Node test environments)
      return Promise.reject(new Error('IndexedDB not available'));
    }

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_VOCAB)) {
          const vocabStore = db.createObjectStore(STORE_VOCAB, { keyPath: 'id' });
          vocabStore.createIndex('word', 'word', { unique: false });
          vocabStore.createIndex('collection', 'collection', { unique: false });
          vocabStore.createIndex('dateAdded', 'dateAdded', { unique: false });
          vocabStore.createIndex('nextReview', 'fsrs.nextReview', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORE_LOGS)) {
          const logStore = db.createObjectStore(STORE_LOGS, { keyPath: 'id', autoIncrement: true });
          logStore.createIndex('vocabId', 'vocabId', { unique: false });
          logStore.createIndex('reviewDate', 'reviewDate', { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  static notifyVocabChanged(item?: VocabularyItem): void {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      try {
        chrome.storage.local.set({ lexiflow_vocab_updated_at: Date.now() });
      } catch {}
    }

    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const channel = new BroadcastChannel('lexiflow_vocab_sync');
        channel.postMessage({ type: 'VOCAB_UPDATED', item, timestamp: Date.now() });
        channel.close();
      } catch {}
    }

    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      try {
        chrome.runtime.sendMessage({ type: 'VOCAB_UPDATED', payload: { item, timestamp: Date.now() } }, () => {
          if (chrome.runtime?.lastError) {
            // Ignore when no listener is listening
          }
        });
      } catch {}
    }
  }

  static async saveItem(item: VocabularyItem): Promise<void> {
    try {
      const db = await this.getDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_VOCAB, 'readwrite');
        const store = tx.objectStore(STORE_VOCAB);
        const req = store.put(item);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      this.memoryFallback.set(item.id, item);
    }
    this.notifyVocabChanged(item);
  }

  static async getItem(id: string): Promise<VocabularyItem | null> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_VOCAB, 'readonly');
        const store = tx.objectStore(STORE_VOCAB);
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return this.memoryFallback.get(id) || null;
    }
  }

  static async findByWord(word: string): Promise<VocabularyItem | null> {
    const normalized = word.trim().toLowerCase();
    const all = await this.getAllItems();
    return all.find((item) => item.word.toLowerCase() === normalized) || null;
  }

  static async getAllItems(): Promise<VocabularyItem[]> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_VOCAB, 'readonly');
        const store = tx.objectStore(STORE_VOCAB);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return Array.from(this.memoryFallback.values());
    }
  }

  static async getDueItems(limit?: number): Promise<VocabularyItem[]> {
    const all = await this.getAllItems();
    const now = new Date();
    const due = all.filter((item) => FSRSEngine.isDue(item.fsrs, now));
    
    // Sort by most overdue first
    due.sort((a, b) => new Date(a.fsrs.nextReview).getTime() - new Date(b.fsrs.nextReview).getTime());

    if (limit && limit > 0) {
      return due.slice(0, limit);
    }
    return due;
  }

  static async deleteItem(id: string): Promise<void> {
    try {
      const db = await this.getDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_VOCAB, 'readwrite');
        const store = tx.objectStore(STORE_VOCAB);
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      this.memoryFallback.delete(id);
    }
    this.notifyVocabChanged();
  }

  static async exportData(): Promise<string> {
    const items = await this.getAllItems();
    return JSON.stringify({
      exportVersion: 1,
      exportDate: new Date().toISOString(),
      count: items.length,
      vocabulary: items
    }, null, 2);
  }

  static async importData(jsonData: string): Promise<{ imported: number; skipped: number }> {
    try {
      const parsed = JSON.parse(jsonData);
      const items: VocabularyItem[] = Array.isArray(parsed) ? parsed : parsed.vocabulary || [];
      let imported = 0;
      let skipped = 0;

      const existingItems = await this.getAllItems();
      const existingByWord = new Map<string, VocabularyItem>();
      const existingById = new Map<string, VocabularyItem>();
      for (const ex of existingItems) {
        existingById.set(ex.id, ex);
        existingByWord.set(ex.word.toLowerCase().trim(), ex);
      }

      for (const item of items) {
        if (!item || !item.word || typeof item.word !== 'string') {
          skipped++;
          continue;
        }

        const normWord = item.word.toLowerCase().trim();
        const matched = (item.id && existingById.get(item.id)) || existingByWord.get(normWord);

        // Normalize item ensuring all fields are safely present for legacy records
        const safeItem: VocabularyItem = {
          id: matched ? matched.id : (item.id || `vocab_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`),
          word: item.word.trim(),
          selectionType: item.selectionType || matched?.selectionType || 'word',
          meaning: item.meaning || item.definition || matched?.meaning || '',
          definition: item.definition || item.meaning || matched?.definition || '',
          partOfSpeech: item.partOfSpeech || matched?.partOfSpeech,
          audioUrl: item.audioUrl || matched?.audioUrl,
          bengaliMeaning: item.bengaliMeaning || matched?.bengaliMeaning || '',
          bengaliExplanation: item.bengaliExplanation || matched?.bengaliExplanation,
          contextSentence: item.contextSentence || matched?.contextSentence,
          pageTitle: item.pageTitle || matched?.pageTitle,
          pageUrl: item.pageUrl || matched?.pageUrl,
          dateAdded: item.dateAdded || matched?.dateAdded || new Date().toISOString(),
          tags: Array.isArray(item.tags) ? item.tags : (matched?.tags || []),
          collection: item.collection || matched?.collection || 'General',
          difficulty: item.difficulty || matched?.difficulty || 'medium',
          starred: item.starred !== undefined ? item.starred : (matched?.starred ?? false),
          isMarkedDifficult: item.isMarkedDifficult !== undefined ? item.isMarkedDifficult : (matched?.isMarkedDifficult ?? false),
          dismissedFromWeakness: item.dismissedFromWeakness !== undefined ? item.dismissedFromWeakness : (matched?.dismissedFromWeakness ?? false),
          reviewHistory: Array.isArray(item.reviewHistory) ? item.reviewHistory : (matched?.reviewHistory || []),
          fsrs: item.fsrs || matched?.fsrs || FSRSEngine.createInitialState(),
          notes: item.notes || matched?.notes,
          fullAnalysis: item.fullAnalysis || matched?.fullAnalysis
        };

        await this.saveItem(safeItem);
        existingById.set(safeItem.id, safeItem);
        existingByWord.set(normWord, safeItem);
        imported++;
      }

      return { imported, skipped };
    } catch (err) {
      throw new Error(`Failed to import data: ${(err as Error).message}`);
    }
  }

  static clearMemory(): void {
    this.memoryFallback.clear();
  }
}
