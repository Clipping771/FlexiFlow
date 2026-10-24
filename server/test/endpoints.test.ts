import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/index';
import type { Bindings } from '../src/env';
import { signAccessToken } from '../src/lib/tokens';
import { createTestD1, type TestD1 } from './d1';
import { createTestKV, type TestKV } from './kv';

const SECRET = 'test-secret-that-is-at-least-32-bytes-long';

const word = {
  selectedText: 'mitigate',
  selectionType: 'word',
  contextualMeaning: 'To make something bad less severe.',
  simpleEnglishExplanation: 'To make a problem smaller.',
  bengaliTranslation: 'প্রশমিত করা, কমানো',
  whyFitsContext: 'The sentence is about reducing harm.',
  partOfSpeech: 'verb',
  collocations: ['mitigate risk'],
  examples: ['Trees mitigate flooding.'],
  synonyms: ['reduce'],
  antonyms: ['worsen']
};

const sentence = {
  selectedText: 'Despite the rain, we went out.',
  selectionType: 'sentence',
  plainEnglishParaphrase: 'It rained, but we still went out.',
  overallMeaning: 'They went out even though it rained.',
  bengaliTranslation: 'বৃষ্টি সত্ত্বেও আমরা বাইরে গিয়েছিলাম।',
  sentenceStructure: { type: 'simple', explanation: 'One clause with a prepositional phrase.', explanationBengali: 'একটি মাত্র clause।' }
};

const writing = {
  originalText: 'me go school',
  goal: 'natural',
  improvedText: 'I go to school.',
  changesExplanation: 'Use the subject pronoun "I" and the preposition "to".',
  bengaliExplanation: '"me" এর বদলে "I" এবং "to" যোগ করতে হবে।',
  alternatives: ['I am going to school.']
};

const followUp = {
  question: 'Why this word?',
  keyTakeaway: 'Mitigate means to soften harm.',
  answer: 'Because the sentence talks about reducing damage.',
  bengaliSummary: 'ক্ষতি কমানোর কথা বলা হচ্ছে বলে এই শব্দটি ব্যবহার হয়েছে।',
  suggestedFollowUps: ['What is a synonym?'],
  examples: [{ english: 'Trees mitigate floods.', bengali: 'গাছ বন্যা কমায়।' }]
};

const highlights = {
  items: [
    {
      id: 'hl_1',
      text: 'pave the way',
      type: 'phrase',
      contextSentence: 'The law could pave the way for reform.',
      easyEnglish: 'To make something possible later.',
      easyBengali: 'পথ তৈরি করা',
      reason: 'Common idiom in news.',
      difficulty: 'medium',
      learningValueScore: 0.9,
      isArticleCore: true
    }
  ],
  pageTitle: 'News',
  articleSummary: 'A law may lead to reform.'
};

const usage = {
  targetWord: 'mitigate',
  isGrammaticallyCorrect: false,
  collocationScore: 55,
  grammarCorrectness: 'Use "mitigate" with an object: "mitigate the risk".',
  naturalAlternative: 'We must mitigate the risk.',
  bengaliFeedback: '"mitigate" এর পরে একটি object দরকার।',
  alternativeCollocations: ['mitigate the risk', 'mitigate damage']
};

let d1: TestD1;
let kv: TestKV;
let env: Bindings;
let outputs: unknown[];
let prompts: string[];

beforeEach(async () => {
  d1 = await createTestD1();
  kv = createTestKV();
  env = {
    DB: d1.db,
    CACHE: kv.kv,
    JWT_SECRET: SECRET,
    ALLOWED_ORIGINS: '',
    GOOGLE_CLIENT_ID: 'test-client',
    GEMINI_API_KEY: 'k',
    GEMINI_MODEL: 'gemini-2.0-flash',
    UPGRADE_URL: ''
  };
  outputs = [];
  prompts = [];
  vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
    prompts.push(JSON.parse(String(init.body)).contents[0].parts[0].text);
    const next = outputs.shift();
    if (next === undefined) throw new Error('no model output queued');
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: typeof next === 'string' ? next : JSON.stringify(next) }] } }],
      usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50 }
    }));
  });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  d1.exec(`INSERT INTO users (id, google_sub, email, plan, created_at) VALUES ('usr_1', 'g_1', 'r@example.com', 'free', '2026-10-01T00:00:00Z')`);
});

afterEach(() => {
  d1.close();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function call(path: string, body: Record<string, unknown>) {
  const token = await signAccessToken({ id: 'usr_1', plan: 'free', planExpiresAt: null }, SECRET);
  return app.request(
    `/v1/ai/${path}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ targetLang: 'bn', ...body }) },
    env
  );
}

async function json(res: Response): Promise<any> {
  return res.json();
}

async function creditsUsed(): Promise<number> {
  return (await env.DB.prepare('SELECT COALESCE(SUM(credits_used), 0) AS n FROM usage_daily').first<number>('n')) ?? 0;
}

describe('POST /v1/ai/analyze', () => {
  it.each([
    ['word', { text: 'mitigate', selectionType: 'word', contextSentence: 'We must mitigate harm.' }, word, 1],
    ['sentence', { text: sentence.selectedText, selectionType: 'sentence' }, sentence, 2]
  ])('analyzes a %s and charges by length', async (_label, body, output, credits) => {
    outputs.push(output);
    const res = await call('analyze', body);
    expect(res.status).toBe(200);
    const data = (await json(res)).data;
    expect(data.selectionType).toBe(body.selectionType);
    expect(data.bengaliTranslation).toBe((output as any).bengaliTranslation);
    expect(await creditsUsed()).toBe(credits);
  });

  it('uses the full 9-layer Sentence X-Ray prompt', async () => {
    outputs.push(sentence);
    await call('analyze', { text: sentence.selectedText, selectionType: 'sentence' });
    expect(prompts[0]).toContain('9-layer learning breakdown');
  });

  it('caches word analyses but never sentence analyses', async () => {
    outputs.push(word, sentence, sentence);
    await call('analyze', { text: 'mitigate', selectionType: 'word' });
    expect((await json(await call('analyze', { text: 'Mitigate', selectionType: 'word' }))).cached).toBe(true);
    await call('analyze', { text: sentence.selectedText, selectionType: 'sentence' });
    expect((await json(await call('analyze', { text: sentence.selectedText, selectionType: 'sentence' }))).cached).toBe(false);
    expect(prompts).toHaveLength(3);
    expect([...kv.store.keys()].every((k) => k.startsWith('an:v1:bn:word:'))).toBe(true);
  });

  it('refunds when the model returns an object the lenient schema would have filled with defaults', async () => {
    outputs.push({}, { selectedText: 'x', bengaliTranslation: 'not Bengali', contextualMeaning: 'm' });
    const res = await call('analyze', { text: 'mitigate', selectionType: 'word' });
    expect(res.status).toBe(503);
    expect(prompts[1]).toContain('bengaliTranslation');
    expect(await creditsUsed()).toBe(0);
    expect(kv.store.size).toBe(0);
  });

  it.each([
    ['a word longer than a selection', { text: 'a'.repeat(121), selectionType: 'word' }, 413],
    ['a sentence over the Free limit', { text: 'a'.repeat(601), selectionType: 'sentence' }, 413],
    ['a paragraph over the Free limit', { text: 'a'.repeat(3001), selectionType: 'paragraph' }, 413],
    ['an unknown selection type', { text: 'x', selectionType: 'essay' }, 400]
  ])('rejects %s before charging', async (_label, body, status) => {
    const res = await call('analyze', body);
    expect(res.status).toBe(status);
    expect(prompts).toHaveLength(0);
    expect(await creditsUsed()).toBe(0);
  });
});

describe('POST /v1/ai/compare-words', () => {
  it('returns both analyses for 2 credits and reuses the analyze cache', async () => {
    outputs.push(word);
    await call('analyze', { text: 'mitigate', selectionType: 'word' }); // caches "mitigate"
    outputs.push({ ...word, selectedText: 'alleviate', bengaliTranslation: 'লাঘব করা' });

    const res = await call('compare-words', { wordA: 'mitigate', wordB: 'alleviate' });

    expect(res.status).toBe(200);
    const { data } = await json(res);
    expect(data.wordA.selectedText).toBe('mitigate');
    expect(data.wordB.bengaliTranslation).toBe('লাঘব করা');
    expect(prompts).toHaveLength(2); // one for the earlier lookup, one for "alleviate"
    expect(await creditsUsed()).toBe(1 + 2);
  });

  it('refunds both credits when one word fails', async () => {
    outputs.push(word, {}, {});
    const res = await call('compare-words', { wordA: 'mitigate', wordB: 'alleviate' });
    expect(res.status).toBe(503);
    expect(await creditsUsed()).toBe(0);
    const event = await env.DB.prepare('SELECT status, tokens_in FROM usage_events').first();
    expect(event).toEqual({ status: 'refunded', tokens_in: 300 });
  });
});

describe('POST /v1/ai/evaluate-usage', () => {
  it('returns a real evaluation for 2 credits', async () => {
    outputs.push(usage);
    const res = await call('evaluate-usage', { targetWord: 'mitigate', sentence: 'We must mitigate.' });
    expect(res.status).toBe(200);
    const { data } = await json(res);
    expect(data).toMatchObject({ isGrammaticallyCorrect: false, collocationScore: 55, naturalAlternative: 'We must mitigate the risk.' });
    expect(prompts[0]).toContain("Learner's sentence: We must mitigate.");
    expect(await creditsUsed()).toBe(2);
  });

  it('rejects a score outside 0-100', async () => {
    outputs.push({ ...usage, collocationScore: 140 }, { ...usage, collocationScore: 140 });
    expect((await call('evaluate-usage', { targetWord: 'mitigate', sentence: 'x' })).status).toBe(503);
  });
});

const summaryMarking = {
  summaryLanguage: 'en',
  criteria: [
    { id: 'main_idea', score: 3.5, comment: 'Clear central claim.' },
    { id: 'key_points', score: 9, comment: 'Covers most points.' },
    { id: 'accuracy', score: 2, comment: 'Nothing wrong.' },
    { id: 'expression', score: 1, comment: 'Own words.' }
  ],
  totalScore: 10,
  overallFeedback: 'You understood the article well.',
  strengths: ['Names the main argument'],
  missedPoints: ['The cost of storage'],
  misunderstandings: [],
  modelSummary: 'The article argues that grids need storage to use renewables reliably.',
  languageFeedback: { comment: 'Mostly correct.', corrections: [{ original: 'grid need', corrected: 'grids need', explanation: 'Plural subject.' }] }
};

describe('POST /v1/ai/evaluate-summary', () => {
  it('marks a summary for 3 credits and recomputes the total from clamped criteria', async () => {
    outputs.push(summaryMarking);
    const res = await call('evaluate-summary', {
      articleText: 'Renewable grids need storage. Storage is costly.',
      articleTitle: 'Grids',
      summary: 'The grid need storage to work with renewables.'
    });
    expect(res.status).toBe(200);
    const { data } = await json(res);
    // key_points is capped at 3, so the total is 3.5 + 3 + 2 + 1 rather than the model's 10
    expect(data.totalScore).toBe(9.5);
    expect(data.criteria.find((c: { id: string }) => c.id === 'key_points').score).toBe(3);
    expect(prompts[0]).toContain('The grid need storage to work with renewables.');
    expect(await creditsUsed()).toBe(3);
  });

  it('does not charge when a criterion is missing', async () => {
    const broken = { ...summaryMarking, criteria: summaryMarking.criteria.slice(0, 2) };
    outputs.push(broken, broken);
    const res = await call('evaluate-summary', { articleText: 'Some article.', summary: 'A summary.' });
    expect(res.status).toBe(503);
    expect(await creditsUsed()).toBe(0);
  });

  it('rejects a summary over the length limit', async () => {
    const res = await call('evaluate-summary', { articleText: 'Some article.', summary: 'x'.repeat(3001) });
    expect(res.status).toBe(413);
  });
});

describe('writing, follow-up and highlights', () => {
  it('assists writing for 3 credits', async () => {
    outputs.push(writing);
    const res = await call('assist-writing', { text: 'me go school', goal: 'natural' });
    expect(res.status).toBe(200);
    expect((await json(res)).data.improvedText).toBe('I go to school.');
    expect(await creditsUsed()).toBe(3);
  });

  it('does not charge for the schema\'s stock Bengali explanation', async () => {
    outputs.push({ improvedText: 'I go to school.' }, { improvedText: 'I go to school.' });
    expect((await call('assist-writing', { text: 'me go school', goal: 'natural' })).status).toBe(503);
    expect(await creditsUsed()).toBe(0);
  });

  it('rejects an unknown writing goal', async () => {
    expect((await call('assist-writing', { text: 'x', goal: 'poetic' })).status).toBe(400);
  });

  it('answers follow-up questions for 1 credit', async () => {
    outputs.push(followUp);
    const res = await call('follow-up', { text: 'mitigate', context: 'We must mitigate harm.', question: 'Why this word?' });
    expect(res.status).toBe(200);
    expect((await json(res)).data.answer).toContain('reducing damage');
    expect(await creditsUsed()).toBe(1);
  });

  it('extracts highlights for 3 credits and never caches page text', async () => {
    outputs.push(highlights);
    const res = await call('highlights', { rawText: 'The law could pave the way for reform.', pageTitle: 'News' });
    expect(res.status).toBe(200);
    const { data } = await json(res);
    expect(data.items[0].text).toBe('pave the way');
    expect(data.sourceMode).toBe('ai_reasoning');
    expect(await creditsUsed()).toBe(3);
    expect(kv.store.size).toBe(0);
  });

  it('refunds highlights that find nothing', async () => {
    outputs.push({ items: [] }, { items: [] });
    expect((await call('highlights', { rawText: 'Hi.' })).status).toBe(503);
    expect(await creditsUsed()).toBe(0);
  });

  it('rejects page text over 20,000 characters', async () => {
    const res = await call('highlights', { rawText: 'a'.repeat(20001) });
    expect(res.status).toBe(413);
  });
});
