#!/usr/bin/env node
// Cost report from usage_events and spend_daily (CLOUD_BACKEND_DESIGN.md §8, M5).
//   npm run report:costs                 local D1, last 7 days
//   npm run report:costs -- --remote --days 30
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPricing, spendQuery, summarize, usageQuery } from './costReport.mjs';

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const remote = args.includes('--remote');
const daysArg = args.indexOf('--days');
const days = daysArg >= 0 ? Number(args[daysArg + 1]) : 7;

const wranglerBin = path.join(serverDir, 'node_modules', 'wrangler', 'bin', 'wrangler.js');

// Runs wrangler with Node directly (no shell, so the SQL is never re-split) and passes the SQL as a file.
function d1(sql) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lexiflow-report-'));
  const file = path.join(dir, 'query.sql');
  fs.writeFileSync(file, sql);
  try {
    const out = execFileSync(
      process.execPath,
      [wranglerBin, 'd1', 'execute', 'lexiflow', remote ? '--remote' : '--local', '--json', '--file', file],
      { cwd: serverDir, encoding: 'utf8', env: { ...process.env, CI: '1' } }
    );
    const parsed = JSON.parse(out.slice(out.indexOf('[')));
    return parsed[0]?.results ?? [];
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const usd = (n) => `$${n.toFixed(n !== 0 && Math.abs(n) < 0.01 ? 6 : 2)}`;
const pct = (n) => `${Math.round(n * 100)}%`;

const pricing = readPricing(fs.readFileSync(path.join(serverDir, 'wrangler.toml'), 'utf8'));
const { lines, totals } = summarize(d1(usageQuery(days)), pricing);
const spend = d1(spendQuery(days));

console.log(`LexiFlow Cloud cost report: ${remote ? 'remote' : 'local'} D1, last ${days} day(s)`);
console.log(`Prices: $${pricing.inputPerMTok}/M input, $${pricing.outputPerMTok}/M output tokens (wrangler.toml)\n`);

if (lines.length === 0) {
  console.log('No usage events in this period.');
} else {
  console.table(
    lines.map((l) => ({
      day: l.day,
      endpoint: l.endpoint,
      requests: l.requests,
      'cache hits': pct(l.cacheHitRate),
      refunded: l.refunded,
      rejected: l.rejected,
      credits: l.credits,
      users: l.users,
      'model ms': l.modelLatencyMs ?? '-',
      cost: usd(l.costUsd),
      'cost/credit': usd(l.costPerCredit)
    }))
  );
  console.log(
    `Total: ${totals.requests} requests, ${totals.credits} credits charged, ${pct(totals.cacheHitRate)} served from cache, ` +
      `${pct(totals.refundRate)} refunded, ${totals.rejected} rejected by quota.`
  );
  console.log(`Model cost: ${usd(totals.costUsd)} (${totals.tokensIn} in / ${totals.tokensOut} out tokens)`);
  console.log(`Cost per charged credit: ${usd(totals.costPerCredit)}  <- compare with the price of a credit in each plan\n`);
}

if (spend.length > 0) {
  console.log(`Live spend counter (spend_daily), Free budget $${pricing.freeDailyBudgetUsd}/day:`);
  console.table(
    spend.map((s) => ({
      day: s.day,
      plan: s.plan,
      spend: usd(s.micro_usd / 1e6),
      ...(s.plan === 'free' ? { 'of budget': pct(s.micro_usd / 1e6 / pricing.freeDailyBudgetUsd) } : {})
    }))
  );
}
