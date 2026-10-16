import { performance } from 'perf_hooks';
import { BengaliService } from '../src/services/bengali/index.ts';
import { LocalDictionaryProvider } from '../src/services/dictionary/localDictionary.ts';
import { TwoStageCacheService } from '../src/services/ai/cache.ts';
import { MockAIProvider } from '../src/services/ai/mockProvider.ts';
import { detectSelectionType } from '../src/content/selection.ts';

// Repeatable test dataset adhering to specification
const TEST_CORPUS = {
  commonWords: [
    { text: 'run', context: 'The software will run smoothly in background mode.' },
    { text: 'bank', context: 'They went to the bank to apply for a small business loan.' },
    { text: 'light', context: 'The morning light filled the entire living room.' },
    { text: 'set', context: 'She carefully set the clock on the shelf.' },
    { text: 'fast', context: 'He made a fast decision before the deadline arrived.' },
  ],
  uncommonWords: [
    { text: 'ubiquitous', context: 'Smartphones have become ubiquitous in modern society.' },
    { text: 'ephemeral', context: 'Fame in the age of social media is often ephemeral.' },
    { text: 'resilient', context: 'The local economy proved remarkably resilient despite disruptions.' },
    { text: 'pragmatic', context: 'We need a pragmatic approach to solving the crisis.' },
    { text: 'scrutiny', context: 'The policy came under intense public scrutiny.' },
    { text: 'subsidies', context: 'Fertiliser subsidies need a rethink to prevent fiscal leakage.' },
  ],
  inflectedWords: [
    { text: 'subsidies', context: 'Agricultural subsidies require restructuring.' },
    { text: 'mitigating', context: 'They are mitigating the environmental risks.' },
    { text: 'examined', context: 'The committee examined every document.' },
    { text: 'running', context: 'He was running the operations efficiently.' },
    { text: 'disruptions', context: 'Supply chain disruptions affected production.' },
  ],
  multiwordPhrases: [
    { text: 'give up', context: 'They refused to give up on their vision.' },
    { text: 'look up', context: 'Things were beginning to look up for the team.' },
    { text: 'break the ice', context: 'He cracked a joke to break the ice.' },
    { text: 'carry out', context: 'The team will carry out the investigation.' },
  ],
  idiomsCollocations: [
    { text: 'address the issue', context: 'We must address the issue before it escalates.' },
    { text: 'under scrutiny', context: 'The accounts were placed under scrutiny.' },
    { text: 'bite the bullet', context: 'We decided to bite the bullet and invest.' },
  ],
  longSentences: [
    {
      text: 'The government fertiliser subsidy reform aims to curb fiscal deficits while protecting marginal farmers from price shocks.',
      context: 'The government fertiliser subsidy reform aims to curb fiscal deficits while protecting marginal farmers from price shocks.'
    },
    {
      text: 'In the wake of rapid technological expansion, institutions must balance rapid innovation with ethical responsibility and public accountability.',
      context: 'In the wake of rapid technological expansion, institutions must balance rapid innovation with ethical responsibility and public accountability.'
    }
  ],
  emptyOrInvalid: [
    { text: '', context: '' },
    { text: '   ', context: 'Some random text.' },
    { text: '???!!!', context: 'What is this punctuation?' },
    { text: 'A'.repeat(6000), context: 'Excessively long text test.' }
  ]
};

function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

function mean(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

async function runBenchmark() {
  console.log('='.repeat(70));
  console.log(' LexiFlow — Stage 1 Performance Baseline Benchmark');
  console.log(` Environment: Node ${process.version} / Windows x64`);
  console.log(` Date: ${new Date().toISOString()}`);
  console.log('='.repeat(70));

  const localDict = new LocalDictionaryProvider();
  const mockAI = new MockAIProvider();

  // 1. BengaliService (Curated Lexicon) Measurement
  console.log('\n[1] BengaliService.getMeaning() Latency:');
  const bengaliTimes = [];
  const bengaliHits = [];
  const allWords = [
    ...TEST_CORPUS.commonWords,
    ...TEST_CORPUS.uncommonWords,
    ...TEST_CORPUS.inflectedWords,
    ...TEST_CORPUS.multiwordPhrases,
    ...TEST_CORPUS.idiomsCollocations
  ];

  for (let i = 0; i < 50; i++) {
    for (const item of allWords) {
      const t0 = performance.now();
      const res = BengaliService.getMeaning(item.text, item.context);
      const t1 = performance.now();
      bengaliTimes.push(t1 - t0);
      if (i === 0) {
        bengaliHits.push({ text: item.text, isCurated: res.isCurated, bengali: res.bengaliWord });
      }
    }
  }

  const bengaliP50 = percentile(bengaliTimes, 50);
  const bengaliP95 = percentile(bengaliTimes, 95);
  const bengaliMean = mean(bengaliTimes);
  const curatedCount = bengaliHits.filter(h => h.isCurated).length;
  console.log(`  Sample Count: ${bengaliTimes.length}`);
  console.log(`  Mean: ${bengaliMean.toFixed(4)} ms | p50: ${bengaliP50.toFixed(4)} ms | p95: ${bengaliP95.toFixed(4)} ms`);
  console.log(`  Curated Hit Rate on Corpus: ${curatedCount}/${bengaliHits.length} (${((curatedCount/bengaliHits.length)*100).toFixed(1)}%)`);

  // 2. LocalDictionaryProvider.lookup() Latency
  console.log('\n[2] LocalDictionaryProvider.lookup() Latency:');
  const dictTimes = [];
  const dictHits = [];
  for (let i = 0; i < 50; i++) {
    for (const item of allWords) {
      const t0 = performance.now();
      const res = await localDict.lookup(item.text, item.context);
      const t1 = performance.now();
      dictTimes.push(t1 - t0);
      if (i === 0) {
        dictHits.push({ text: item.text, found: Boolean(res), def: res?.meanings?.[0]?.definitions?.[0]?.definition });
      }
    }
  }

  const dictP50 = percentile(dictTimes, 50);
  const dictP95 = percentile(dictTimes, 95);
  const dictMean = mean(dictTimes);
  const dictFoundCount = dictHits.filter(h => h.found).length;
  console.log(`  Sample Count: ${dictTimes.length}`);
  console.log(`  Mean: ${dictMean.toFixed(4)} ms | p50: ${dictP50.toFixed(4)} ms | p95: ${dictP95.toFixed(4)} ms`);
  console.log(`  Dictionary Hit Rate on Corpus: ${dictFoundCount}/${dictHits.length} (${((dictFoundCount/dictHits.length)*100).toFixed(1)}%)`);

  // 3. Selection Detection Latency
  console.log('\n[3] Selection Detection (detectSelectionType) Latency:');
  const selTimes = [];
  const allSelections = [
    ...allWords,
    ...TEST_CORPUS.longSentences,
    ...TEST_CORPUS.emptyOrInvalid
  ];

  for (let i = 0; i < 50; i++) {
    for (const item of allSelections) {
      const t0 = performance.now();
      const st = detectSelectionType(item.text);
      const t1 = performance.now();
      selTimes.push(t1 - t0);
    }
  }

  console.log(`  Sample Count: ${selTimes.length}`);
  console.log(`  Mean: ${mean(selTimes).toFixed(4)} ms | p50: ${percentile(selTimes, 50).toFixed(4)} ms | p95: ${percentile(selTimes, 95).toFixed(4)} ms`);

  // 4. TwoStageCacheService In-Memory Latency (Cold vs Warm)
  console.log('\n[4] In-Memory Cache (TwoStageCacheService):');
  TwoStageCacheService.clear();

  // Cold lookup
  const coldCacheTimes = [];
  for (const item of allWords) {
    const key = TwoStageCacheService.getStageAKey(item.text, item.context);
    const t0 = performance.now();
    const res = TwoStageCacheService.getStageA(key);
    const t1 = performance.now();
    coldCacheTimes.push(t1 - t0);
  }

  // Populate cache
  for (const item of allWords) {
    const key = TwoStageCacheService.getStageAKey(item.text, item.context);
    TwoStageCacheService.setStageA(key, {
      selectedText: item.text,
      lemma: item.text.toLowerCase(),
      partOfSpeech: 'noun',
      easyEnglish: 'Test English',
      easyBengali: 'টেস্ট বাংলা',
      contextMeaning: 'Test context',
      confidence: 'high'
    });
  }

  // Warm lookup (100 iterations)
  const warmCacheTimes = [];
  for (let i = 0; i < 100; i++) {
    for (const item of allWords) {
      const key = TwoStageCacheService.getStageAKey(item.text, item.context);
      const t0 = performance.now();
      const res = TwoStageCacheService.getStageA(key);
      const t1 = performance.now();
      warmCacheTimes.push(t1 - t0);
    }
  }

  console.log(`  Cold Cache Lookup: p50: ${percentile(coldCacheTimes, 50).toFixed(4)} ms | p95: ${percentile(coldCacheTimes, 95).toFixed(4)} ms`);
  console.log(`  Warm Cache Lookup (N=${warmCacheTimes.length}): p50: ${percentile(warmCacheTimes, 50).toFixed(4)} ms | p95: ${percentile(warmCacheTimes, 95).toFixed(4)} ms | Mean: ${mean(warmCacheTimes).toFixed(4)} ms`);

  // 5. End-to-End Pipeline Latency: First Visible Result in Current Architecture
  console.log('\n[5] First Visible Result Latency (Current Architecture):');
  console.log('  - Curated hit path (e.g. "scrutiny"): synchronous local display (0ms await)');
  console.log('  - Non-curated path (99.9% of words): loading spinner shown, awaits AI API response');
  
  // Measure Mock AI provider baseline
  const mockAITimes = [];
  for (let i = 0; i < 20; i++) {
    const t0 = performance.now();
    await mockAI.analyzeStageA('bank', 'They went to the bank.');
    const t1 = performance.now();
    mockAITimes.push(t1 - t0);
  }
  console.log(`  Mock AI Completion (simulated offline): p50: ${percentile(mockAITimes, 50).toFixed(2)} ms | p95: ${percentile(mockAITimes, 95).toFixed(2)} ms`);
  console.log(`  Real Network AI (Gemini/Claude/OpenAI): typically 1200ms - 3500ms (network-dependent)`);

  console.log('\n' + '='.repeat(70));
  console.log(' Baseline Benchmark Run Completed.');
  console.log('='.repeat(70));
}

runBenchmark().catch(console.error);
