// Reading card sections that depend only on the card's language settings and its
// clickable-word renderer: phrase breakdown, key vocabulary, highlights, paragraph
// details and AI message formatting.
import { ParagraphAnalysisResult, PhraseExplanation } from '../types';
import { getLanguageConfig } from '../config/languages';
import { decodeHtml, escapeHtml } from './popupHtml';

export interface CardRenderContext {
  targetLanguage: string;
  sourceLanguage: string;
  /** Renders text with every word clickable for a contextual lookup. */
  renderInteractiveSentence: (text: string, contextSentence?: string) => string;
}

/** Phrases shown before the "Show all" toggle in a phrase-by-phrase breakdown. */
export const PHRASE_PREVIEW_COUNT = 3;

export function renderPhraseBreakdownHtml(ctx: CardRenderContext, phrases: PhraseExplanation[], contextSentence?: string): string {
  const langConfig = getLanguageConfig(ctx.targetLanguage);
  return `
    <!-- B. Phrase-by-Phrase Explanation -->
    <div class="lf-phrase-breakdown-section">
      <div class="lf-section-label lf-u-c-accent-ink lf-u-mb-6px">
        <span>Phrase by phrase (${phrases.length}):</span>
      </div>
      <div class="lf-phrases-list ${phrases.length > PHRASE_PREVIEW_COUNT ? 'is-collapsed' : ''}">
        ${phrases.map((item, idx) => `
          <div class="lf-phrase-item ${idx >= PHRASE_PREVIEW_COUNT ? 'lf-phrase-extra' : ''}">
            <div class="lf-phrase-orig">
              <span class="lf-phrase-num">#${idx + 1}</span>
              <strong>"${ctx.renderInteractiveSentence(item.phrase, contextSentence)}"</strong>
            </div>
            <div class="lf-phrase-field lf-phrase-english">
              <span class="lf-field-label">Easy English:</span>
              <span>${ctx.renderInteractiveSentence(item.easyEnglish, contextSentence || item.phrase)}</span>
            </div>
            ${(ctx.targetLanguage !== 'en' || (item.easyBengali && item.easyBengali !== item.easyEnglish && !/[\u0980-\u09FF]/.test(item.easyBengali))) ? `
              <div class="lf-phrase-field lf-phrase-bengali">
                <span class="lf-field-label">${langConfig.flagEmoji} ${escapeHtml(langConfig.targetNativeHeader)}:</span>
                <span>${escapeHtml(item.easyBengali)}</span>
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
      ${phrases.length > PHRASE_PREVIEW_COUNT ? `
        <button type="button" class="lf-phrases-more" aria-expanded="false" data-more-label="Show all ${phrases.length} phrases">Show all ${phrases.length} phrases</button>
      ` : ''}
    </div>
  `;
}

export function ensurePhraseBreakdown(ctx: CardRenderContext, text: string,
    existingBreakdown?: PhraseExplanation[],
    clauses?: Array<{ text: string; role?: string; explanationBengali?: string }>,
    defaultBengali?: string): PhraseExplanation[] {
  if (existingBreakdown && existingBreakdown.length > 0) {
    return existingBreakdown;
  }

  // Placeholder text: Bengali for Bengali readers, English for every other language
  const isEn = ctx.targetLanguage !== 'bn';

  if (clauses && clauses.length > 0) {
    return clauses.map((c) => ({
      phrase: c.text,
      easyEnglish: c.role ? `Acts as the ${c.role.toLowerCase()} of the statement.` : 'Key clause conveying a central thought.',
      easyBengali: c.explanationBengali || defaultBengali || (isEn ? 'Main clause expressing a complete idea.' : 'বাক্যের প্রধান অর্থবহ খণ্ডবাক্য।')
    }));
  }

  // Heuristic phrase splitting on punctuation and clause markers
  const rawParts = text.trim().split(/(?:,\s*|;\s*|:\s*|\.\s+|\n+|—|–)/).map((p) => p.trim()).filter(Boolean);
  const phrases: PhraseExplanation[] = [];

  for (const part of rawParts) {
    const words = part.split(/\s+/).filter(Boolean);
    if (words.length > 10) {
      const mid = Math.ceil(words.length / 2);
      const chunk1 = words.slice(0, mid).join(' ');
      const chunk2 = words.slice(mid).join(' ');
      if (chunk1) {
        phrases.push({
          phrase: chunk1,
          easyEnglish: `Part stating: "${chunk1}".`,
          easyBengali: isEn ? `Contextual meaning for "${chunk1}".` : 'প্রাসঙ্গিক অর্থবহ ভাব ও বক্তব্য।'
        });
      }
      if (chunk2) {
        phrases.push({
          phrase: chunk2,
          easyEnglish: `Part stating: "${chunk2}".`,
          easyBengali: isEn ? `Contextual meaning for "${chunk2}".` : 'প্রাসঙ্গিক ভাবার্থ ও মূল বক্তব্য।'
        });
      }
    } else {
      phrases.push({
        phrase: part,
        easyEnglish: `Phrase conveying: "${part}".`,
        easyBengali: isEn ? `Contextual meaning for "${part}".` : 'প্রাসঙ্গিক ভাবার্থ ও মূল অর্থ।'
      });
    }
  }

  if (phrases.length === 0) {
    phrases.push({
      phrase: text.trim(),
      easyEnglish: 'This statement conveys a complete idea clearly.',
      easyBengali: defaultBengali || (isEn ? 'Complete thought and core meaning.' : 'সম্পূর্ণ বক্তব্য বা ভাবার্থ।')
    });
  }

  return phrases;
}

export function renderDifficultVocabulary(ctx: CardRenderContext, vocab: Array<{ word: string; meaningInContext: string; bengali: string; grammaticalRole?: string }>, contextSentence?: string): string {
  if (!vocab || vocab.length === 0) return '';
  return `
    <div class="lf-u-mb-12px">
      <div class="lf-section-label lf-u-c-accent-ink lf-u-mb-6px">
        <span>🔍 Difficult Words &amp; Key Terms (${vocab.length}):</span>
      </div>
      <div class="lf-u-d-flex lf-u-fd-column lf-u-gap-6px">
        ${vocab.map((item) => `
          <div class="lf-vocab-item lf-u-p-8px-10px lf-u-r-6px lf-u-bg-rgb0-0-0-002 lf-u-b-1px-solid-rgb0-0-0-006">
            <div class="lf-u-d-flex lf-u-ai-center lf-u-jc-space-between lf-u-mb-2px">
              <button class="lf-vocab-chip-btn" data-word="${escapeHtml(item.word)}" title="Analyze &quot;${escapeHtml(item.word)}&quot; in context">
                ${escapeHtml(item.word)} ↗
              </button>
              <div class="lf-u-d-flex lf-u-ai-center lf-u-gap-6px">
                ${item.grammaticalRole ? `
                  <span class="lf-u-fs-10px lf-u-c-ink-muted lf-u-bg-rgb0-0-0-004 lf-u-p-1px-5px lf-u-r-3px">
                    ${escapeHtml(item.grammaticalRole)}
                  </span>
                ` : ''}
                ${(item.bengali && (ctx.targetLanguage !== 'en' || !/[\u0980-\u09FF]/.test(item.bengali))) ? `
                  <span class="lf-vocab-bengali lf-u-fs-11p5px lf-u-fw-600 lf-u-c-accent-ink">${escapeHtml(item.bengali)}</span>
                ` : ''}
              </div>
            </div>
            <div class="lf-vocab-meaning lf-u-fs-12px lf-u-lh-1p4 lf-u-c-ink">
              ${ctx.renderInteractiveSentence(item.meaningInContext || 'Contextual meaning in this sentence.', contextSentence)}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

export function renderSummaryHighlights(ctx: CardRenderContext, highlights: string[], contextSentence?: string): string {
  if (!highlights || highlights.length === 0) return '';
  return `
    <div class="lf-u-mb-12px lf-u-p-10px-12px lf-u-r-8px lf-u-bg-rgb0-0-0-002 lf-u-b-1px-solid-rgb0-0-0-006">
      <div class="lf-u-fs-11p5px lf-u-fw-700 lf-u-tt-uppercase lf-u-c-ink lf-u-mb-6px">
        📌 Summary Highlights:
      </div>
      <ul class="lf-u-m-0 lf-u-pl-18px lf-u-d-flex lf-u-fd-column lf-u-gap-4px lf-u-fs-12px lf-u-c-ink">
        ${highlights.map(h => `<li>${ctx.renderInteractiveSentence(h, contextSentence)}</li>`).join('')}
      </ul>
    </div>
  `;
}

export function renderParagraphAnalysisDetails(ctx: CardRenderContext, p: ParagraphAnalysisResult): string {
  const vocab = p.keyVocabulary || [];
  const sentences = p.sentenceBreakdown || [];

  return `
    <div class="lf-u-mt-10px lf-u-pt-10px lf-u-bt-0p5px-solid-rgb0-0-0-008">
      ${sentences.length > 0 ? `
        <div class="lf-u-mb-12px">
          <strong class="lf-u-fs-11p5px lf-u-c-accent-ink lf-u-tt-uppercase lf-u-mb-6px" style="display: block;">
            📑 Sentence Flow:
          </strong>
          <ul class="lf-u-pl-16px lf-u-m-0 lf-u-fs-12px lf-u-c-ink lf-u-lh-1p5">
            ${sentences.map((s) => `<li>${ctx.renderInteractiveSentence(s, s)}</li>`).join('')}
          </ul>
        </div>
      ` : ''}

      ${vocab.length > 0 ? `
        <div class="lf-u-mb-12px">
          <strong class="lf-u-fs-11p5px lf-u-c-accent-ink lf-u-tt-uppercase lf-u-mb-6px" style="display: block;">
            🔍 Key Vocabulary (${vocab.length}):
          </strong>
          ${vocab.map((item) => `
            <div class="lf-vocab-item">
              <div class="lf-u-d-flex lf-u-ai-center lf-u-jc-space-between lf-u-mb-4px">
                <button class="lf-vocab-chip-btn" data-word="${escapeHtml(item.term)}" title="Analyze &quot;${escapeHtml(item.term)}&quot; in context">
                  ${escapeHtml(item.term)} ↗
                </button>
                <span class="lf-u-fs-11p5px lf-u-c-accent-ink lf-u-fw-600">${escapeHtml(item.bengali || '')}</span>
              </div>
              <div class="lf-u-fs-12p5px lf-u-c-ink lf-u-lh-1p4">
                ${ctx.renderInteractiveSentence(item.meaning || 'Meaning in paragraph context.', p.selectedText)}
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}

      ${p.argumentStructure ? `
        <div class="lf-u-mb-10px">
          <strong class="lf-u-fs-11p5px lf-u-c-ink-muted lf-u-tt-uppercase lf-u-mb-4px" style="display: block;">
            🏛️ Argument Structure:
          </strong>
          <div class="lf-u-fs-12px lf-u-c-ink lf-u-lh-1p45">
            ${ctx.renderInteractiveSentence(p.argumentStructure, p.selectedText)}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

export function formatClaudeMessage(ctx: CardRenderContext, rawText: string, contextSentence?: string): string {
  if (!rawText) return '';
  const cleanText = decodeHtml(rawText);

  // Markdown replacements: use unique placeholders that won't collide with text
  let formatted = cleanText;

  // Convert **bold** to placeholders
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '@@LF_STRONG_START@@$1@@LF_STRONG_END@@');

  // Convert *italic* to placeholders
  formatted = formatted.replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, '$1@@LF_EM_START@@$2@@LF_EM_END@@$3');

  // Convert `code` to placeholders
  formatted = formatted.replace(/`([^`]+)`/g, '@@LF_CODE_START@@$1@@LF_CODE_END@@');

  // Convert newlines to placeholders
  formatted = formatted.replace(/\n\n+/g, '@@LF_BR2@@');
  formatted = formatted.replace(/\n/g, '@@LF_BR1@@');

  // Split on placeholders
  const parts = formatted.split(/(@@LF_[A-Z0-9_]+@@)/g);
  const resultParts: string[] = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part === '@@LF_STRONG_START@@') {
      resultParts.push('<strong>');
    } else if (part === '@@LF_STRONG_END@@') {
      resultParts.push('</strong>');
    } else if (part === '@@LF_EM_START@@') {
      resultParts.push('<em>');
    } else if (part === '@@LF_EM_END@@') {
      resultParts.push('</em>');
    } else if (part === '@@LF_CODE_START@@') {
      const codeContent = parts[++i] || '';
      resultParts.push(`<code class="lf-u-bg-rgb0-0-0-03 lf-u-p-1px-4px lf-u-r-3px lf-u-ff-monospace lf-u-fs-11p5px lf-u-c-purple-ink">${escapeHtml(codeContent)}</code>`);
      if (parts[i + 1] === '@@LF_CODE_END@@') {
        i++;
      }
    } else if (part === '@@LF_CODE_END@@') {
      // standalone end tag if any, ignore
    } else if (part === '@@LF_BR2@@') {
      resultParts.push('<br/><br/>');
    } else if (part === '@@LF_BR1@@') {
      resultParts.push('<br/>');
    } else if (part) {
      // Plain text segment: render interactive words!
      // renderInteractiveSentence safely escapes every token using escapeHtml()!
      resultParts.push(ctx.renderInteractiveSentence(part, contextSentence || cleanText));
    }
  }

  return resultParts.join('');
}
