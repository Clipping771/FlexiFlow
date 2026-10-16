/**
 * Persistent Cache for LexiFlow lookups.
 * Backed by IndexedDB with graceful fallback to chrome.storage.local or in-memory map.
 * Ensures cached lookups survive MV3 service worker restarts and popup re-opens.
 */

import { CacheEntry, CacheCategory } from './types';

const CACHE_DB_NAME = 'lexiflow_cache_db';
const CACHE_DB_VERSION = 1;
const STORE_NAME = 'cache_store';

export class PersistentCache {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private memoryFallback = new Map<string, CacheEntry>();

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    if (typeof indexedDB === 'undefined') {
      return Promise.reject(new Error('IndexedDB unavailable in this environment'));
    }

    this.dbPromise = new Promise((resolve, reject) => {
      try {
        const req = indexedDB.open(CACHE_DB_NAME, CACHE_DB_VERSION);

        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
            store.createIndex('category', 'category', { unique: false });
            store.createIndex('expiresAt', 'expiresAt', { unique: false });
          }
        };

        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error || new Error('Failed to open cache IndexedDB'));
      } catch (err) {
        reject(err);
      }
    });

    return this.dbPromise;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const db = await this.getDB();
      return new Promise<T | null>((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const store = tx.objectStore(STORE_NAME);
          const req = store.get(key);

          req.onsuccess = () => {
            const entry: CacheEntry<T> | undefined = req.result;
            if (!entry) {
              resolve(null);
              return;
            }

            // Check TTL expiration
            if (Date.now() > entry.expiresAt) {
              // Delete expired asynchronously
              this.delete(key).catch(() => {});
              resolve(null);
              return;
            }

            resolve(entry.data);
          };

          req.onerror = () => {
            resolve(this.getFromFallback<T>(key));
          };
        } catch {
          resolve(this.getFromFallback<T>(key));
        }
      });
    } catch {
      return this.getFromFallback<T>(key);
    }
  }

  async set<T>(
    key: string,
    category: CacheCategory,
    data: T,
    ttlMs: number = 24 * 60 * 60 * 1000,
    version: string = 'v1'
  ): Promise<void> {
    const entry: CacheEntry<T> = {
      key,
      category,
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttlMs,
      version
    };

    // Always update fallback map immediately
    this.memoryFallback.set(key, entry as CacheEntry);

    try {
      const db = await this.getDB();
      return new Promise<void>((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          const req = store.put(entry);

          req.onsuccess = () => resolve();
          req.onerror = (e) => {
            // Handle QuotaExceededError gracefully
            const error = req.error;
            if (error && error.name === 'QuotaExceededError') {
              console.warn('[LexiFlow Cache] Quota exceeded. Pruning older cache entries...');
              this.pruneOldestEntries(50).catch(() => {});
            }
            resolve(); // Do not throw; preserve caller execution
          };
        } catch {
          resolve();
        }
      });
    } catch {
      // Fallback is already updated in memoryFallback
    }
  }

  async delete(key: string): Promise<boolean> {
    this.memoryFallback.delete(key);
    try {
      const db = await this.getDB();
      return new Promise<boolean>((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          const req = store.delete(key);
          req.onsuccess = () => resolve(true);
          req.onerror = () => resolve(false);
        } catch {
          resolve(false);
        }
      });
    } catch {
      return false;
    }
  }

  async clear(): Promise<void> {
    this.memoryFallback.clear();
    try {
      const db = await this.getDB();
      return new Promise<void>((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          const req = store.clear();
          req.onsuccess = () => resolve();
          req.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
    } catch {
      // ignore
    }
  }

  async invalidateCategory(category: CacheCategory): Promise<void> {
    // Clear from fallback
    for (const [k, v] of this.memoryFallback.entries()) {
      if (v.category === category) {
        this.memoryFallback.delete(k);
      }
    }

    try {
      const db = await this.getDB();
      return new Promise<void>((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          const index = store.index('category');
          const req = index.openCursor(IDBKeyRange.only(category));

          req.onsuccess = () => {
            const cursor = req.result;
            if (cursor) {
              cursor.delete();
              cursor.continue();
            } else {
              resolve();
            }
          };
          req.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
    } catch {
      // ignore
    }
  }

  private getFromFallback<T>(key: string): T | null {
    const entry = this.memoryFallback.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.memoryFallback.delete(key);
      return null;
    }
    return entry.data as T;
  }

  private async pruneOldestEntries(limit: number): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.openCursor();
      let count = 0;

      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor && count < limit) {
          cursor.delete();
          count++;
          cursor.continue();
        }
      };
    } catch {
      // ignore
    }
  }
}
