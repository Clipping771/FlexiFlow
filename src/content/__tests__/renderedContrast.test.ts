import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { existsSync } from 'fs';
import type { Browser } from 'puppeteer-core';
import { PopupView } from '../popupView';
import { POPUP_STYLES } from '../styles';
import { mockWordStageA, mockPhraseAnalysis, mockSentenceResult, mockStageB, mockParagraph } from './fixtures';

// Renders every reading card view in a real browser (light and dark) and checks that each
// piece of visible text meets WCAG contrast: 4.5:1, or 3:1 for large text.
// Opt-in because it needs a local Chrome or Edge: `npm run test:contrast`.

const BROWSERS = [
  process.env.LEXIFLOW_BROWSER,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium'
].filter((p): p is string => Boolean(p));

async function renderViews(): Promise<Record<string, string>> {
  const flush = async () => { for (let k = 0; k < 5; k++) await new Promise((r) => setTimeout(r, 0)); };
  const make = () => {
    const p = new PopupView({
      onClose: vi.fn(), onSave: vi.fn(), onChangeMode: vi.fn(), onSelectWord: vi.fn(),
      onWritingAssist: vi.fn(), onAskFollowUp: vi.fn().mockResolvedValue(null),
      onFetchStageB: vi.fn().mockResolvedValue(mockStageB), onReportWrongMeaning: vi.fn(),
      onUpdateSettings: vi.fn(), onRetry: vi.fn()
    } as any);
    document.body.appendChild(p.getElement());
    return p;
  };
  const out: Record<string, string> = {};
  const eachTab = async (p: PopupView, prefix: string) => {
    const el = p.getElement();
    const tabs = [...el.querySelectorAll<HTMLElement>('.lf-tabs .lf-tab')].map((b) => b.dataset.tab).filter(Boolean);
    for (const t of tabs) {
      (el.querySelector(`.lf-tab[data-tab="${t}"]`) as HTMLElement | null)?.click();
      await flush();
      out[`${prefix}-${t}`] = el.outerHTML;
    }
  };

  let p = make(); p.showSentence(mockSentenceResult, '', ''); await flush(); await eachTab(p, 'sentence');
  p = make(); p.setReadingMode('learn'); p.showSentence(mockSentenceResult, '', ''); await flush(); out['sentence-learn'] = p.getElement().outerHTML;
  p = make(); p.setFirstUseTip(true); p.showSentence(mockSentenceResult, '', ''); (p.getElement().querySelector('.lf-textsize-btn') as HTMLElement).click(); out['sentence-tip-menu'] = p.getElement().outerHTML;
  p = make(); p.showStageA(mockWordStageA, 'The plan came under scrutiny.', ''); await flush(); await eachTab(p, 'word');
  p = make(); p.setReadingMode('learn'); p.showStageA(mockWordStageA, 'The plan came under scrutiny.', ''); await flush(); out['word-learn'] = p.getElement().outerHTML;
  p = make(); p.showStageA(mockWordStageA, 'The plan came under scrutiny.', ''); (p.getElement().querySelector('.lf-report-trigger-btn') as HTMLElement).click(); out['word-report'] = p.getElement().outerHTML;
  p = make(); p.showAnalysis(mockPhraseAnalysis, 'On the other hand, we must be cautious.', ''); await flush(); await eachTab(p, 'phrase');
  p = make(); p.showAnalysis(mockParagraph, '', ''); await flush(); out['paragraph'] = p.getElement().outerHTML;
  p = make(); p.showLoading('scrutiny', 'word'); out['loading'] = p.getElement().outerHTML;
  p = make(); p.showError('Network error', 'scrutiny'); out['error'] = p.getElement().outerHTML;
  return out;
}

/** Runs in the browser: returns text that fails contrast inside each shadow root. */
function auditInPage(): string[] {
  function parse(c: string) {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  }
  type C = { r: number; g: number; b: number; a: number };
  const lum = ({ r, g, b }: C) => {
    const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const mix = (t: C, b: C): C => ({ r: t.r * t.a + b.r * (1 - t.a), g: t.g * t.a + b.g * (1 - t.a), b: t.b * t.a + b.b * (1 - t.a), a: 1 });
  const problems: string[] = [];
  document.querySelectorAll<HTMLElement>('.host').forEach((host) => {
    const root = host.shadowRoot!;
    const pageBg = host.dataset.theme === 'dark' ? { r: 34, g: 34, b: 34, a: 1 } : { r: 255, g: 255, b: 255, a: 1 };
    root.querySelectorAll<HTMLElement>('.lexiflow-popup *').forEach((el) => {
      const cs = getComputedStyle(el);
      const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim());
      if (!ownText || cs.visibility === 'hidden' || el.getClientRects().length === 0) return;
      if (el.closest('[aria-hidden="true"]')) return;
      let opacity = 1;
      for (let e: HTMLElement | null = el; e; e = e.parentElement) opacity *= parseFloat(getComputedStyle(e).opacity);
      if (opacity < 0.95) return; // placeholders and disabled controls
      const stack: C[] = [];
      for (let e: HTMLElement | null = el; e; e = e.parentElement) {
        const c = parse(getComputedStyle(e).backgroundColor);
        if (c && c.a > 0) stack.push(c);
        if (c && c.a >= 1) break;
      }
      let bg = pageBg;
      for (let i = stack.length - 1; i >= 0; i--) bg = mix(stack[i], bg);
      const fg = mix(parse(cs.color)!, bg);
      const [hi, lo] = [lum(fg), lum(bg)].sort((x, y) => y - x);
      const ratio = (hi + 0.05) / (lo + 0.05);
      const size = parseFloat(cs.fontSize);
      const large = size >= 18.66 || (size >= 14 && parseInt(cs.fontWeight, 10) >= 700);
      if (ratio < (large ? 3 : 4.5)) {
        problems.push(`${host.dataset.view} [${host.dataset.theme}] ${ratio.toFixed(2)} "${el.textContent!.trim().slice(0, 30)}" .${String(el.className).split(' ')[0]}`);
      }
    });
  });
  return problems;
}

const executablePath = BROWSERS.find((p) => existsSync(p));

describe.runIf(process.env.LEXIFLOW_CONTRAST === '1')('Rendered contrast (real browser)', () => {
  let browser: Browser;

  beforeAll(async () => {
    if (!executablePath) throw new Error('No Chrome or Edge found; set LEXIFLOW_BROWSER to its path.');
    const puppeteer = await import('puppeteer-core');
    browser = await puppeteer.launch({ executablePath, headless: true });
  }, 30000);

  afterAll(async () => {
    await browser?.close();
  });

  it('every visible text in every reading card view passes WCAG contrast in light and dark', async () => {
    const views = await renderViews();
    let body = '';
    for (const theme of ['light', 'dark']) {
      for (const [name, html] of Object.entries(views)) {
        const themed = html
          .replace(/theme-(dark|light)/g, `theme-${theme}`)
          .replace(/data-theme="(dark|light)"/, `data-theme="${theme}"`);
        body += `<div class="host" data-view="${name}" data-theme="${theme}" style="position:relative;width:480px;height:720px;display:inline-block;overflow:hidden"></div>`;
        body += `<template><style>${POPUP_STYLES}*{transition:none!important;animation:none!important}</style>${themed}</template>`;
      }
    }
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });
    await page.setContent(`<!doctype html><meta charset="utf-8"><body style="margin:0">${body}
      <script>
        const hosts = [...document.querySelectorAll('.host')], tpls = [...document.querySelectorAll('template')];
        hosts.forEach((h, i) => h.attachShadow({ mode: 'open' }).appendChild(tpls[i].content.cloneNode(true)));
      </script>`, { waitUntil: 'load' });
    const problems = await page.evaluate(auditInPage);
    expect(Object.keys(views).length).toBeGreaterThan(15);
    expect(problems).toEqual([]);
  }, 60000);
});
