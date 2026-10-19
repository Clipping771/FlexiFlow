# LexiFlow Privacy Policy

_Last updated: 2026-10-19_

LexiFlow is a browser extension that explains English words, phrases and sentences you select on web pages. This policy describes what data the extension handles and where it goes.

## Summary

- LexiFlow has **no server of its own**. The developer does not collect, receive, sell or share your data.
- Your vocabulary, review history, settings and API keys are stored **locally in your browser**.
- Text you choose to analyze is sent **only to the AI provider you configure**.

## Data stored on your device

| Data | Where | Purpose |
|------|-------|---------|
| Saved vocabulary, notes, review (FSRS) history | IndexedDB (`lexiflow_db`) | Your word library and spaced repetition |
| Settings and AI provider API keys | `chrome.storage.local` | Remembering your preferences and connecting to your AI provider |
| Cached explanations, local usage event logs, wrong-meaning reports | `chrome.storage.local` / memory | Faster repeat lookups and local diagnostics |

This data never leaves your device unless you export it yourself (JSON export). Uninstalling the extension deletes it.

## Data sent to third parties

LexiFlow only sends data over the network when you trigger a feature that needs it:

- **AI provider you select** (Google Gemini, OpenAI, Anthropic, or a local Ollama server): the selected text, its surrounding sentence/paragraph, and for page highlights or the Article Reader, an excerpt of the page or article text. Your API key is sent only to that provider. Each provider's own privacy policy applies:
  - Google Gemini: https://policies.google.com/privacy
  - OpenAI: https://openai.com/policies/privacy-policy
  - Anthropic: https://www.anthropic.com/legal/privacy
  - Ollama runs on your own machine (`localhost`); nothing leaves your computer.
- **Pronunciation audio** (`translate.google.com`, `ssl.gstatic.com`, `dict.youdao.com`): the word or short text you ask to hear. If these are unavailable, the browser's built-in speech synthesis is used.

With the offline/mock mode, no text is sent anywhere.

## Permissions

- **Access to all websites (content script)**: to detect when you select or double-click text and show the explanation popup. Page content is not read or sent unless you trigger an analysis.
- **storage**: save settings and vocabulary locally.
- **contextMenus**: the right-click "Analyze with LexiFlow AI" menu.
- **tabs, activeTab, scripting**: communicate with the current tab and show the popup / reading badge.
- **sidePanel**: open the LexiFlow dashboard beside the page.
- **declarativeNetRequest**: adjust the `Origin` header on requests to your local Ollama server so it accepts them.

## Children

LexiFlow is not directed at children under 13 and does not knowingly collect their data.

## Changes

Changes to this policy will be published in this file with an updated date.

## Contact

Questions: open an issue in the project repository.
