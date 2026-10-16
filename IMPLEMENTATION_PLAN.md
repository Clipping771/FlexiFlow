# LexiFlow AI — Implementation Plan

## 1. Project Overview & Mission
LexiFlow AI is an AI-powered English reading, contextual dictionary, vocabulary, and language mastery Chrome Extension (Manifest V3). It provides instant, in-context explanations on any webpage with dedicated Bengali bilingual support, Spaced Repetition (FSRS), Sentence X-Ray, Word Difference Engine, and reading intelligence tools.

## 2. Baseline Status
- Initial state: Empty repository initialized with git, Node v22.12.0, npm 11.17.0.
- Standard: Chrome Extension Manifest V3.
- Core architecture: Modular TypeScript, React for interactive surfaces, Shadow DOM for isolated web-page injection, IndexedDB for persistent vocabulary library and FSRS review state, Chrome Storage for lightweight user settings.

## 3. Architecture & Module Boundaries
1. **Manifest & Config (`manifest.json`)**: MV3 permissions, content scripts, background worker, action popup, options/dashboard.
2. **Content Script Layer (`src/content/`)**:
   - `selectionHandler.ts`: Double-click and phrase selection detection with robust Range & viewport rectangle calculation.
   - `popupManager.ts`: Shadow DOM container injection ensuring complete CSS isolation and prevention of host page leakage.
   - `positioning.ts`: Boundary-aware collision detection (repositions if overflowing top/bottom/left/right, scrolls, zoom, resize listeners).
   - `FloatingTrigger.tsx`: Floating trigger icon when selecting phrases without intrusive auto-popup.
   - `FloatingPopup.tsx`: Rich interactive popup with quick definition, Bengali translation, IPA, audio, AI explanation modes, save action, Sentence X-Ray launch.
3. **Background Service Worker (`src/background/`)**:
   - Central message router handling lookups, AI calls, dictionary cache, audio synthesis fallback, context menus, and storage sync.
4. **Dictionary Layer (`src/services/dictionary/`)**:
   - Provider interface (`DictionaryProvider`).
   - `FreeDictionaryProvider`: Open REST dictionary data.
   - `LocalDictionaryProvider`: Offline local vocabulary cache and fallback for common words and definitions.
   - Normalization into standard `DictionaryResult` schema with verification status, IPA, part of speech, multiple senses, collocations, examples.
5. **AI Integration Layer (`src/services/ai/`)**:
   - Provider-independent abstraction (`AIProvider`).
   - Implementations: `MockAIProvider` (honest offline fallback), `GeminiProvider`, `OpenAIProvider`, `AnthropicProvider`, `OllamaProvider` (local).
   - Structured JSON output parsing validated with Zod.
   - Clear distinction between dictionary-sourced facts and AI-generated inferences.
6. **Vocabulary & Spaced Repetition (`src/services/storage/` & `src/services/fsrs/`)**:
   - IndexedDB store for vocabulary records, collections, tags, notes, and review logs.
   - FSRS (Free Spaced Repetition Scheduler) algorithm calculating stability, difficulty, retrievability, and optimal review intervals.
   - Full CRUD: Add, edit, remove, tag, search, filter, export (JSON/CSV), import with preview and conflict resolution.
7. **Bilingual Engine (`src/services/bengali/`)**:
   - Bengali translation, idiom explanation, nuances, and natural Bengali sentence paraphrasing.
8. **Specialized Reading Tools**:
   - **Word Difference Engine**: Minimal pairs, nuance comparison (e.g., *scrutiny* vs *examination*).
   - **Sentence X-Ray**: Clause breakdown, grammatical roles, connectors, Bengali translation.
   - **Reading Pattern Explainer**: Participial clauses, idioms, reduced relative constructions.
   - **Active Usage Coach**: Sentence evaluation for grammar, collocation, and naturalness.
   - **Personal Weakness Detection**: Frequent lapses, confused pairs, grammar weaknesses.
9. **Extension Dashboard / Full Page Hub (`src/dashboard/`)**:
   - Vocabulary library manager with collections and search.
   - Daily flashcard review session (Word-to-meaning, Meaning-to-word, Contextual MCQ, Fill-in-the-blank).
   - Learning Analytics & retention graphs.
   - Settings & Provider Configuration (API keys securely stored locally in Chrome Sync/Local storage).

## 4. Phase Breakdown & Acceptance Criteria
- **Phase 0: Baseline & Setup** (Complete tooling, Vite build, Manifest V3 bundle, Vitest setup).
- **Phase 1: P0 MVP** (Double-click popup, Shadow DOM, Free Dictionary + Local Fallback, Bengali translation, TTS/Audio playback, Save to IndexedDB, Chrome storage settings).
- **Phase 2: P1 Contextual AI & Linguistic Engines** (AI provider abstraction, Sentence X-Ray, Word Difference Engine, Pattern Explainer, Detailed/Expert modes).
- **Phase 3: P2 Vocabulary & FSRS Mastery** (Full vocabulary library UI, FSRS reviews, Active Usage Coach, Personal Weakness Detection, Analytics).
- **Phase 4: P3 Advanced Tools & Refinements** (Paragraph Intelligence, PDF text fallback, YouTube transcript integration, export/import).
- **Phase 5: Production Hardening & Testing** (Unit tests, browser verification, CSP compliance, documentation).
