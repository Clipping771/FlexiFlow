#!/usr/bin/env node

/**
 * CI Guard (AGENTS.md rules 3 and 4): exam engine isolation and secrets.
 * 1. Code in exams/pte/ must never import from exams/ielts/, and the reverse. Every file in both
 *    engines is read and each import is resolved, so a violation is caught whether or not it is new.
 * 2. One change must not modify exams/pte/ and exams/ielts/ together.
 * 3. Changed files must not contain raw API keys (Google AIzaSy..., OpenAI sk-proj-..., Anthropic sk-ant-...).
 * Works the same on Windows, macOS and Linux.
 */

import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ENGINES = ['pte', 'ielts'];
const CODE_FILE = /\.(ts|tsx|js|mjs|cjs|jsx)$/;

console.log('[CI Check] Running Exam Engine Isolation & Secrets Guard...');
let failed = false;
const fail = (msg) => {
  console.error(`\n❌ ${msg}`);
  failed = true;
};

// ---------------------------------------------------------------------------
// 1. Import isolation
// ---------------------------------------------------------------------------

function listFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (name === 'node_modules') return [];
    return statSync(full).isDirectory() ? listFiles(full) : CODE_FILE.test(name) ? [full] : [];
  });
}

/** Every module specifier in a file: import/export ... from '...', import('...'), require('...'). */
export function importsOf(source) {
  const specs = [];
  const re = /(?:import|export)\s+(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)/g;
  let m;
  while ((m = re.exec(source))) specs.push(m[1] || m[2] || m[3]);
  return specs;
}

/** Which engine an import points into, if any. */
function engineOf(fromFile, spec) {
  let target;
  if (spec.startsWith('.')) target = resolve(dirname(fromFile), spec);
  else if (/(^|\/)exams\/(pte|ielts)(\/|$)/.test(spec)) target = join(ROOT, spec.slice(spec.indexOf('exams/')));
  else return null;
  const rel = relative(join(ROOT, 'exams'), target).split(sep);
  return rel.length > 0 && ENGINES.includes(rel[0]) && !rel[0].startsWith('..') ? rel[0] : null;
}

let checked = 0;
for (const engine of ENGINES) {
  for (const file of listFiles(join(ROOT, 'exams', engine))) {
    checked++;
    const source = readFileSync(file, 'utf8');
    for (const spec of importsOf(source)) {
      const target = engineOf(file, spec);
      if (target && target !== engine) {
        fail(`[ISOLATION] ${relative(ROOT, file)} imports "${spec}" from exams/${target}/. Engines must never touch each other.`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 2 + 3. Changed files: one engine per change, no secrets
// ---------------------------------------------------------------------------

function run(cmd) {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
}

function changedFiles() {
  const base = process.env.GITHUB_BASE_REF;
  const committed = base ? run(`git diff --name-only origin/${base}...HEAD`) : run('git diff --name-only HEAD~1 HEAD');
  const working = run('git status --porcelain') || '';
  const fromStatus = working
    .split('\n')
    .filter(Boolean)
    .map((line) => line.slice(3).split(' -> ').pop().trim().replace(/^"|"$/g, ''));
  const files = new Set([...(committed || '').split('\n').map((f) => f.trim()).filter(Boolean), ...fromStatus]);
  return [...files].map((f) => f.replace(/\\/g, '/'));
}

const changed = changedFiles();
const touches = (engine) => changed.some((f) => f.startsWith(`exams/${engine}/`));
if (touches('pte') && touches('ielts')) {
  fail('[ISOLATION] This change modifies both exams/pte/ and exams/ielts/. Split it into one change per engine.');
  changed.filter((f) => f.startsWith('exams/')).forEach((f) => console.error(`  - ${f}`));
}

const SECRET_PATTERNS = [
  /AIzaSy[A-Za-z0-9_-]{33}/, // Google API key
  /sk-proj-[A-Za-z0-9_-]{48,}/, // OpenAI key
  /sk-ant-[A-Za-z0-9_-]{48,}/ // Anthropic key
];
for (const file of changed) {
  if (!/\.(ts|tsx|js|mjs|cjs|json|yaml|yml|html|env)$/.test(file)) continue;
  const full = join(ROOT, file);
  if (!existsSync(full) || statSync(full).isDirectory()) continue;
  const content = readFileSync(full, 'utf8');
  if (SECRET_PATTERNS.some((p) => p.test(content))) fail(`[SECURITY] Possible hard-coded API key in: ${file}`);
}

if (failed) process.exit(1);
console.log(`✅ Exam Engine Isolation & Secrets Guard passed (${checked} engine files checked, ${changed.length} changed files scanned).`);
process.exit(0);
