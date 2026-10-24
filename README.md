# LexiFlow AI

**AI-Powered English Reading, Contextual Dictionary, Vocabulary & Language Mastery Chrome Extension (Manifest V3)**

LexiFlow AI is an intelligent reading companion for Google Chrome that helps users understand unfamiliar English words, sentence structures, tone, and idioms with instant in-context definitions, bilingual Bengali explanations, and evidence-based Spaced Repetition (FSRS).

---

## Key Features

- **Dictionify-Style Floating Popup**: Double-click any word or select any phrase to reveal an isolated, non-intrusive floating popup right beside the text.
- **Shadow DOM Isolation**: Scoped CSS prevents styling collisions on complex modern websites.
- **Context-Aware Dictionary**: Normalizes parts of speech, IPA pronunciation, audio, definitions, collocations, and contextual senses.
- **Bengali Bilingual Explanations**: Understand subtle nuances and grammar structures in Bengali.
- **Sentence analysis**: Select a sentence on any page for a clause-by-clause breakdown, grammatical roles and a natural translation.
- **Word Difference Engine**: Compare closely related or confusing words (e.g. *mitigate* vs *alleviate*).
- **Spaced Repetition (FSRS)**: Free Spaced Repetition Scheduler tracks memory stability and schedules timely flashcard reviews.
- **Local-First & Privacy Conscious**: IndexedDB stores vocabulary locally. API keys stay on your machine.
- **Active Usage Coach**: Test your own sentences using saved words and get instant grammatical and naturalness feedback.

---

## Installation & Setup

### Prerequisites
- Node.js v18+ (tested on Node v22)
- Google Chrome (latest version)

### Build Instructions
1. Install dependencies:
   ```bash
   npm install
   ```
2. Build the extension bundle:
   ```bash
   npm run build
   ```
3. Load into Google Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable **Developer mode** (toggle in top right)
   - Click **Load unpacked**
   - Select the `dist/` directory generated in the repository root.

`npm run build` produces a minified production bundle without sourcemaps.
For local development use `npm run build:dev`: readable output with inline sourcemaps, plus the offline mock fallback that lets `demo/reading_test.html` work outside the extension (`node scripts/serve.cjs`).

Each build talks to its own LexiFlow Cloud environment: `npm run build` to production, `npm run build:staging` to staging (shown as "LexiFlow (Staging)"), and `npm run build:dev` to a local `wrangler dev`. See [server/README.md](server/README.md#environments).

---

## Testing & Verification
Run the automated test suite:
```bash
npm test
```

Run everything CI runs (typecheck, tests, production build):
```bash
npm run ci
```

---

## Architecture & Configuration
See:
- [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)
- [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md)
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [TESTING.md](TESTING.md)
- [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md)
- [PRIVACY.md](PRIVACY.md)
