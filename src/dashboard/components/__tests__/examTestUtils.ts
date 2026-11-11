import { act } from 'react';
import { vi } from 'vitest';
import { setExamArticle, _resetExamArticle } from '../../../services/examContent/articleSource';
import { _clearExamItemCache } from '../../../services/examContent/generate';
import type { ExamItemKind } from '../../../services/examContent/aiItems';

/** An original practice article: several paragraphs, figures and sentences of every length the builders need. */
export const SAMPLE_ARTICLE = `Cities around the world are planting trees to cope with hotter summers. A mature street tree can lower the air temperature beneath it by several degrees on a sunny afternoon. Shade also protects pavements and roads, which last longer when they do not bake in direct sunlight.

The benefits are not only about temperature. Trees absorb rainwater and slow the flow of storm water into drains, reducing the risk of flooding in heavy downpours. Researchers in Melbourne found that neighbourhoods with more canopy cover recorded 30 percent fewer emergency calls during heatwaves. Residents in leafy streets also report walking more and feeling less stressed.

However, planting trees is far easier than keeping them alive. Young trees need regular watering for at least three years, and many cities lack the staff to provide it. In some programmes, nearly half of newly planted saplings die before they reach maturity. Choosing species that tolerate drought and pollution has therefore become a priority for urban planners.

Money is another obstacle. A single street tree can cost more than 1,500 dollars once planting, protection and early care are included. Wealthier districts often receive more trees because residents campaign for them, while poorer areas, which tend to be hotter, are left behind. Several cities now map heat and canopy cover together so that new trees go where they are needed most.

Despite these challenges, most experts agree that urban forests are a cheap way to make cities healthier. Compared with air conditioning, which consumes energy and releases heat outdoors, trees cool the air naturally. The key is long-term commitment, because the full benefits of a tree appear only after decades of careful maintenance.`;

export const SAMPLE_ITEMS: Record<ExamItemKind, unknown> = {
  pte_essay: { prompt: 'Some people think cities should spend more on planting trees, while others believe the money is better used elsewhere. Discuss both views and give your own opinion.' },
  ielts_task2: { prompt: 'Many cities are planting trees to reduce summer heat. Do the advantages of this policy outweigh the disadvantages?' },
  ielts_task1: {
    prompt: 'The table below shows tree canopy cover in four districts. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.',
    title: 'Tree canopy cover by district',
    unit: '% of area',
    columns: ['2010', '2020'],
    rows: [
      { label: 'North', values: [12, 18] },
      { label: 'South', values: [25, 27] },
      { label: 'East', values: [8, 15] }
    ]
  },
  pte_mcm: {
    question: 'Which TWO problems with urban tree programmes does the passage mention?',
    options: ['Young trees need watering', 'Trees cost money to plant', 'Trees increase flooding', 'Trees raise temperatures', 'Trees damage roads'],
    correct: [0, 1]
  },
  ielts_tfng: {
    statements: [
      { statement: 'Street trees can make the air beneath them cooler.', answer: 'TRUE', explanation: 'The passage says trees lower the air temperature.' },
      { statement: 'Planting a tree is harder than keeping it alive.', answer: 'FALSE', explanation: 'Keeping trees alive is said to be harder.' },
      { statement: 'Melbourne plans to double its canopy by 2040.', answer: 'NOT GIVEN', explanation: 'No such plan is mentioned.' }
    ]
  },
  ielts_headings: {
    headings: [
      { paragraph: 'A', heading: 'Trees as natural coolers' },
      { paragraph: 'B', heading: 'Benefits beyond temperature' },
      { paragraph: 'C', heading: 'The struggle to keep saplings alive' }
    ],
    distractors: ['A history of city parks']
  },
  pte_asq: { question: 'What do we call a large area covered with trees?', answers: ['forest', 'a forest', 'woods'] },
  ielts_speaking: {
    part1: 'Are there many trees where you live?',
    part2Topic: 'Describe a park or green space you like to visit.',
    part2Points: ['where it is', 'how often you go there', 'what you do there', 'and explain why you like it'],
    part3: 'Should cities spend more money on green spaces than on roads?'
  },
  pte_sst_marks: { content: 1.5, grammar: 2, vocabulary: 1.5, spelling: 2, feedback: 'Covers the cooling and cost points.' },
  smart_reading: {
    topic: 'Urban trees',
    gist: 'Cities plant trees to stay cooler and healthier, but keeping them alive and paying for them is hard.',
    level: 'B2',
    keyIdeas: ['Trees cool streets and reduce flooding.', 'Many young trees die without care.', 'Poorer, hotter areas often get fewer trees.'],
    questions: [
      {
        type: 'choice',
        skill: 'main_idea',
        question: 'What is the article mainly about?',
        options: ['Why air conditioning is better than trees', 'The benefits and difficulties of city trees', 'How Melbourne plants its forests', 'Why trees damage roads'],
        answer: 1,
        explanation: 'The article weighs what trees give cities against the problems of growing them.',
        evidence: 'most experts agree that urban forests are a cheap way to make cities healthier'
      },
      {
        type: 'choice',
        skill: 'inference',
        question: 'Why do poorer areas often get fewer trees?',
        options: ['They are cooler already', 'Their residents campaign less', 'Trees do not grow there', 'Cities ban trees there'],
        answer: 1,
        explanation: 'Wealthier districts get more trees because residents campaign for them.',
        evidence: 'Wealthier districts often receive more trees because residents campaign for them'
      },
      {
        type: 'judge',
        skill: 'detail',
        statement: 'Young trees need watering for at least three years.',
        answer: 'true',
        explanation: 'The article gives this as the minimum care period.',
        evidence: 'Young trees need regular watering for at least three years'
      },
      {
        type: 'judge',
        skill: 'detail',
        statement: 'Melbourne plans to double its tree cover by 2040.',
        answer: 'not_given',
        explanation: 'No such plan is mentioned.',
        evidence: ''
      }
    ]
  },
  smart_vocab: {
    words: [
      {
        word: 'canopy',
        sentence: 'neighbourhoods with more canopy cover recorded 30 percent fewer emergency calls',
        options: ['The cover formed by tree tops', 'A cloth roof over a bed', 'A tall building', 'A type of rain'],
        answer: 0,
        explanation: 'Here it means the layer of leaves and branches above the street.',
        example: 'The forest canopy kept the path in shade all afternoon.'
      },
      {
        word: 'saplings',
        sentence: 'nearly half of newly planted saplings die before they reach maturity',
        options: ['Old trees', 'Young trees', 'Garden tools', 'Tree roots'],
        answer: 1,
        explanation: 'A sapling is a young tree.',
        example: 'Volunteers planted fifty saplings along the river.'
      },
      {
        word: 'tolerate',
        sentence: 'Choosing species that tolerate drought and pollution',
        options: ['Cause', 'Avoid', 'Survive without harm', 'Measure'],
        answer: 2,
        explanation: 'Plants that tolerate drought can live through it.',
        example: 'Cactuses tolerate very dry weather.'
      }
    ]
  },
  smart_listening: {
    script:
      'Here is a quick look at city trees. Across the world, councils are planting street trees to fight summer heat. A mature tree can cool the air beneath it by several degrees. But there is a catch: young trees need years of watering, and in some cities almost half of them die early. Planners are now choosing tougher species and mapping the hottest streets first.',
    questions: [
      {
        question: 'What problem does the presenter mention?',
        options: ['Trees grow too fast', 'Many young trees die early', 'Trees make streets hotter', 'Councils refuse to plant trees'],
        answer: 1,
        explanation: 'The brief says almost half of young trees die early in some cities.'
      },
      {
        question: 'What are planners doing now?',
        options: ['Cutting old trees', 'Buying air conditioners', 'Choosing tougher species', 'Stopping all planting'],
        answer: 2,
        explanation: 'They are choosing tougher species and mapping hot streets.'
      }
    ]
  },
  smart_tasks: {
    writing: {
      kind: 'opinion',
      prompt: 'Should your city spend more money on planting and caring for street trees? Give your opinion with reasons from the article and your own experience.',
      minWords: 60,
      maxWords: 120,
      checklist: ['States a clear opinion', 'Gives at least two reasons', 'Mentions a cost or difficulty']
    },
    speaking: {
      prompt: 'Talk about a street or park near you. Would more trees make it better? Why or why not?',
      ideas: ['Shade in summer', 'Cost and care', 'How people would use it'],
      followUps: ['Who should pay for city trees?', 'Are trees more useful than air conditioning?'],
      seconds: 60
    }
  },
  smart_feedback: {
    score: 72,
    level: 'B2',
    verdict: 'A clear opinion with good reasons; a few grammar slips.',
    strengths: ['Clear position in the first sentence', 'Good use of the cost argument'],
    fixes: [
      { original: 'trees is good', better: 'trees are good', why: '"Trees" is plural, so use "are".', code: 'GRA.SUBJ_VERB_AGR' },
      { original: 'a invented phrase', better: 'an invented phrase', why: 'Not in the answer, so it must not be saved.', code: 'GRA.ARTICLE_DEF_INDEF' }
    ],
    coverage: [
      { point: 'States a clear opinion', covered: true },
      { point: 'Gives at least two reasons', covered: true },
      { point: 'Mentions a cost or difficulty', covered: false }
    ],
    improved: 'I believe my city should invest more in street trees, because they cool our streets and reduce flooding, even though caring for them costs money.'
  }
};

/**
 * Stands in for the background worker: EXAM_GENERATE returns SAMPLE_ITEMS, and EXAM_AI_COMPLETE
 * returns `marks` (or the no-provider error when none are given).
 */
export function installExamBackground(options: { marks?: Record<string, unknown>; items?: Partial<Record<ExamItemKind, unknown>> } = {}) {
  const sendMessage = vi.fn((message: any, callback: (res: any) => void) => {
    if (message?.type === 'EXAM_GENERATE') {
      const data = options.items?.[message.payload.kind as ExamItemKind] ?? SAMPLE_ITEMS[message.payload.kind as ExamItemKind];
      callback(data ? { success: true, data } : { success: false, error: 'Writing these questions needs an AI provider.' });
    } else if (message?.type === 'EXAM_AI_COMPLETE') {
      callback(
        options.marks
          ? { success: true, data: { rawText: JSON.stringify(options.marks), model: 'test-model' } }
          : { success: false, error: 'Exam marking needs an AI provider. Set one up in Settings.' }
      );
    } else {
      callback({ success: true });
    }
  });
  (globalThis as any).chrome = { runtime: { sendMessage } };
  return sendMessage;
}

/** Captures what the screen reads aloud, so a test can answer a listening item. */
export function captureSpeech() {
  const spoken: string[] = [];
  (window as any).speechSynthesis = {
    cancel: vi.fn(),
    getVoices: () => [{ name: 'Google UK English Female', lang: 'en-GB', localService: false, default: true, voiceURI: 'Google UK English Female' }],
    speak: vi.fn((u: any) => {
      spoken.push(u.text);
      u.onend?.();
    }),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  };
  (globalThis as any).SpeechSynthesisUtterance = class {
    text: string;
    rate = 1;
    pitch = 1;
    lang = '';
    voice: unknown = null;
    onend: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(text: string) {
      this.text = text;
    }
  };
  return spoken;
}

export async function setSampleArticle(text = SAMPLE_ARTICLE) {
  await setExamArticle({ url: 'https://example.com/urban-trees', title: 'Why cities are planting trees', text });
}

export function resetExamContent() {
  _resetExamArticle();
  _clearExamItemCache();
  delete (globalThis as any).chrome;
  delete (window as any).speechSynthesis;
}

/** Lets pending promises (article load, generated items) settle. */
export async function flush() {
  for (let i = 0; i < 3; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

/**
 * The right word for each gap, found by walking the article: `segments` are the texts around the
 * gaps, in order, exactly as the learner sees them.
 */
export function answersFromArticle(segments: string[], article = SAMPLE_ARTICLE): string[] {
  const flat = article.replace(/\s+/g, ' ');
  const word = /^[A-Za-z0-9'-]+(?:[.,][0-9]+)*%?/;
  // The first segment can be short and appear more than once; keep the occurrence where every segment fits
  for (let start = flat.indexOf(segments[0]); start >= 0; start = flat.indexOf(segments[0], start + 1)) {
    let pos = start + segments[0].length;
    const answers: string[] = [];
    let fits = true;
    for (let i = 1; i < segments.length && fits; i++) {
      const w = flat.slice(pos).match(word)?.[0] ?? '';
      pos += w.length;
      fits = w.length > 0 && flat.startsWith(segments[i], pos);
      pos += segments[i].length;
      answers.push(w.toLowerCase());
    }
    if (fits) return answers;
  }
  throw new Error('passage not found in article');
}
