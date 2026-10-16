# LexiFlow AI — Testing & Verification Strategy

## 1. Testing Methodology
LexiFlow AI enforces multi-tier testing:
1. **Unit Tests (Vitest & JSDOM)**:
   - Text selection & Range boundary calculations
   - Dictionary schema normalization
   - Bengali script rendering & string sanitization
   - FSRS algorithm intervals, stability, and difficulty calculations
   - IndexedDB CRUD and conflict handling
   - Zod schema validation for AI outputs
2. **Integration Tests**:
   - Message routing between Content Script and Service Worker
   - AbortController cancellation during rapid successive selections
   - Offline fallback activation when network is down
   - Safe storage migrations
3. **Browser Automation & Extension Tests**:
   - Manifest V3 validity verification
   - Popup appearance inside Shadow DOM on test webpages
   - Boundary-aware positioning (top/bottom flip, edge padding)
   - Real-world interaction with long sentences, punctuation, and Unicode text.

## 2. Test Execution Commands
- Run all unit and integration tests:
  ```bash
  npm test
  ```
- Run tests in watch mode:
  ```bash
  npm run test:watch
  ```
- Run extension build validation:
  ```bash
  npm run build
  ```

## 3. Test Suites Catalog
| Suite | Path | Coverage |
| :--- | :--- | :--- |
| Selection & Positioning | `src/content/__tests__/positioning.test.ts` | Bounding box, edge flipping, scroll offset |
| Dictionary Normalizer | `src/services/dictionary/__tests__/dictionary.test.ts` | Schema parsing, phonetic extraction, fallbacks |
| Bengali Translation | `src/services/bengali/__tests__/bengali.test.ts` | Translation parsing, Unicode safety |
| FSRS Spaced Repetition | `src/services/fsrs/__tests__/fsrs.test.ts` | Review rating intervals, stability, retention |
| Storage & IndexedDB | `src/services/storage/__tests__/storage.test.ts` | Vocabulary CRUD, tags, duplicate avoidance |
| AI Schema Validation | `src/services/ai/__tests__/schemas.test.ts` | Zod validation for X-Ray, Differences, Patterns |
