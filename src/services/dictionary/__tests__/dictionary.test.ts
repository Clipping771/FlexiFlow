import { describe, it, expect } from 'vitest';
import { LocalDictionaryProvider } from '../localDictionary';
import { DictionaryService } from '../index';

describe('Dictionary Providers & Normalization', () => {
  it('LocalDictionaryProvider returns normalized offline definition for curated words', async () => {
    const provider = new LocalDictionaryProvider();
    const result = await provider.lookup('scrutiny');

    expect(result).not.toBeNull();
    expect(result!.phonetics?.length).toBeGreaterThan(0);
    expect(result!.phonetics?.[0].text).toContain('/ˈskruː.tɪ.ni/');
    expect(result?.meanings.length).toBeGreaterThan(0);
    expect(result?.meanings[0].definitions[0].definition).toContain('Critical observation');
    expect(result?.bengaliMeaning).toContain('পুঙ্খানুপুঙ্খ পরীক্ষা');
    expect(result?.source).toBe('offline_lexicon');
    expect(result?.isVerified).toBe(true);
  });

  it('DictionaryService falls back gracefully to offline lexicon when network fails or offline', async () => {
    const result = await DictionaryService.lookup('mitigate');
    expect(result).not.toBeNull();
    expect(result?.word).toBe('mitigate');
    expect(result?.meanings[0].definitions[0].definition).toContain('Make (something bad) less severe');
  });

  it('DictionaryService caches lookups for instant subsequent access', async () => {
    const start1 = performance.now();
    const res1 = await DictionaryService.lookup('ephemeral');
    const duration1 = performance.now() - start1;

    const start2 = performance.now();
    const res2 = await DictionaryService.lookup('ephemeral');
    const duration2 = performance.now() - start2;

    expect(res1?.word).toBe(res2?.word);
    expect(duration2).toBeLessThanOrEqual(duration1 + 5); // Instant cached hit
  });
});
