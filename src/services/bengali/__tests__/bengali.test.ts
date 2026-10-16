import { describe, it, expect } from 'vitest';
import { BengaliService } from '../index';

describe('BengaliService', () => {
  it('returns curated Bengali meaning for core words', () => {
    const result = BengaliService.getMeaning('scrutiny');
    expect(result.isCurated).toBe(true);
    expect(result.bengaliWord).toContain('পুঙ্খানুপুঙ্খ পরীক্ষা');
    expect(result.bengaliExplanation).toBeTruthy();
  });

  it('handles case-insensitive lookups with whitespace', () => {
    const result = BengaliService.getMeaning('  Mitigate  ');
    expect(result.isCurated).toBe(true);
    expect(result.bengaliWord).toContain('উপশম করা');
  });

  it('differentiates context for ambiguous words like "address"', () => {
    const problemContext = BengaliService.getMeaning('address', 'We must address this pressing environmental problem immediately.');
    expect(problemContext.bengaliWord).toContain('সমাধান করা');

    const audienceContext = BengaliService.getMeaning('address', 'The prime minister addressed the vast audience at the summit.');
    expect(audienceContext.bengaliWord).toContain('ভাষণ দেওয়া');
  });

  it('gracefully communicates status for unlisted words', () => {
    const result = BengaliService.getMeaning('unlistedtechnicalterm123');
    expect(result.isCurated).toBe(false);
    expect(result.bengaliWord).toBe('বাংলা অর্থ অনুসন্ধানযোগ্য');
  });
});
