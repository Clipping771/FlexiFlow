import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { POPUP_STYLES } from '../styles';

// Guards against the regressions that made the reading card unreadable in the past:
// a stray brace silently dropping the dark background, and hard-coded ink colours
// that ignore the active theme.

const root = resolve(__dirname, '..', '..', '..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
}

function braceProblems(css: string): string[] {
  const problems: string[] = [];
  let depth = 0;
  stripComments(css).split('\n').forEach((line, i) => {
    for (const ch of line) {
      if (ch === '{') depth++;
      if (ch === '}') {
        depth--;
        if (depth < 0) {
          problems.push(`stray "}" on line ${i + 1}`);
          depth = 0;
        }
      }
    }
  });
  if (depth !== 0) problems.push(`${depth} unclosed "{"`);
  return problems;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [0, 2, 4].map((k) => parseInt(full.slice(k, k + 2), 16)) as [number, number, number];
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Reads `--name: #hex;` declarations from the first rule whose selector matches `selector`. */
function tokensOf(css: string, selector: RegExp): Record<string, string> {
  const rules = stripComments(css).match(/[^{}]+\{[^{}]*\}/g) || [];
  const rule = rules.find((r) => selector.test(r.slice(0, r.indexOf('{'))));
  const out: Record<string, string> = {};
  if (!rule) return out;
  for (const m of rule.matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{3,6})\s*;/g)) out[m[1]] = m[2];
  return out;
}

describe('Stylesheet guards', () => {
  it('reading card stylesheet is loaded and has balanced braces', () => {
    expect(POPUP_STYLES.length).toBeGreaterThan(10000);
    expect(braceProblems(POPUP_STYLES)).toEqual([]);
  });

  it('toolbar popup and dashboard stylesheets have balanced braces', () => {
    expect(braceProblems(read('src/popup/popup.css'))).toEqual([]);
    expect(braceProblems(read('src/dashboard/dashboard.css'))).toEqual([]);
  });

  it('reading card markup uses theme ink tokens instead of hard-coded text colours', () => {
    const src = read('src/content/popupView.ts');
    const hardCoded = [...src.matchAll(/(?<![-\w])color:\s*(#[0-9a-fA-F]{3,6})\b/g)]
      .map((m) => m[1].toLowerCase())
      .filter((c) => c !== '#fff' && c !== '#ffffff');
    expect(hardCoded).toEqual([]);
  });

  it('reading card markup keeps fixed styling in CSS classes, not inline styles', () => {
    const src = read('src/content/popupView.ts');
    // Allowed inline: values computed at render time (${...}) and display toggles the view reads back.
    const fixedInline = [...src.matchAll(/style="([^"]*)"/g)]
      .map((m) => m[1])
      .filter((style) => !style.includes('${'))
      .filter((style) => !/^\s*display:\s*(none|block);?\s*$/.test(style));
    expect(fixedInline).toEqual([]);
  });

  it('reading card ink tokens stay readable in light and dark themes', () => {
    const light = tokensOf(POPUP_STYLES, /^\s*\.lexiflow-popup\s*$/);
    const dark = tokensOf(POPUP_STYLES, /\.lexiflow-popup\.theme-dark\s*$/);
    const inks = ['--lf-ink', '--lf-ink-muted', '--lf-accent-ink', '--lf-purple-ink', '--lf-danger-ink', '--lf-success-ink', '--lf-warn-ink'];

    for (const ink of inks) {
      expect(light[ink], `light ${ink}`).toBeDefined();
      expect(dark[ink], `dark ${ink}`).toBeDefined();
      // Light card canvas and cards; dark card canvas and raised surface.
      for (const bg of ['#ffffff', '#f3f5f9']) {
        expect(contrast(light[ink], bg), `light ${ink} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
      for (const bg of ['#000000', dark['--lf-surface']]) {
        expect(contrast(dark[ink], bg), `dark ${ink} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('toolbar popup ink tokens stay readable in light and dark themes', () => {
    const css = read('src/popup/popup.css');
    const dark = tokensOf(css, /^\s*:root,\s*\[data-theme="dark"\]\s*$/m);
    const lightRules = (stripComments(css).match(/\[data-theme="light"\]\s*\{[^{}]*--hub-ink[^{}]*\}/g) || [])[0] || '';
    const light: Record<string, string> = {};
    for (const m of lightRules.matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{3,6})\s*;/g)) light[m[1]] = m[2];

    // The hub block is the :root/dark rule that defines --hub-ink.
    const hubDark = (stripComments(css).match(/:root,\s*\[data-theme="dark"\]\s*\{[^{}]*--hub-ink[^{}]*\}/g) || [])[0] || '';
    const darkHub: Record<string, string> = {};
    for (const m of hubDark.matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{3,6})\s*;/g)) darkHub[m[1]] = m[2];
    expect(Object.keys(dark).length).toBeGreaterThan(0);

    for (const ink of ['--hub-ink', '--hub-ink-muted', '--hub-accent', '--hub-ok', '--hub-warn']) {
      expect(contrast(light[ink], light['--hub-card']), `light ${ink}`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(darkHub[ink], darkHub['--hub-card']), `dark ${ink}`).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(light['--hub-accent-ink'], light['--hub-accent']), 'light button text').toBeGreaterThanOrEqual(4.5);
    expect(contrast(darkHub['--hub-accent-ink'], darkHub['--hub-accent']), 'dark button text').toBeGreaterThanOrEqual(4.5);
  });
});
