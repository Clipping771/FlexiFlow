#!/usr/bin/env node

/**
 * CI Guard: Enforces Exam Engine Isolation and Secrets Prevention
 * 1. An individual PR must not touch exams/pte/ AND exams/ielts/ simultaneously.
 * 2. Scans for accidental committed raw API keys (e.g. OpenAI sk-..., Google AIzaSy...).
 */

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

console.log('[CI Check] Running Exam Engine Isolation & Secrets Guard...');

let changedFiles = [];
try {
  // Check against main branch if in PR, or HEAD~1
  const diffCommand = process.env.GITHUB_BASE_REF
    ? `git diff --name-only origin/${process.env.GITHUB_BASE_REF}...HEAD`
    : 'git diff --name-only HEAD~1 HEAD 2>/dev/null || git status --porcelain';

  const output = execSync(diffCommand, { encoding: 'utf8' });
  changedFiles = output
    .split('\n')
    .map(line => line.replace(/^[ MADRCU?]{1,2}\s+/, '').trim())
    .filter(Boolean);
} catch (e) {
  // Fallback if not inside git commit yet
  changedFiles = [];
}

const hasPTE = changedFiles.some(f => f.startsWith('exams/pte/'));
const hasIELTS = changedFiles.some(f => f.startsWith('exams/ielts/'));

if (hasPTE && hasIELTS) {
  console.error('\n❌ [VIOLATION] Exam Engine Isolation Rule breached!');
  console.error('AGENTS.md & ARCHITECTURE.md rule: A single PR cannot modify both exams/pte/ and exams/ielts/.');
  console.error('Changed files detected:');
  changedFiles.forEach(f => console.error(`  - ${f}`));
  process.exit(1);
}

// Check for committed secrets
const SECRET_PATTERNS = [
  /AIzaSy[A-Za-z0-9_-]{33}/, // Google API Key
  /sk-proj-[A-Za-z0-9_-]{48,}/, // OpenAI modern key
  /sk-ant-[A-Za-z0-9_-]{48,}/  // Anthropic modern key
];

for (const file of changedFiles) {
  if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.json') || file.endsWith('.yaml')) {
    try {
      const content = readFileSync(file, 'utf8');
      for (const pattern of SECRET_PATTERNS) {
        if (pattern.test(content)) {
          console.error(`\n❌ [SECURITY VIOLATION] Possible hardcoded API key detected in: ${file}`);
          process.exit(1);
        }
      }
    } catch {
      // Ignore deleted or unreadable files
    }
  }
}

console.log('✅ Exam Engine Isolation & Secrets Guard passed successfully.');
process.exit(0);
