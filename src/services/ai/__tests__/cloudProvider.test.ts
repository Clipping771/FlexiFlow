import { describe, it, expect, vi, beforeEach } from 'vitest';

const authorizedFetch = vi.fn();
vi.mock('../../auth/authService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../auth/authService')>();
  return { ...actual, AuthService: { ...actual.AuthService, authorizedFetch: (...args: unknown[]) => authorizedFetch(...args) } };
});

import { CloudProvider, CloudAIError } from '../cloudProvider';
import { CloudAuthError } from '../../auth/authService';
import { AIService } from '../index';

function reply(status: number, body: unknown) {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
}

function sentBody(call = 0) {
  return JSON.parse(authorizedFetch.mock.calls[call][1].body);
}

beforeEach(() => {
  authorizedFetch.mockReset();
});

describe('CloudProvider', () => {
  it('posts Stage A with a plain language code and returns the data', async () => {
    const data = { selectedText: 'resilient', easyBengali: 'দ্রুত সামলে ওঠা' };
    authorizedFetch.mockResolvedValue(reply(200, { data, usage: { used: 1, limit: 30 }, cached: false }));

    const result = await new CloudProvider('en-bn').analyzeStageA('resilient', 'They remained resilient.', 'para');

    expect(result).toEqual(data);
    expect(authorizedFetch.mock.calls[0][0]).toBe('/v1/ai/stage-a');
    expect(authorizedFetch.mock.calls[0][1].method).toBe('POST');
    expect(sentBody()).toEqual({ text: 'resilient', contextSentence: 'They remained resilient.', paragraphContext: 'para', targetLang: 'bn' });
  });

  it('posts Stage B', async () => {
    authorizedFetch.mockResolvedValue(reply(200, { data: { lemma: 'bank', senses: [] } }));
    await new CloudProvider('bn').analyzeStageB('bank', 'noun', 'sense_2');
    expect(authorizedFetch.mock.calls[0][0]).toBe('/v1/ai/stage-b');
    expect(sentBody()).toEqual({ lemma: 'bank', partOfSpeech: 'noun', contextualSenseId: 'sense_2', targetLang: 'bn' });
  });

  it('turns QUOTA_EXCEEDED into a readable error with the reset time and upgrade link', async () => {
    authorizedFetch.mockResolvedValue(reply(402, {
      error: { code: 'QUOTA_EXCEEDED', message: 'quota', used: 30, limit: 30, resetAt: '2026-10-24T00:00:00+06:00', upgradeUrl: 'https://x/pro' }
    }));

    const err = await new CloudProvider().analyzeStageA('resilient').catch((e) => e);

    expect(err).toBeInstanceOf(CloudAIError);
    expect(err.code).toBe('QUOTA_EXCEEDED');
    expect(err.message).toMatch(/^You've used all 30 of today's LexiFlow credits\. They reset at .+\. Upgrade to Pro for more\.$/);
    expect(err.details).toMatchObject({ resetAt: '2026-10-24T00:00:00+06:00', upgradeUrl: 'https://x/pro' });
  });

  it.each([
    [429, { error: { code: 'RATE_LIMITED', retryAfterSeconds: 12 } }, 'RATE_LIMITED', 'Try again in 12 seconds.'],
    [413, { error: { code: 'INPUT_TOO_LONG', maxChars: 600 } }, 'INPUT_TOO_LONG', 'Select a shorter piece of text.'],
    [400, { error: { code: 'INVALID_REQUEST', message: 'This target language is not available on LexiFlow Cloud yet.' } }, 'INVALID_REQUEST', 'not available on LexiFlow Cloud'],
    [503, { error: { code: 'AI_UNAVAILABLE', message: 'LexiFlow AI is busy right now.' } }, 'AI_UNAVAILABLE', 'busy right now'],
    [503, { error: { code: 'AI_PAUSED', message: 'Pausing new Free lookups for today.', resetAt: '2026-10-24T00:00:00+06:00' } }, 'AI_PAUSED', 'New lookups resume at'],
    [502, '<html>Bad gateway</html>', 'AI_UNAVAILABLE', 'unavailable right now (502)']
  ])('maps HTTP %s to %s', async (status, body, code, text) => {
    authorizedFetch.mockResolvedValue(reply(status, body));
    const err = await new CloudProvider().analyzeStageA('x').catch((e) => e);
    expect(err).toBeInstanceOf(CloudAIError);
    expect(err.code).toBe(code);
    expect(err.message).toContain(text);
  });

  it('asks the reader to sign in when there is no session or the server rejects it', async () => {
    authorizedFetch.mockRejectedValueOnce(new CloudAuthError('AUTH_REQUIRED', 'internal'));
    const signedOut = await new CloudProvider().analyzeStageA('x').catch((e) => e);
    expect(signedOut).toBeInstanceOf(CloudAuthError);
    expect(signedOut.message).toBe('Sign in to LexiFlow Cloud in Settings to look up words.');

    authorizedFetch.mockResolvedValueOnce(reply(401, { error: { code: 'AUTH_REQUIRED' } }));
    const rejected = await new CloudProvider().analyzeStageA('x').catch((e) => e);
    expect(rejected).toBeInstanceOf(CloudAuthError);
  });

  it('passes network errors through', async () => {
    authorizedFetch.mockRejectedValue(new CloudAuthError('NETWORK', 'offline'));
    await expect(new CloudProvider().analyzeStageA('x')).rejects.toMatchObject({ code: 'NETWORK' });
  });

  it('refuses features the server does not offer yet instead of faking a result', async () => {
    const provider = new CloudProvider();
    await expect(provider.analyze('A sentence.', 'sentence')).rejects.toMatchObject({ code: 'NOT_AVAILABLE', message: expect.stringContaining('Sentence X-Ray') });
    await expect(provider.assistWriting('x', 'natural' as any)).rejects.toMatchObject({ code: 'NOT_AVAILABLE' });
    await expect(provider.askFollowUp('x', 'y', 'z')).rejects.toMatchObject({ code: 'NOT_AVAILABLE' });
    expect(authorizedFetch).not.toHaveBeenCalled();
  });

  it('is what AIService picks for the lexiflow provider, even with a stored API key', async () => {
    const provider = await AIService.getProvider({ aiProvider: 'lexiflow', apiKey: 'leftover-key', targetLanguage: 'bn' } as any);
    expect(provider).toBeInstanceOf(CloudProvider);
  });
});
