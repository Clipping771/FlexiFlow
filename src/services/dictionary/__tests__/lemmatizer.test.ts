import { describe, it, expect } from 'vitest';
import { getCandidateLemmas } from '../lemmatizer';

describe('Morphological Lemmatizer (Stage 7)', () => {
  it('handles regular plural inflections (-ies, -es, -s)', () => {
    expect(getCandidateLemmas('subsidies')).toContain('subsidy');
    expect(getCandidateLemmas('disparities')).toContain('disparity');
    expect(getCandidateLemmas('vulnerabilities')).toContain('vulnerability');
    expect(getCandidateLemmas('reforms')).toContain('reform');
    expect(getCandidateLemmas('protocols')).toContain('protocol');
    expect(getCandidateLemmas('economists')).toContain('economist');
  });

  it('handles present participle / gerund inflections (-ing)', () => {
    expect(getCandidateLemmas('mitigating')).toContain('mitigate');
    expect(getCandidateLemmas('smuggling')).toContain('smuggle');
    expect(getCandidateLemmas('rethinking')).toContain('rethink');
    expect(getCandidateLemmas('running')).toContain('run');
  });

  it('handles past tense and participle inflections (-ed)', () => {
    expect(getCandidateLemmas('reformed')).toContain('reform');
    expect(getCandidateLemmas('allocated')).toContain('allocate');
    expect(getCandidateLemmas('subsidized')).toContain('subsidize');
  });

  it('handles irregular verbs and irregular plurals', () => {
    expect(getCandidateLemmas('led')).toContain('lead');
    expect(getCandidateLemmas('sought')).toContain('seek');
    expect(getCandidateLemmas('bought')).toContain('buy');
    expect(getCandidateLemmas('analyses')).toContain('analysis');
    expect(getCandidateLemmas('crises')).toContain('crisis');
    expect(getCandidateLemmas('criteria')).toContain('criterion');
  });

  it('handles British and American spelling variants', () => {
    expect(getCandidateLemmas('fertiliser')).toContain('fertilizer');
    expect(getCandidateLemmas('fertilizer')).toContain('fertiliser');
    expect(getCandidateLemmas('subsidise')).toContain('subsidize');
    expect(getCandidateLemmas('labour')).toContain('labor');
  });

  it('handles adverbs (-ly)', () => {
    expect(getCandidateLemmas('substantially')).toContain('substantial');
    expect(getCandidateLemmas('rigorously')).toContain('rigorous');
  });

  it('handles contractions gracefully', () => {
    expect(getCandidateLemmas("doesn't")).toContain('does not');
    expect(getCandidateLemmas("won't")).toContain('will not');
  });
});
