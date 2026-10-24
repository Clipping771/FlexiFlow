# Chrome Web Store: listing and privacy disclosure

Answers for the Chrome Web Store Developer Dashboard, kept next to the code so they stay true.
Re-check this file whenever `manifest.json` permissions or any data flow change, together with [PRIVACY.md](PRIVACY.md).
Items marked **[TODO]** need the publisher's own details.

---

## 1. Single purpose

> LexiFlow helps people read English on the web. Select or double-click a word, phrase or sentence to see its
> meaning in context with an explanation in Bengali or another language, then save words and review them
> with spaced repetition.

Every feature (explanation popup, sentence analysis, Word Difference, Usage Coach, page highlights, reading
list, vocabulary and reviews) serves that one purpose: understanding and learning English from what you read.

## 2. Permission justifications

Paste each justification into the matching field on the **Privacy practices** tab.

| Permission | Justification |
|---|---|
| `storage` | Saves the user's settings, sign-in state and cached explanations on their device. |
| `identity` | Opens Google's sign-in window (`chrome.identity.launchWebAuthFlow`) so the user can sign in to LexiFlow Cloud. Requests only the `openid email profile` scopes. |
| `contextMenus` | Adds "Analyze with LexiFlow AI" to the right-click menu for selected text. |
| `activeTab` | Lets the popup act on the tab the user is reading when they click the toolbar icon, for example to start page highlights. |
| `tabs` | Finds open tabs to load the content script after install or update, sends the "highlight this article" command from the popup to the active tab, and reads the tab's address on the device to show an "OFF" badge on sites where the user paused LexiFlow. Tab addresses are never sent anywhere. |
| `scripting` | Injects the content script into tabs that were already open when the extension was installed or updated, so selection lookups work without a reload. |
| `sidePanel` | Opens the LexiFlow dashboard (vocabulary, reviews, tools) beside the page. |
| `declarativeNetRequest` | Rewrites the `Origin` header only on requests to the user's own local Ollama server (`localhost` / `127.0.0.1`) so that server accepts them. No other traffic is modified. |
| Content script on `<all_urls>` | Detects when the user selects or double-clicks text on any page and shows the explanation popup there. Page text is read only for the selection, and for the main article text when the user presses *Analyze page*. |

**Host permissions**

| Host | Why |
|---|---|
| `https://api.lexiflow.app/*` | LexiFlow Cloud, the publisher's own AI service, for users who sign in instead of adding an API key. |
| `https://generativelanguage.googleapis.com/*`, `https://api.openai.com/*`, `https://api.anthropic.com/*` | Sends explanation requests directly to the AI provider when the user adds their own API key for it. |
| `http://localhost/*`, `http://127.0.0.1/*` | The user's own Ollama server on their computer, for fully local AI. |
| `https://translate.google.com/*`, `https://ssl.gstatic.com/*`, `https://dict.youdao.com/*` | Fetches pronunciation audio for the word the user asks to hear. |

## 3. Remote code

**"No, I am not using remote code."**

> All JavaScript is bundled in the package. The extension loads no external scripts, does not use `eval` or
> `new Function`. Servers return JSON data only (explanations), never code.

## 4. Data usage

Tick these categories on the **Privacy practices** tab. "Collected" in Chrome's sense means data that leaves the
device, so a category is ticked when any feature sends it.

| Category | Collected? | What and why |
|---|---|---|
| Personally identifiable information | **Yes** | Name and email address from Google sign-in, for LexiFlow Cloud accounts only. |
| Health information | No | |
| Financial and payment information | No | **[TODO]** Change to *Yes* when paid plans (bKash, Nagad, card) launch. |
| Authentication information | **Yes** | LexiFlow Cloud sign-in tokens; API keys the user adds are sent only to that AI provider. |
| Personal communications | No | |
| Location | **Yes** | IP address, which Cloudflare handles to serve requests. LexiFlow Cloud stores only a keyed hash of it at signup, for abuse prevention, and erases it within 48 hours. |
| Web history | No | Visited pages are not sent. Pages the user saves to the reading list, and the page a saved word came from, are kept on the device only. |
| User activity | No | No click, scroll, mouse or keystroke tracking. The local usage log never leaves the device. |
| Website content | **Yes** | The text the user selects (with its sentence and paragraph), and the article text of a page when the user presses *Analyze page*, sent to the AI service they chose to generate explanations. |

**Certifications** (all three must be ticked; all are true):

- [x] I do not sell or transfer user data to third parties, outside of the approved use cases.
- [x] I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes.

> The approved use case that applies: text is sent to Google's Gemini API (LexiFlow Cloud) or to the user's own
> AI provider only to generate the explanation the user asked for.

**Privacy policy URL:** **[TODO]** publish [PRIVACY.md](PRIVACY.md) at a public URL (for example
`https://lexiflow.app/privacy`, or GitHub Pages) and enter it here, in the Google OAuth consent screen, and in
the store listing.

## 5. Store listing draft

**Name:** LexiFlow: English Reading Companion

**Summary (≤ 132 characters):**
> Understand English as you read: tap any word or sentence for its meaning in context, explained in Bengali, and remember it.

**Description:**

> LexiFlow explains English right where you read it.
>
> • Double-click any word or select a phrase to see what it means in this sentence, with a simple English and
>   Bengali explanation, pronunciation and examples.
> • Select a long sentence to see it broken into clauses with the grammar explained.
> • Word Difference compares confusing words like *mitigate* and *alleviate*.
> • Usage Coach checks sentences you write with new words.
> • Page highlights pick out the words in an article worth learning.
> • Save words and review them with spaced repetition (FSRS) so they stick.
>
> Sign in with Google to use LexiFlow Cloud for free (with a daily fair-use limit), or bring your own Gemini, OpenAI,
> Anthropic or local Ollama model. Your vocabulary stays in your browser.
>
> Bengali (বাংলা) explanations are built in, along with more than 30 other languages including Hindi, Urdu,
> Arabic, Spanish and Chinese.

**Category:** Education · **Language:** English (add Bengali listing text: **[TODO]**)

**Screenshots (1280×800):** **[TODO]** the explanation popup on a news article, a sentence grammar breakdown, the
vocabulary review screen, Settings with the LexiFlow Cloud account card.

## 6. Before submitting

- [ ] `manifest.json` has a `key` so the extension ID is stable (needed for the Google redirect URI and the
      server's `ALLOWED_ORIGINS`). After the first upload, copy the item's public key from the dashboard.
- [ ] Google OAuth consent screen is **published** (not in "Testing"), lists the privacy policy URL, and uses only
      the `openid`, `email` and `profile` scopes (no Google verification needed for these).
- [ ] The production build points at the production API (`npm run build`) and its host permission is listed above.
- [ ] Reviewer notes: "Sign in with any Google account via Settings → LexiFlow Cloud Account. Offline mode
      works without signing in."
- [ ] PRIVACY.md placeholders (publisher, contact, date) filled in and the Gemini API tier confirmed.
