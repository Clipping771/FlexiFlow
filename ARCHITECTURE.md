# LexiFlow AI — Architecture Specification

## 1. Architectural Overview
LexiFlow AI is structured as a Chrome Extension Manifest V3 application adhering to local-first, modular, privacy-conscious, and provider-independent design principles.

```mermaid
graph TD
    A[Webpage Content Script] -->|Range Selection| B[Selection & Trigger Handler]
    B -->|Bounding Rect Coordinates| C[Shadow DOM Popup Manager]
    C -->|Isolated Mount| D[Floating Popup Component]
    
    A -->|Chrome Runtime Messages| E[Background Service Worker]
    E --> F[Dictionary Service]
    E --> G[Bilingual / Bengali Engine]
    E --> H[AI Provider Abstraction Layer]
    E --> I[IndexedDB / Storage Controller]
    
    F --> F1[Free Dictionary API]
    F --> F2[Local Offline Lexicon Cache]
    
    H --> H1[Mock Provider (Offline/Honest)]
    H --> H2[Google Gemini Provider]
    H --> H3[OpenAI Provider]
    H --> H4[Anthropic Claude Provider]
    H --> H5[Ollama Local Provider]
    
    I --> J[(IndexedDB: Vocabulary & FSRS Logs)]
    I --> K[(Chrome Storage: Preferences)]
    
    L[Extension Dashboard / Sidepanel] --> I
    L --> M[FSRS Spaced Repetition Engine]
    L --> N[Review Exercise Modules]
    L --> O[Usage Coach & Weakness Tracker]
```

## 2. Key Modules & Separation of Concerns

### A. Content Script & Shadow DOM (`src/content/`)
- **Range & Coordinates**: Uses standard `window.getSelection()` and Range `getBoundingClientRect()`, accounting for multi-line selections, zoom levels, sticky headers, and viewport overflow.
- **Shadow DOM Isolation**: The floating UI is mounted in an isolated shadow root (`mode: 'closed'`), with inline styles and zero host-page CSS leakage.
- **Safe Interactions**: Ignores editable input fields and textareas by default unless explicitly triggered. Rapid clicks cancel previous obsolete requests.

### B. Background Service Worker (`src/background/`)
- Acts as the central hub: avoids CORS issues in content scripts, handles context-menu lookups, orchestrates caching, and manages provider authentication.
- Persists state and survives MV3 service worker termination gracefully.

### C. Dictionary & Normalization Layer (`src/services/dictionary/`)
- Normalizes dictionary definitions into a unified schema: headword, phonetics, IPA, definitions, senses, examples, synonyms, antonyms, and audio references.
- Features offline fallback for standard words when offline or rate-limited.

### D. Bilingual Bengali Engine (`src/services/bengali/`)
- Renders Bengali translations, idiomatic nuances, and cultural explanations.
- Handles mixed Bengali Unicode fonts and RTL/LTR formatting.

### E. AI Provider Abstraction (`src/services/ai/`)
- Decouples extension logic from underlying LLM vendors.
- Supported providers: Mock (offline honest demo), Gemini, OpenAI, Claude, Local Ollama.
- Zod schema validation guarantees structured, safe responses.
- API keys are never bundled in extension source code; stored strictly in local user storage.

### F. Spaced Repetition & Storage (`src/services/storage/` & `src/services/fsrs/`)
- Local-first storage using browser IndexedDB for vocabulary items, collections, tags, notes, and review history logs.
- Spaced repetition implemented with FSRS (Free Spaced Repetition Scheduler), adjusting item stability ($S$), difficulty ($D$), and retrievability ($R$) upon user review feedback (Again, Hard, Good, Easy).
- Export/Import supports standard JSON and CSV format.
