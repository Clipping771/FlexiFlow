export type CacheCategory = 'dictionary' | 'ai_contextual';

export interface CacheEntry<T = unknown> {
  key: string;
  category: CacheCategory;
  data: T;
  timestamp: number;
  expiresAt: number;
  version: string;
  metadata?: Record<string, unknown>;
}

export interface CacheOptions {
  ttlMs?: number;
  version?: string;
  metadata?: Record<string, unknown>;
}

export interface ICache<T = unknown> {
  get(key: string): Promise<T | null> | (T | null);
  set(key: string, value: T, options?: CacheOptions): Promise<void> | void;
  delete(key: string): Promise<boolean> | boolean;
  clear(): Promise<void> | void;
}
