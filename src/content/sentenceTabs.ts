// Grammar and Clauses tab renderers for the sentence reading card.
// They are pure: everything they need from the card comes in through SentenceTabContext.
import { SentenceAnalysisResult } from '../types';
import { getAllLanguages } from '../config/languages';
import { getSentenceOverviewTeaching, buildBeginnerBreakdownSections } from '../services/grammar/grammarL10n';
import { escapeHtml } from './popupHtml';
import type { CardRenderContext } from './cardSections';

export type SentenceTabContext = CardRenderContext;

export function renderSentenceGrammarTab(ctx: SentenceTabContext, s: SentenceAnalysisResult): string {
  const structure = s.sentenceStructure;
  const clauses = Array.isArray(s.clauses) ? s.clauses : [];
  const mainClause = clauses.find(c => c.type === 'main') || clauses[0] || { text: s.selectedText || '', type: 'main', role: 'Main Clause' };
  const overview = getSentenceOverviewTeaching(structure?.type || 'complex', ctx.targetLanguage);
  const sections = buildBeginnerBreakdownSections(mainClause, s.selectedText, ctx.targetLanguage);
  const patternFormula = s.patternSummary?.formula || (sections.length > 0 ? sections.map(sec => sec.badgeLetter).join(' + ') : 'S + V + DO');
  const grammarRules = Array.isArray(s.grammarRules) ? s.grammarRules : [];
  const connectors = Array.isArray(s.connectors) ? s.connectors : [];
  const wordGrammar = Array.isArray(s.wordLevelGrammar) ? s.wordLevelGrammar : [];
  const mistakes = s.commonMistakesAndAlternatives;
  const practice = s.practice;

  const allLangs = getAllLanguages();

  return `
    <div class="lf-gb-container">
      <!-- 1. Header Row -->
      <div class="lf-gb-header-card">
        <div class="lf-u-d-flex lf-u-ai-center lf-u-jc-space-between lf-u-w-100pct">
          <div class="lf-u-d-flex lf-u-ai-center lf-u-gap-8px">
            <span class="lf-section-tag lf-u-fs-11px lf-u-fw-700 lf-u-ls-0p05em lf-u-tt-uppercase lf-u-c-accent-ink">Grammar</span>
          </div>
          <div class="lf-gb-lang-picker lf-u-d-flex lf-u-ai-center lf-u-gap-5px">
            <span class="lf-source-pill lf-u-fs-10p5px lf-u-fw-600 lf-u-c-ink-muted lf-u-bg-rgb120-120-128-01 lf-u-p-2px-5px lf-u-r-4px">Source: ${ctx.sourceLanguage ? ctx.sourceLanguage.toUpperCase() : 'EN'}</span>
            <span class="lf-u-fs-10px lf-u-c-ink-muted">➔</span>
            <label for="lf-explanation-lang-select" class="lf-gb-lang-label lf-u-fs-11px lf-u-c-ink-muted lf-u-fw-600">Target:</label>
            <select id="lf-explanation-lang-select" class="lf-explanation-lang-select lf-u-fs-11p5px lf-u-p-2px-6px lf-u-r-4px lf-u-b-1px-solid-rgb0-0-0-015 lf-u-bg-surface lf-u-c-ink lf-u-maxw-140px">
              ${allLangs.map((l) => `
                <option value="${l.targetLang}" ${ctx.targetLanguage === l.targetLang ? 'selected' : ''}>
                  ${l.flagEmoji} ${escapeHtml(l.targetNativeLabel || l.targetLabel)}
                </option>
              `).join('')}
            </select>
          </div>
        </div>
      </div>

      <!-- 2. Sentence Overview & Syntactic Pattern -->
      <div class="lf-gb-overview-card lf-u-mt-10px lf-u-p-12px lf-u-r-10px lf-u-bg-rgb0-0-0-002 lf-u-b-1px-solid-rgb0-0-0-008">
        <div class="lf-u-d-flex lf-u-ai-center lf-u-jc-space-between lf-u-mb-6px">
          <div class="lf-gb-section-title lf-u-fs-12px lf-u-fw-700 lf-u-tt-uppercase lf-u-ls-0p04em lf-u-c-ink-muted">Sentence structure</div>
          <div class="lf-gb-type-pill lf-u-fs-10p5px lf-u-fw-700 lf-u-tt-uppercase lf-u-p-2px-7px lf-u-r-4px lf-u-bg-rgb37-99-235-008 lf-u-c-accent-ink lf-u-b-1px-solid-rgb37-99-235-02">${escapeHtml(overview.badgeLabel)}</div>
        </div>
        <div class="lf-gb-overview-text lf-u-fs-13px lf-u-c-ink lf-u-lh-1p45">${ctx.renderInteractiveSentence(structure?.explanation || overview.explanation, s.selectedText)}</div>
        ${(structure?.explanationBengali && ctx.targetLanguage !== 'en') ? `
          <div class="lf-gb-overview-target lf-u-mt-6px lf-u-fs-13px lf-u-fw-500 lf-u-c-accent-ink lf-u-lh-1p45">
            ${escapeHtml(structure.explanationBengali)}
          </div>
        ` : ''}
        <div class="lf-gb-pattern-formula lf-u-mt-10px lf-u-ff-ui-monospace-sfmono-regular-menlo-monosp lf-u-fs-12px lf-u-p-6px-10px lf-u-r-6px lf-u-bg-rgb0-0-0-003 lf-u-b-1px-solid-rgb0-0-0-006 lf-u-fw-600 lf-u-c-ink">
          ${escapeHtml(patternFormula)}
        </div>
        ${s.patternSummary?.explanation ? `
          <div class="lf-u-fs-12px lf-u-c-ink-muted lf-u-mt-6px lf-u-lh-1p4">
            ${ctx.renderInteractiveSentence(s.patternSummary.explanation, s.selectedText)}
          </div>
        ` : ''}
      </div>

      <!-- 3. Key Grammar Rules (Deep Real AI Explanations) -->
      ${grammarRules.length > 0 ? `
        <div class="lf-gb-rules-section lf-u-mt-12px">
          <div class="lf-gb-section-title lf-u-fs-12px lf-u-fw-700 lf-u-tt-uppercase lf-u-ls-0p04em lf-u-c-ink-muted lf-u-mb-8px">Key Grammar Rules (${grammarRules.length})</div>
          <div class="lf-u-d-flex lf-u-fd-column lf-u-gap-10px">
            ${grammarRules.map(r => `
              <div class="lf-gb-rule-card lf-u-p-12px lf-u-r-10px lf-u-bg-rgb0-0-0-002 lf-u-b-1px-solid-rgb0-0-0-008">
                <div class="lf-u-fs-13px lf-u-fw-700 lf-u-c-ink lf-u-mb-4px">
                  ${escapeHtml(r.ruleName)}
                </div>
                ${r.whereIsIt ? `
                  <div class="lf-u-fs-11p5px lf-u-fst-italic lf-u-c-accent-ink lf-u-mb-6px">
                    In sentence: “${ctx.renderInteractiveSentence(r.whereIsIt, s.selectedText)}”
                  </div>
                ` : ''}
                <div class="lf-u-fs-12p5px lf-u-c-ink lf-u-lh-1p45 lf-u-mb-6px">
                  ${ctx.renderInteractiveSentence(r.whatIsIt || r.howItWorks, s.selectedText)}
                </div>
                ${r.whyUsed ? `
                  <div class="lf-u-fs-12px lf-u-c-ink-muted lf-u-mb-6px">
                    <strong>Purpose:</strong> ${ctx.renderInteractiveSentence(r.whyUsed, s.selectedText)}
                  </div>
                ` : ''}
                ${r.reusablePattern ? `
                  <div class="lf-u-fs-11p5px lf-u-ff-ui-monospace-monospace lf-u-p-4px-8px lf-u-r-4px lf-u-bg-rgb0-0-0-004 lf-u-mb-6px lf-u-c-ink">
                    Pattern: ${escapeHtml(r.reusablePattern)}
                  </div>
                ` : ''}
                ${r.example?.english ? `
                  <div class="lf-u-fs-12px lf-u-p-6px-10px lf-u-bl-2px-solid-2563eb lf-u-bg-rgb37-99-235-003 lf-u-r-0-6px-6px-0 lf-u-mb-4px">
                    <div class="lf-u-fw-600">Example: ${ctx.renderInteractiveSentence(r.example.english, r.example.english)}</div>
                    ${r.example.bengali && ctx.targetLanguage !== 'en' ? `
                      <div class="lf-u-c-accent-ink lf-u-fs-11p5px lf-u-mt-2px">${escapeHtml(r.example.bengali)}</div>
                    ` : ''}
                  </div>
                ` : ''}
                ${r.commonConfusion ? `
                  <div class="lf-u-fs-11p5px lf-u-c-danger-ink lf-u-mt-4px">
                    ⚠️ <strong>Watch out:</strong> ${ctx.renderInteractiveSentence(r.commonConfusion, s.selectedText)}
                  </div>
                ` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- 4. Dynamic Syntactic Constituents (Subject, Verb, Object, Adverbials) -->
      <div class="lf-gb-explore-section lf-u-mt-12px">
        <div class="lf-gb-section-title lf-u-fs-12px lf-u-fw-700 lf-u-tt-uppercase lf-u-ls-0p04em lf-u-c-ink-muted lf-u-mb-4px">Parts of the sentence</div>
        <div class="lf-gb-section-subtitle lf-u-fs-11p5px lf-u-c-ink-muted lf-u-mb-8px">See what each part does in the sentence.</div>

        <div class="lf-gb-accordion-list lf-u-d-flex lf-u-fd-column lf-u-gap-8px">
          ${sections.map((sec, idx) => `
            <details class="lf-gb-accordion lf-u-r-8px lf-u-b-1px-solid-rgb0-0-0-008 lf-u-bg-rgb0-0-0-0015 lf-u-ov-hidden" ${idx === 0 ? 'open' : ''}>
              <summary class="lf-gb-summary lf-u-p-10px-12px lf-u-cur-pointer lf-u-d-flex lf-u-ai-center lf-u-jc-space-between lf-u-us-none">
                <div class="lf-u-d-flex lf-u-ai-center lf-u-gap-10px">
                  <span class="lf-constituent-tag lf-u-ff-ui-monospace-monospace lf-u-fs-11px lf-u-fw-700 lf-u-p-2px-6px lf-u-r-4px lf-u-bg-rgb37-99-235-008 lf-u-c-accent-ink">${escapeHtml(sec.badgeLetter)}</span>
                  <div>
                    <span class="lf-u-fs-12p5px lf-u-fw-700 lf-u-c-ink lf-u-mr-6px">${escapeHtml(sec.title)}:</span>
                    <span class="lf-u-fs-12p5px lf-u-fw-500 lf-u-c-ink-muted">“${ctx.renderInteractiveSentence(sec.phrase, s.selectedText)}”</span>
                  </div>
                </div>
                <span class="lf-gb-acc-chevron lf-u-fs-10px lf-u-c-ink-muted">▼</span>
              </summary>
              <div class="lf-gb-body lf-u-p-10px-12px-12px-12px lf-u-bt-1px-solid-rgb0-0-0-006 lf-u-fs-12px lf-u-lh-1p45">
                <div class="lf-u-c-ink lf-u-mb-6px">${ctx.renderInteractiveSentence(sec.simpleText, s.selectedText)}</div>
                ${sec.guidingQuestion ? `
                  <div class="lf-u-fs-11p5px lf-u-c-accent-ink lf-u-fw-500 lf-u-mb-4px">${ctx.renderInteractiveSentence(sec.guidingQuestion, s.selectedText)}</div>
                ` : ''}
                ${sec.tipText ? `
                  <div class="lf-u-fs-11px lf-u-c-ink-muted lf-u-bg-rgb0-0-0-003 lf-u-p-6px-8px lf-u-r-6px lf-u-mt-6px">
                    💡 ${ctx.renderInteractiveSentence(sec.tipText, s.selectedText)}
                  </div>
                ` : ''}
              </div>
            </details>
          `).join('')}
        </div>
      </div>

      <!-- 5. Discourse Connectors (if present) -->
      ${connectors.length > 0 ? `
        <div class="lf-gb-connectors-section lf-u-mt-12px">
          <div class="lf-gb-section-title lf-u-fs-12px lf-u-fw-700 lf-u-tt-uppercase lf-u-ls-0p04em lf-u-c-ink-muted lf-u-mb-8px">Discourse &amp; Connectors</div>
          <div class="lf-u-d-flex lf-u-fd-column lf-u-gap-8px">
            ${connectors.map(conn => `
              <div class="lf-u-p-10px-12px lf-u-r-8px lf-u-bg-rgb0-0-0-002 lf-u-b-1px-solid-rgb0-0-0-008">
                <div class="lf-u-d-flex lf-u-ai-center lf-u-gap-8px lf-u-mb-4px">
                  <strong class="lf-u-c-accent-ink lf-u-fs-13px">“${ctx.renderInteractiveSentence(conn.connector, s.selectedText)}”</strong>
                  <span class="lf-u-fs-10p5px lf-u-p-1px-6px lf-u-r-4px lf-u-bg-rgb37-99-235-008 lf-u-c-accent-ink lf-u-fw-600">
                    ${escapeHtml(conn.logicalRelationship || 'Transition')}
                  </span>
                </div>
                <div class="lf-u-fs-12px lf-u-c-ink lf-u-mb-4px">${ctx.renderInteractiveSentence(conn.meaning, s.selectedText)}</div>
                ${conn.grammaticalPattern ? `
                  <div class="lf-u-fs-11p5px lf-u-ff-ui-monospace-monospace lf-u-c-ink-muted lf-u-mb-4px">
                    Pattern: ${escapeHtml(conn.grammaticalPattern)}
                  </div>
                ` : ''}
                ${conn.contrastWithSimilar ? `
                  <div class="lf-u-fs-11p5px lf-u-c-ink-muted">
                    Contrast: ${ctx.renderInteractiveSentence(conn.contrastWithSimilar, s.selectedText)}
                  </div>
                ` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- 6. Word-Level Grammar in Context (if present) -->
      ${wordGrammar.length > 0 ? `
        <div class="lf-gb-words-section lf-u-mt-12px">
          <div class="lf-gb-section-title lf-u-fs-12px lf-u-fw-700 lf-u-tt-uppercase lf-u-ls-0p04em lf-u-c-ink-muted lf-u-mb-8px">Word-Level Grammar</div>
          <div class="lf-u-d-flex lf-u-fd-column lf-u-gap-6px">
            ${wordGrammar.map(wg => `
              <div class="lf-u-d-flex lf-u-ai-flex-start lf-u-jc-space-between lf-u-p-8px-10px lf-u-r-6px lf-u-bg-rgb0-0-0-002 lf-u-b-1px-solid-rgb0-0-0-006 lf-u-fs-12px">
                <div>
                  <span class="lf-sentence-word lf-u-cur-pointer lf-u-fw-700 lf-u-c-ink" data-word="${escapeHtml(wg.word.trim())}" data-context="${escapeHtml(s.selectedText)}" title="Inspect &quot;${escapeHtml(wg.word.trim())}&quot;">${escapeHtml(wg.word)}</span>
                  <span class="lf-u-c-ink-muted lf-u-fs-11px lf-u-ml-6px">(${escapeHtml(wg.partOfSpeech)})</span>
                  ${wg.usageNotes ? `<div class="lf-u-fs-11p5px lf-u-c-ink-muted lf-u-mt-2px">${ctx.renderInteractiveSentence(wg.usageNotes, s.selectedText)}</div>` : ''}
                </div>
                <span class="lf-u-fs-11px lf-u-fw-600 lf-u-c-accent-ink lf-u-bg-rgb37-99-235-006 lf-u-p-2px-6px lf-u-r-4px lf-u-ws-nowrap">
                  ${escapeHtml(wg.syntacticRole)}
                </span>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- 7. Common Pitfalls & Natural Alternative (if present) -->
      ${(mistakes?.commonMistake || mistakes?.naturalAlternative) ? `
        <div class="lf-u-mt-12px lf-u-p-10px-12px lf-u-r-8px lf-u-bg-rgb0-0-0-002 lf-u-b-1px-solid-rgb0-0-0-008">
          <div class="lf-u-fs-11px lf-u-fw-700 lf-u-tt-uppercase lf-u-ls-0p04em lf-u-c-ink-muted lf-u-mb-6px">
            Learner Pitfall &amp; Alternative
          </div>
          ${mistakes.commonMistake ? `
            <div class="lf-u-fs-12px lf-u-c-danger-ink lf-u-mb-4px">
              ❌ <strong>Common mistake:</strong> ${ctx.renderInteractiveSentence(mistakes.commonMistake, s.selectedText)}
            </div>
          ` : ''}
          ${mistakes.correctedExample ? `
            <div class="lf-u-fs-12px lf-u-c-success-ink lf-u-mb-4px">
              ✓ <strong>Corrected:</strong> ${ctx.renderInteractiveSentence(mistakes.correctedExample, mistakes.correctedExample)}
            </div>
          ` : ''}
          ${mistakes.naturalAlternative ? `
            <div class="lf-u-fs-12px lf-u-c-ink lf-u-mb-2px">
              ✨ <strong>Natural alternative:</strong> “${ctx.renderInteractiveSentence(mistakes.naturalAlternative, mistakes.naturalAlternative)}”
            </div>
          ` : ''}
          ${mistakes.nuanceDifference ? `
            <div class="lf-u-fs-11p5px lf-u-c-ink-muted lf-u-mt-4px">
              ${ctx.renderInteractiveSentence(mistakes.nuanceDifference, s.selectedText)}
            </div>
          ` : ''}
        </div>
      ` : ''}

      <!-- 8. Interactive Practice Question (if present) -->
      ${practice?.practiceQuestion ? `
        <div class="lf-u-mt-12px lf-u-p-12px lf-u-r-10px lf-u-bg-rgb37-99-235-004 lf-u-b-1px-solid-rgb37-99-235-018">
          <div class="lf-u-fs-11px lf-u-fw-700 lf-u-tt-uppercase lf-u-c-accent-ink lf-u-mb-6px">
            🎯 Practice &amp; Quick Check
          </div>
          <div class="lf-u-fs-12p5px lf-u-fw-600 lf-u-c-ink lf-u-mb-8px lf-u-lh-1p4">
            ${ctx.renderInteractiveSentence(practice.practiceQuestion, s.selectedText)}
          </div>
          ${(practice.options && practice.options.length > 0) ? `
            <div class="lf-u-d-flex lf-u-fd-column lf-u-gap-4px lf-u-mb-8px">
              ${practice.options.map(opt => `
                <div class="lf-u-fs-12px lf-u-c-ink lf-u-p-4px-8px lf-u-r-4px lf-u-bg-rgb255-255-255-06 lf-u-b-1px-solid-rgb0-0-0-005">
                  ${escapeHtml(opt)}
                </div>
              `).join('')}
            </div>
          ` : ''}
          <details class="lf-u-mt-6px">
            <summary class="lf-u-fs-11p5px lf-u-fw-600 lf-u-c-accent-ink lf-u-cur-pointer lf-u-us-none">
              Reveal Answer &amp; Explanation
            </summary>
            <div class="lf-u-mt-6px lf-u-fs-12px lf-u-c-ink lf-u-p-8px lf-u-r-6px lf-u-bg-rgb255-255-255-08">
              <div class="lf-u-fw-700 lf-u-c-success-ink lf-u-mb-2px">Answer: ${escapeHtml(practice.answer)}</div>
              ${practice.explanation ? `<div class="lf-u-fs-11p5px lf-u-c-ink-muted">${ctx.renderInteractiveSentence(practice.explanation, s.selectedText)}</div>` : ''}
            </div>
          </details>
        </div>
      ` : ''}
    </div>
  `;
}

export function renderSentenceClausesTab(ctx: SentenceTabContext, s: SentenceAnalysisResult): string {
  const clauses = Array.isArray(s.clauses) ? s.clauses : [];
  const clauseRel = s.clauseRelationship;
  const structureMap = s.structureMap;
  const phraseConstituents = Array.isArray(s.phraseConstituents) ? s.phraseConstituents : [];
  const conversational = Array.isArray(s.conversationalElements) ? s.conversationalElements : [];

  return `
    <div class="lf-u-mt-10px lf-u-d-flex lf-u-fd-column lf-u-gap-12px">
      <!-- Header -->
      <div class="lf-u-d-flex lf-u-ai-center lf-u-jc-space-between">
        <span class="lf-section-tag lf-u-fs-11px lf-u-fw-700 lf-u-ls-0p05em lf-u-tt-uppercase lf-u-c-accent-ink">
          CLAUSE ARCHITECTURE (${clauses.length} CLAUSE${clauses.length === 1 ? '' : 'S'})
        </span>
      </div>

      <!-- 1. Visual Clause Relationship & Hierarchy Map -->
      ${(clauseRel || (structureMap && structureMap.nodes && structureMap.nodes.length > 0)) ? `
        <div class="lf-u-p-12px lf-u-r-10px lf-u-bg-rgb0-0-0-002-2 lf-u-b-1px-solid-rgb0-0-0-008-2">
          <div class="lf-u-fs-11px lf-u-fw-700 lf-u-c-accent-ink lf-u-tt-uppercase lf-u-ls-0p04em lf-u-mb-6px">
            Clause Relationship Map
          </div>
          ${clauseRel?.formula ? `
            <div class="lf-u-ff-ui-monospace-monospace lf-u-fs-12px lf-u-fw-700 lf-u-c-ink lf-u-p-4px-8px lf-u-bg-rgb0-0-0-003 lf-u-r-4px lf-u-mb-6px">
              ${escapeHtml(clauseRel.formula)}
            </div>
          ` : ''}
          ${clauseRel?.explanation ? `
            <div class="lf-u-fs-12px lf-u-c-ink lf-u-lh-1p45 lf-u-mb-4px">
              ${escapeHtml(clauseRel.explanation)}
            </div>
          ` : ''}
          ${clauseRel?.explanationBengali && ctx.targetLanguage !== 'en' ? `
            <div class="lf-u-fs-12px lf-u-c-accent-ink lf-u-fw-500 lf-u-mt-2px">
              ${escapeHtml(clauseRel.explanationBengali)}
            </div>
          ` : ''}

          <!-- Node Hierarchy Map if present -->
          ${(structureMap?.nodes && structureMap.nodes.length > 0) ? `
            <div class="lf-u-mt-8px lf-u-d-flex lf-u-fd-column lf-u-gap-6px">
              ${structureMap.nodes.map(node => `
                <div class="lf-u-d-flex lf-u-ai-flex-start lf-u-gap-8px lf-u-p-6px-8px lf-u-r-6px lf-u-bg-rgb255-255-255-07 lf-u-b-1px-solid-rgb0-0-0-006 lf-u-fs-11p5px">
                  <span class="lf-u-fw-700 lf-u-tt-uppercase lf-u-fs-10px lf-u-p-1px-5px lf-u-r-3px lf-u-bg-rgb37-99-235-008 lf-u-c-accent-ink lf-u-fsh-0">
                    ${escapeHtml(node.relationType || 'clause')}
                  </span>
                  <div>
                    <span class="lf-u-fw-600 lf-u-c-ink">“${ctx.renderInteractiveSentence(node.clauseOrElement, s.selectedText)}”</span>
                    ${node.connectsTo ? `<span class="lf-u-c-ink-muted"> ➔ connects to ${escapeHtml(node.connectsTo)}</span>` : ''}
                    ${node.explanation ? `<div class="lf-u-c-ink-muted lf-u-mt-2px">${ctx.renderInteractiveSentence(node.explanation, s.selectedText)}</div>` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      ` : ''}

      <!-- 2. Detailed Clause Cards -->
      ${clauses.map((c, idx) => {
        const isMain = c.type === 'main';
        const clauseNum = idx + 1;
        const badgeLabel = isMain ? 'INDEPENDENT' : 'DEPENDENT';
        const badgeBg = isMain ? 'rgba(37, 99, 235, 0.08)' : 'rgba(100, 116, 139, 0.08)';
        const badgeColor = isMain ? 'var(--lf-accent-ink)' : 'var(--lf-ink-muted)';
        const badgeBorder = isMain ? 'rgba(37, 99, 235, 0.2)' : 'rgba(100, 116, 139, 0.2)';
        const title = isMain ? `Clause ${clauseNum} — Main / Independent Clause` : `Clause ${clauseNum} — ${c.category || c.role || 'Dependent Clause'}`;

        return `
          <div class="lf-clause-card lf-u-p-12px lf-u-r-10px lf-u-bg-rgb0-0-0-002-2 lf-u-b-1px-solid-rgb0-0-0-008-2">
            <!-- Top Row: Badge, Title, Standalone -->
            <div class="lf-u-d-flex lf-u-ai-center lf-u-jc-space-between lf-u-fwrap-wrap lf-u-gap-6px lf-u-mb-8px">
              <div class="lf-u-d-flex lf-u-ai-center lf-u-gap-8px">
                <span class="lf-clause-badge lf-u-fs-10px lf-u-p-2px-7px lf-u-r-4px lf-u-fw-700 lf-u-ls-0p03em" style="background: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeBorder};">
                  ${escapeHtml(badgeLabel)}
                </span>
                <strong class="lf-u-fs-12p5px lf-u-c-ink">${escapeHtml(title)}</strong>
              </div>
              ${c.standalone !== undefined ? `
                <span class="lf-u-fs-10p5px lf-u-c-ink-muted lf-u-bg-rgb0-0-0-004 lf-u-p-1px-6px lf-u-r-4px">
                  Standalone: ${escapeHtml(String(c.standalone))}
                </span>
              ` : ''}
            </div>

            <!-- Clause Exact Text -->
            <div class="lf-u-fs-13px lf-u-fst-italic lf-u-c-ink lf-u-mb-8px lf-u-p-8px-10px lf-u-bg-rgb0-0-0-003 lf-u-r-6px lf-u-lh-1p45">
              “${ctx.renderInteractiveSentence(c.text, s.selectedText)}”
            </div>

            <!-- Clause Explanation & Target Translation -->
            ${c.typeExplanation ? `
              <div class="lf-u-fs-12px lf-u-c-ink-muted lf-u-lh-1p4 lf-u-mb-6px">
                <strong>Classification:</strong> ${ctx.renderInteractiveSentence(c.typeExplanation, s.selectedText)}
              </div>
            ` : ''}
            ${(c.explanationBengali && ctx.targetLanguage !== 'en') ? `
              <div class="lf-u-fs-12p5px lf-u-c-accent-ink lf-u-fw-500 lf-u-lh-1p4 lf-u-mb-8px lf-u-pl-8px lf-u-bl-2px-solid-2563eb">
                ${escapeHtml(c.explanationBengali)}
              </div>
            ` : ''}

            <!-- Syntactic Breakdown within Clause -->
            <div class="lf-u-d-flex lf-u-fd-column lf-u-gap-4px lf-u-fs-12px lf-u-bt-1px-solid-rgb0-0-0-006 lf-u-pt-8px">
              ${c.clausePattern ? `
                <div class="lf-u-mb-2px">
                  <strong class="lf-u-c-ink-muted lf-u-fs-11px lf-u-tt-uppercase">Pattern:</strong>
                  <span class="lf-u-ff-ui-monospace-monospace lf-u-fs-11p5px lf-u-fw-600 lf-u-c-ink lf-u-ml-4px">${escapeHtml(c.clausePattern)}</span>
                </div>
              ` : ''}
              ${(!isMain && c.subordinator) ? `
                <div><strong class="lf-u-c-accent-ink">Subordinator:</strong> “${escapeHtml(c.subordinator)}”</div>
              ` : ''}
              ${c.subject ? `
                <div>
                  <strong class="lf-u-c-accent-ink">Subject:</strong> “${escapeHtml(c.subject)}”
                  ${c.subjectExplanation ? `<span class="lf-u-c-ink-muted lf-u-fs-11p5px"> — ${escapeHtml(c.subjectExplanation)}</span>` : ''}
                </div>
              ` : ''}
              ${(c.verbPhrase || c.verb) ? `
                <div>
                  <strong class="lf-u-c-accent-ink">Verb Phrase:</strong> “${escapeHtml(c.verbPhrase || c.verb || '')}”
                  ${c.tenseAspect ? `<span class="lf-u-fs-11px lf-u-fw-600 lf-u-c-ink-muted lf-u-bg-rgb0-0-0-004 lf-u-p-1px-4px lf-u-r-3px lf-u-ml-4px">${escapeHtml(c.tenseAspect)}</span>` : ''}
                  ${c.verbExplanation ? `<span class="lf-u-c-ink-muted lf-u-fs-11p5px"> — ${escapeHtml(c.verbExplanation)}</span>` : ''}
                </div>
              ` : ''}
              ${c.directObject ? `
                <div>
                  <strong class="lf-u-c-accent-ink">Direct Object:</strong> “${escapeHtml(c.directObject)}”
                  ${c.directObjectExplanation ? `<span class="lf-u-c-ink-muted lf-u-fs-11p5px"> — ${escapeHtml(c.directObjectExplanation)}</span>` : ''}
                </div>
              ` : ''}
              ${c.indirectObject ? `
                <div><strong class="lf-u-c-accent-ink">Indirect Object:</strong> “${escapeHtml(c.indirectObject)}”</div>
              ` : ''}
              ${c.complement ? `
                <div><strong class="lf-u-c-accent-ink">Complement:</strong> “${escapeHtml(c.complement)}”</div>
              ` : ''}
              ${(c.adverbials && c.adverbials.length > 0) ? `
                <div>
                  <strong class="lf-u-c-success-ink">Adverbials:</strong>
                  ${c.adverbials.map(a => `“${escapeHtml(a.text)}”${a.type ? ` (${escapeHtml(a.type)})` : ''}`).join(', ')}
                </div>
              ` : ''}
              ${c.questionAnswered ? `
                <div class="lf-u-fs-11p5px lf-u-c-ink-muted lf-u-mt-2px">
                  <strong>Answers question:</strong> ${escapeHtml(c.questionAnswered)}
                </div>
              ` : ''}
              ${c.dependsOn ? `
                <div class="lf-u-fs-11p5px lf-u-c-ink-muted">
                  <strong>Depends on:</strong> ${escapeHtml(c.dependsOn)}
                </div>
              ` : ''}
              ${c.example ? `
                <div class="lf-u-fs-11p5px lf-u-c-accent-ink lf-u-bg-rgb37-99-235-003 lf-u-p-4px-8px lf-u-r-4px lf-u-mt-4px">
                  <strong>Parallel example:</strong> ${escapeHtml(c.example)}
                </div>
              ` : ''}
            </div>
          </div>
        `;
      }).join('')}

      <!-- 3. Complex Phrase Constituents (if present) -->
      ${phraseConstituents.length > 0 ? `
        <div class="lf-u-p-12px lf-u-r-10px lf-u-bg-rgb0-0-0-002 lf-u-b-1px-solid-rgb0-0-0-008">
          <div class="lf-u-fs-11px lf-u-fw-700 lf-u-c-ink lf-u-tt-uppercase lf-u-mb-8px">
            Internal Phrase Constituents
          </div>
          <div class="lf-u-d-flex lf-u-fd-column lf-u-gap-8px">
            ${phraseConstituents.map(pc => `
              <div class="lf-u-fs-12px lf-u-p-6px-8px lf-u-r-6px lf-u-bg-rgb255-255-255-08 lf-u-b-1px-solid-rgb0-0-0-006">
                <div class="lf-u-fw-700 lf-u-c-accent-ink">“${escapeHtml(pc.phrase)}” <span class="lf-u-fw-400 lf-u-c-ink-muted lf-u-fs-11px">(${escapeHtml(pc.phraseTypeLabel)})</span></div>
                ${pc.headWord ? `<div class="lf-u-fs-11p5px lf-u-c-ink lf-u-mt-2px">Head word: <strong>${escapeHtml(pc.headWord)}</strong> | Role: ${escapeHtml(pc.roleInClause || 'Constituent')}</div>` : ''}
                ${pc.explanation ? `<div class="lf-u-fs-11p5px lf-u-c-ink-muted lf-u-mt-2px">${escapeHtml(pc.explanation)}</div>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- 4. Conversational Elements (if present) -->
      ${conversational.length > 0 ? `
        <div class="lf-u-p-12px lf-u-r-10px lf-u-bg-rgb0-0-0-002 lf-u-b-1px-solid-rgb0-0-0-008">
          <div class="lf-u-fs-11px lf-u-fw-700 lf-u-c-ink lf-u-tt-uppercase lf-u-mb-6px">
            Conversational Repairs &amp; Speech Markers
          </div>
          ${conversational.map(ce => `
            <div class="lf-u-fs-12px lf-u-lh-1p45">
              <strong class="lf-u-c-accent-ink">“${escapeHtml(ce.text)}”</strong> — <span class="lf-u-c-ink-muted">${escapeHtml(ce.typeLabel)}</span>
              <div class="lf-u-mt-2px lf-u-c-ink">${escapeHtml(ce.explanation)}</div>
              ${ce.explanationBengali && ctx.targetLanguage !== 'en' ? `
                <div class="lf-u-c-accent-ink lf-u-fs-11p5px lf-u-mt-2px">${escapeHtml(ce.explanationBengali)}</div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;
}
