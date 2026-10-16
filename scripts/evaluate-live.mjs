#!/usr/bin/env node
/**
 * LexiFlow AI — Live AI Evaluation Suite
 * Evaluates contextual comprehension, Easy English, Easy Bengali, and sense separation
 * across the 10 canonical test cases specified in the Master Specification.
 *
 * Usage:
 *   node scripts/evaluate-live.mjs [--provider=gemini|mock] [--apiKey=YOUR_KEY] [--model=gemini-2.0-flash]
 */

import { MockAIProvider } from '../src/services/ai/mockProvider.ts';
import { GeminiProvider } from '../src/services/ai/geminiProvider.ts';
import { validateStageA, validateStageB } from '../src/services/ai/validation.ts';
import { TwoStageCacheService, PROMPT_VERSION } from '../src/services/ai/cache.ts';

const args = process.argv.slice(2);
const providerArg = args.find(a => a.startsWith('--provider='))?.split('=')[1] || process.env.AI_PROVIDER || 'mock';
const apiKeyArg = args.find(a => a.startsWith('--apiKey='))?.split('=')[1] || process.env.GEMINI_API_KEY || '';
const modelArg = args.find(a => a.startsWith('--model='))?.split('=')[1] || 'gemini-2.0-flash';

console.log('='.repeat(70));
console.log(' LexiFlow AI — Live Evaluation Suite');
console.log(` Provider: ${providerArg.toUpperCase()} | Model: ${modelArg} | Prompt Version: ${PROMPT_VERSION}`);
console.log('='.repeat(70));

let provider;
if (providerArg === 'gemini' && apiKeyArg) {
  provider = new GeminiProvider(apiKeyArg, modelArg);
} else {
  if (providerArg === 'gemini') {
    console.warn('⚠️ No Gemini API key provided. Falling back to offline Mock provider for evaluation structure.');
  }
  provider = new MockAIProvider();
}

const TEST_CASES = [
  {
    id: 1,
    word: 'run',
    pos: 'verb',
    context: 'The software will run smoothly in background mode.',
    description: 'Multiple common senses and parts of speech'
  },
  {
    id: 2,
    word: 'set',
    pos: 'verb',
    context: 'She carefully set the clock on the shelf.',
    description: 'Highly polysemous word; sense separation'
  },
  {
    id: 3,
    word: 'light',
    pos: 'noun',
    context: 'The morning light filled the entire living room.',
    description: 'Noun, verb and adjective senses'
  },
  {
    id: 4,
    word: 'bank',
    pos: 'noun',
    context: 'They went to the bank to apply for a small business loan.',
    description: 'Financial vs geographical meanings'
  },
  {
    id: 5,
    word: 'break the ice',
    pos: 'phrase',
    context: 'He told a funny joke at the start of the meeting to break the ice.',
    description: 'Idiomatic meaning rather than literal interpretation'
  },
  {
    id: 6,
    word: 'give up',
    pos: 'phrase',
    context: 'No matter how hard it got, they refused to give up on their dream.',
    description: 'Phrasal verb meaning and natural examples'
  },
  {
    id: 7,
    word: 'look up',
    pos: 'phrase',
    context: 'Things were finally beginning to look up for the team.',
    description: 'Multiple relevant phrasal-verb uses'
  },
  {
    id: 8,
    word: 'fast',
    pos: 'adjective',
    context: 'He made a fast decision before the deadline arrived.',
    description: 'Correct meaning and no fabricated direct antonym where none fits'
  },
  {
    id: 9,
    word: 'bank',
    pos: 'noun',
    context: 'We sat on the grassy bank of the river watching the sunset.',
    description: 'Ambiguous word in second sentence (geographical context)'
  },
  {
    id: 10,
    word: 'thingamajig',
    pos: 'noun',
    context: 'Give me that thingamajig over there.',
    description: 'Low-information sentence; honest uncertainty instead of invented certainty'
  }
];

async function runEvaluations() {
  const results = [];

  for (const tc of TEST_CASES) {
    console.log(`\n▶ [Case ${tc.id}/10] "${tc.word}" (${tc.description})`);
    console.log(`  Context: "${tc.context}"`);

    const startA = Date.now();
    let stageA;
    try {
      stageA = await provider.analyzeStageA(tc.word, tc.context);
    } catch (err) {
      console.error(`  ❌ Stage A failed:`, err.message);
      results.push({ ...tc, status: 'FAILED_STAGE_A', error: err.message });
      continue;
    }
    const latencyA = Date.now() - startA;

    const valA = validateStageA(stageA);

    console.log(`  [Stage A] Latency: ${latencyA}ms | Valid: ${valA.isValid ? '✓ PASS' : '❌ FAIL'}`);
    console.log(`   - Easy English: "${stageA.easyEnglish}"`);
    console.log(`   - Easy Bengali: "${stageA.easyBengali}"`);
    console.log(`   - In Context:   "${stageA.contextMeaning}"`);
    console.log(`   - Confidence:   ${stageA.confidence}`);

    const startB = Date.now();
    let stageB;
    try {
      stageB = await provider.analyzeStageB(stageA.lemma || tc.word, stageA.partOfSpeech || tc.pos, stageA.contextualSenseId);
    } catch (err) {
      console.error(`  ❌ Stage B failed:`, err.message);
      results.push({ ...tc, status: 'FAILED_STAGE_B', error: err.message });
      continue;
    }
    const latencyB = Date.now() - startB;

    const valB = validateStageB(stageB, tc.word);

    console.log(`  [Stage B] Latency: ${latencyB}ms | Valid: ${valB.isValid ? '✓ PASS' : '❌ FAIL'} | Senses: ${stageB.senses?.length || 0}`);
    if (stageB.senses?.[0]) {
      console.log(`   - Contextual Sense #1: "${stageB.senses[0].easyEnglish}" (${stageB.senses[0].easyBengali})`);
    }

    results.push({
      id: tc.id,
      word: tc.word,
      context: tc.context,
      description: tc.description,
      latencyA,
      latencyB,
      valA: valA.isValid,
      valB: valB.isValid,
      warningsA: valA.warnings,
      warningsB: valB.warnings,
      confidence: stageA.confidence,
      easyEnglish: stageA.easyEnglish,
      easyBengali: stageA.easyBengali
    });
  }

  console.log('\n' + '='.repeat(70));
  console.log(' EVALUATION SUMMARY TABLE');
  console.log('='.repeat(70));
  console.log('| ID | Target Word | Latency A | Latency B | Val A | Val B | Confidence | Status |');
  console.log('|----|-------------|-----------|-----------|-------|-------|------------|--------|');
  for (const r of results) {
    const status = (r.valA && r.valB) ? 'PASS' : 'WARN/FAIL';
    console.log(`| ${r.id.toString().padEnd(2)} | ${r.word.padEnd(11)} | ${(r.latencyA + 'ms').padEnd(9)} | ${(r.latencyB + 'ms').padEnd(9)} | ${(r.valA ? '✓' : '✗').padEnd(5)} | ${(r.valB ? '✓' : '✗').padEnd(5)} | ${r.confidence.padEnd(10)} | ${status.padEnd(6)} |`);
  }
  console.log('='.repeat(70));
}

runEvaluations().catch(console.error);
