# LexiFlow AI — Architecture, Specifications & Known Limitations

## 1. AI-Native Architectural Foundation
LexiFlow AI is built as a pure **AI-native language engine**. It does not rely on or query conventional third-party dictionary APIs for semantic parsing, lexical breakdown, or contextual interpretation:
- All contextual semantics, phrasal breakdowns, syntactic clause deconstructions (sentence analysis), rhetorical connector analyses, and Bengali translations are generated dynamically through configured Large Language Models (LLMs) or deterministic offline fallbacks.
- Deterministic operations—including FSRS spaced repetition scheduling, personal weakness scoring, library filtering, multi-field search, starred bookmarks, and JSON backups—execute 100% locally on the user's machine without external network calls.

## 2. Configured AI Providers & Credentials
LexiFlow supports multi-provider LLM integrations configured directly in user settings:
- **Google Gemini**: Models such as `gemini-2.0-flash` (recommended default), `gemini-2.5-flash`, `gemini-1.5-pro` (via Google AI Studio API key). Automatic fallback to modern active models if a legacy model ID is supplied.
- **OpenAI**: Models such as `gpt-4o-mini`, `gpt-4o` (via OpenAI API key, with custom endpoint support).
- **Anthropic**: Models such as `claude-3-5-sonnet-20241022`, `claude-3-haiku-20240307` (via Anthropic API key).
- **Ollama**: Local offline LLM hosting (e.g. `llama3.2`, `mistral` via local endpoint `http://localhost:11434` without sending data across the Internet).
- **Mock AI Provider**: High-fidelity offline development and test harness providing validated linguistic analysis, Bengali translations, and structural breakdowns without requiring an active API key or Internet connection.

### Credential Handling & Privacy
- API keys are stored solely inside Chrome's private extension storage (`chrome.storage.local`) and are never transmitted to any third-party tracking or proxy server.
- Webpage text is only sent to the user's selected LLM provider when an analysis action is explicitly triggered by the user (or via user-configured automatic text selection mode).

## 3. Quotas, Rate Limits & Token Limits
- Cloud LLM providers apply tier-based rate limits (e.g., Gemini Free tier: 15 RPM; OpenAI pay-as-you-go). When rate limits occur, LexiFlow presents actionable error indicators and utilizes in-memory LRU caching to eliminate redundant API requests for identical text selections.

## 4. Personal Weakness Scoring Engine
The Personal Weakness Detector operates deterministically using the user's actual historical learning data:
- **Score Range**: 0 to 100 (threshold for inclusion in Targeted Practice is $\ge 35$).
- **Lapse Weighting**: Each recorded FSRS lapse adds +20 points (capped at +60), giving significantly higher weight to forgotten items after successful consolidation than to initial learning mistakes.
- **Review History ('Again' Ratings)**: Each rating of 1 ('Again') adds +15 points; consecutive failed reviews add an extra +15 points.
- **User-Marked Difficulty**: Words explicitly marked as difficult by the user add +30 points.
- **Memory Consolidation**: Words with 3+ repetitions that fail to reach 2.0 days of stability receive +20 points.
- **Safe Guard Against False Positives**: Unreviewed new items receive a baseline score of 0 (unless explicitly marked difficult by the user).
- **Dismissal Control**: Users can dismiss words from Targeted Practice without deleting the word from their vocabulary library (`dismissedFromWeakness: true`).

## 5. Spaced Repetition (FSRS v5 Engine)
LexiFlow implements the modern Free Spaced Repetition Scheduler (FSRS v5):
- Evaluates four user response ratings: Again (1), Hard (2), Good (3), and Easy (4).
- Maintains mathematically rigorous memory stability ($S$) and difficulty ($D$) variables.
- Calculates dynamic inter-repetition intervals based on memory decay curves, rather than simplistic multiplier rules.
- Offline resilience: If indexedDB or library dependencies encounter environment anomalies, an integrated mathematical fallback maintains scheduled intervals.

## 6. Chrome Side Panel Integration
- Manifest V3 native Side Panel (`sidePanel` permission) is configured via `dashboard.html`.
- Users can launch the side panel directly from the extension popup, dashboard navigation bar, or Chrome action bar.
- Allows reading long-form web articles with the dashboard side-by-side with active browser tabs.
- Backward compatibility: On Chromium environments where `chrome.sidePanel` is disabled or unsupported, LexiFlow automatically falls back to opening the full dashboard tab in the browser window.
- The floating contextual popup and selection trigger continue to operate uninterrupted on all standard web pages.

## 7. Data Persistence & Backup
- **IndexedDB**: Stored under database `lexiflow_db` with stores `vocabulary` and `review_logs`.
- **JSON Import / Export**:
  - Export generates standard JSON backups containing vocabulary records, FSRS item states, starred flags, notes, and full analyses.
  - Import automatically deduplicates entries against existing vocabulary by word/id and normalizes legacy records safely.
- **Article Drafts**: Article drafts and analysis results are persisted in local browser storage to prevent loss of work during page reloads.

## 8. Browser Sandbox & Restricted Pages
- **Chrome Internal Pages**: Content scripts cannot run on `chrome://*`, `chrome-extension://*`, or Chrome Web Store pages due to native browser security policies.
- **Embedded PDF Viewer**: Built-in Chrome PDF viewer (`chrome-extension://mhjfb...`) restricts arbitrary DOM script injection. Users should copy PDF passages into a regular web page or the dashboard tools.
- **Cross-Origin iframes**: Double-click detection inside sandboxed cross-origin iframes without script access is restricted by standard browser security models.
- **Audio Pronunciation**: LexiFlow utilizes the browser's native `window.speechSynthesis` API labeled as "Machine voice", eliminating dependencies on external pronunciation audio CDNs. AI-generated IPA transcriptions are omitted unless explicitly confirmed by a verified phonetic dictionary source.

## 9. Two-Stage AI Architecture & Cache Invalidation
To preserve reading flow without overwhelming users with dictionary-length dumps, LexiFlow employs a Two-Stage AI lifecycle:
- **Stage A — Immediate Contextual Explanation**:
  - Triggered automatically or on selection.
  - Returns strictly what is required for reading comprehension:
    1. Easy English explanation (conversational, short, everyday words).
    2. Easy Bengali meaning (concise, written in Bengali script).
    3. In this sentence (contextual function).
    4. Short natural example and Bengali translation.
    5. Honest confidence rating (`high`, `medium`, `low`) with uncertainty note if context is sparse.
- **Stage B — Detailed Vocabulary Exploration**:
  - Triggered when the user expands "All meanings & examples".
  - Returns sense-by-sense breakdown with the contextual sense ordered first (index 0).
  - Senses feature easy English and Bengali definitions, natural examples with Bengali translations, sense-specific synonyms, and genuine antonyms (never fabricated; omitted if none exist).
  - Common collocations, idioms, phrasal verbs, word forms, and confusing-word distinctions.
  - Progressive disclosure: Displays the first 5 senses with a "Show more meanings" action for additional senses.
  - Resilience: If Stage B fails, Stage A remains active with a dedicated retry button.

### Cache Isolation & Request Lifecycle
- **Stage A Cache Key**: `stageA: ${lemma}::${sentenceHash}::${PROMPT_VERSION}`
  - FNV-1a normalized sentence hashing ensures any change in surrounding context invalidates the contextual meaning.
- **Stage B Cache Key**: `stageB: ${lemma}::${pos}::${PROMPT_VERSION}`
  - Sentence-agnostic, allowing vocabulary senses to be reused across different articles for the same word.
- **Request Cancellation & Deduplication**:
  - Concurrent identical requests share a single in-flight promise.
  - Stale responses arriving after a user makes a new selection are discarded via monotonic request IDs.

## 10. Two-Layer Semantic Validation & Recovery
- **Layer 1 (Structural)**: Zod schemas (`StageAContextualSchema`, `StageBDetailedVocabularySchema`) validate field structures, enum values, and types.
- **Layer 2 (Semantic & Linguistic Heuristics)**:
  - Bengali script regex check (`/[\u0980-\u09FF]/`) verifies Bengali fields are written in authentic Bengali characters.
  - Contextual sense verification ensures the contextual sense ID exists and is ordered at index 0.
  - Examples are verified to demonstrate the target lemma or its inflected stem.
  - Antonym honesty: Fabricated antonyms are prohibited; empty lists are enforced when no direct opposite applies.
- **Recovery Strategy**:
  - If validation fails, LexiFlow triggers a single automated correction prompt to the LLM detailing the validation failure.
  - If the retry fails, a validated structured fallback is returned, guaranteeing the popup never crashes.

## 11. Honest Pronunciation & User Feedback Flow
- **Pronunciation**: Labeled clearly as **"Machine voice 🔊"** powered by `window.speechSynthesis`. Verified audio or human claims are never fabricated.
- **Feedback Flow**: Users can report inaccurate interpretations via the inline **"🚩 Report"** control. Issues are recorded locally in `chrome.storage.local` under `lexiflow_feedback_reports` with reason and notes without transmitting private webpage content.

## 12. Verification & Live AI Evaluation
- **Automated Mock Tests**: Run with `npm test` (14 test files, 74 tests passing across unit, integration, cache isolation, validation, and accessibility suites).
- **Live AI Evaluation Suite**: Run with `npm run eval:live` (or `npx vite-node scripts/evaluate-live.mjs [--provider=gemini] [--apiKey=KEY]`).
  - Benchmarks 10 canonical linguistic cases: `run`, `set`, `light`, `bank` (financial), `break the ice`, `give up`, `look up`, `fast`, `bank` (geographical context), and `thingamajig` (low-information sentence).

