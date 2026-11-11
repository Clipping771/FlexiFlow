# LexiFlow AI — Implementation Status

Last Updated: 2026-11-11

## Summary
- **Current Milestone**: LexiFlow 2.0: general English practice (the separate PTE/IELTS practice screens were removed for flexibility; Smart Practice covers reading, vocabulary, listening, writing and speaking from any article)
- **Build Status**: Manifest V3 bundle in `dist/` (`npm run build`)
- **Automated Tests**: extension `npm test` (about 570 tests, 73 files); server `npm --prefix server test` (174 tests, 19 files). Run `npm run ci` for isolation + typecheck + tests + build.

## LexiFlow 2.0 additions (2026-11-11)

| Feature | Area | Status | Notes |
| :--- | :--- | :--- | :--- |
| Today home | Dashboard | Tested | Goals (level, focus, daily minutes, reminder), daily plan, streak, 7-day strip |
| Daily reminder | Background | Tested | `alarms` + `notifications`; skipped on days already studied |
| Mistake drills | Mistakes | Tested | Varied 4-question sessions, own sentences, drill bank for all 30 codes, pass = 3/4 |
| Mistake scheduling | Mistakes | Tested | FSRS on top of mastery steps (3 days, then 21); relapse = FSRS lapse |
| FSRS learning steps fix | Spaced repetition | Tested | Cards answered Good now graduate (learning steps were reset on every review) |
| Bengali explanations | Mistakes | Tested | One Bangla explanation per taxonomy code, shown when the target language is Bengali |
| Cloud sync | Cloud | Tested | `GET/PUT /v1/sync` (migration 0008, Zod schema); mistakes, goals and activity merged per item |
| Natural AI voice | Listening | Tested | Gemini TTS / OpenAI TTS with own key, `POST /v1/ai/speech` for Cloud; natural browser voice fallback |
| Speaking fluency | Speaking | Tested | Pace, fillers and long pauses (3s+) |
| Read aloud | Speaking | Tested | Word-by-word match against an article sentence (no AI), labelled LexiFlow estimate |
| Account deletion | Cloud | Tested | Also removes mistake, speaking, writing, reading/listening and sync records |

## Feature Implementation & Verification Status

| Feature | Category | Priority | Status | Verification Details |
| :--- | :--- | :--- | :--- | :--- |
| Manifest V3 Configuration | Core | P0 | Tested | `manifest.json` configured with permissions, service_worker, content_scripts |
| Standalone Vite Bundler | Build | P0 | Tested | Builds standalone IIFE `content.js` and ESM `background.js` cleanly |
| Double-Click Word Lookup | Content Script | P0 | Tested | Captures selections in capture phase with zero-rect inline fallback |
| Phrase-selection Action | Content Script | P0 | Tested | Floating trigger badge on multi-word selection |
| Shadow DOM Isolated Popup | UI | P0 | Tested | Scoped CSS mounted on document root, zero webpage CSS leakage |
| Fixed Viewport Positioning | Layout | P0 | Tested | `position: fixed` boundary clamping and bottom flip avoidance |
| Dictionary Engine & Cache | Dictionary | P0 | Tested | Free Dictionary API + local offline fallback + in-memory LRU cache |
| Bengali Translation Engine | Bilingual | P0 | Tested | Curated academic & high-frequency lexicon with lemmatization and Unicode |
| Audio Pronunciation | Audio | P0 | Tested | Audio file stream with Web Speech API speech synthesis fallback |
| IndexedDB Vocabulary Storage | Storage | P0 | Tested | Local-first IndexedDB database for vocabulary records and review history |
| Chrome Storage Settings | Settings | P0 | Tested | User preferences, trigger modes, and secure API key storage |
| AI Provider Abstraction | AI | P1 | Tested | Mock (offline), Gemini, OpenAI, Claude, Ollama with Zod schema validation |
| Sentence X-Ray | Reading Tools| P1 | Removed | Dashboard tab removed; the same analysis lives in the on-page card's Grammar tab |
| Word Difference Engine | Reading Tools| P1 | Tested | Nuance comparison (e.g. scrutiny vs examination, minimal pairs) |
| Reading Pattern Explainer | Reading Tools| P1 | Tested | Explains participial phrases, idioms, and reduced relative clauses |
| FSRS Memory Engine | Spaced Repetition| P2 | Tested | Free Spaced Repetition Scheduler (Again, Hard, Good, Easy) |
| Active Usage Coach | Learning | P2 | Tested | Sentence evaluation with collocation scoring and constructive feedback |
| Learning Analytics | Dashboard | P2 | Tested | Tracks total words, memory stability ($S$), due items, and retention |
| Full Options Dashboard | UI | P2 | Tested | React dashboard with Vocabulary Library, Reviews, Tools, and Settings |
| Import & Export | Data | P2 | Tested | JSON backup export and safe preview import |

## Automated Test Suites
Test files live next to the code in `__tests__/` folders (extension) and in `server/test/` (server).
