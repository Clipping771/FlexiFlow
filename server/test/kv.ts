// Minimal in-memory KV for unit tests: the get/put subset the Worker uses.
export interface TestKV {
  kv: KVNamespace;
  store: Map<string, { value: string; ttl?: number }>;
  /** Makes every call throw, to check that KV failures never fail a request. */
  fail: boolean;
}

export function createTestKV(): TestKV {
  const state: TestKV = { kv: null as unknown as KVNamespace, store: new Map(), fail: false };
  state.kv = {
    async get(key: string, type?: string) {
      if (state.fail) throw new Error('KV unavailable');
      const entry = state.store.get(key);
      if (!entry) return null;
      return type === 'json' ? JSON.parse(entry.value) : entry.value;
    },
    async put(key: string, value: string, options?: { expirationTtl?: number }) {
      if (state.fail) throw new Error('KV unavailable');
      state.store.set(key, { value, ttl: options?.expirationTtl });
    }
  } as unknown as KVNamespace;
  return state;
}
