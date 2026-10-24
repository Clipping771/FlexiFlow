# LexiFlow Privacy Policy

_Last updated: [TODO: publish date]_

LexiFlow is a browser extension that explains English words, phrases and sentences you select on web pages,
with explanations in Bengali and other languages. This policy describes what data the extension and the optional
LexiFlow Cloud service handle, where that data goes and how long it is kept.

LexiFlow is provided by **[TODO: your name or company]** ("we"). Contact: **[TODO: privacy contact email]**.

<!-- Maintainer notes (not shown once published as HTML; remove before publishing elsewhere):
     - Retention periods below must match server/src/lib/retention.ts (RETENTION).
     - Section "Google Gemini" assumes a paid Gemini API tier. Google's free tier may use prompts to improve
       its products; if you run on the free tier, say so in that section instead.
     - Update this file whenever a feature starts sending new data anywhere. -->

## Summary

- Your vocabulary, review history and settings are stored **only in your browser**.
- LexiFlow sends text over the network **only when you ask it to explain something**, and only to the AI service
  you chose: LexiFlow Cloud, or your own Google Gemini, OpenAI, Anthropic or local Ollama account.
- If you use **LexiFlow Cloud**, we keep your Google account email and name, your account type, and counts of
  how much you used the AI features. We **do not store the text you look up** with your account, and we never sell your data.
- You can **delete your LexiFlow Cloud account** at any time in Settings, which erases everything tied to it.

## 1. Data stored on your device

| Data | Where | Purpose |
|------|-------|---------|
| Saved vocabulary, notes, spaced-repetition (FSRS) history, and the address and title of the page each word was saved from | IndexedDB (`lexiflow_db`) | Your word library and reviews, and linking words to the article they came from |
| Reading list: the address, title and length of articles you press "Save for later" on (never their text) | `chrome.storage.local` | Coming back to those articles |
| Settings, and API keys for your own AI provider if you add them | `chrome.storage.local` | Preferences and connecting to that provider |
| LexiFlow Cloud sign-in tokens | `chrome.storage.local` (refresh token), `chrome.storage.session` (access token) | Keeping you signed in |
| Cached explanations, a local usage log (feature events such as "word saved" with the selection type, never the text), wrong-meaning reports | `chrome.storage.local` / memory | Faster repeat lookups and local diagnostics |

This data stays on your device. It leaves only if you export it yourself (JSON export) or, for the items in
section 2, when you use a feature that needs it. Uninstalling the extension deletes it.

## 2. Data sent over the network

LexiFlow contacts a server only when you trigger a feature that needs one.

### What is sent for an explanation

Depending on the feature, an explanation request contains:

- **Word or phrase lookups:** the selected text, its sentence and the surrounding paragraph (up to 2,000 characters).
- **Sentence and paragraph analysis:** the selected sentence or paragraph.
- **Word Difference:** the two words you compare.
- **Usage Coach:** the target word and the sentence you wrote.
- **Writing help:** the text you ask to improve.
- **AI chat:** your question and the text it is about.
- **Page highlights** (only when you press *Analyze page*): up to 15,000 characters of the page's main article text and its title.

Page content is never read or sent unless you trigger one of these features. With the offline mode, nothing is sent.

### LexiFlow Cloud (when "LexiFlow Cloud" is your AI provider)

LexiFlow Cloud is our own service, hosted on Cloudflare. When you use it:

- **Sign-in.** You sign in with Google. Google tells us your account's unique ID, email address, name and whether
  the email is verified. We do not receive your Google password or access to anything else in your Google account.
- **Explanations.** The request described above goes to our server, which sends it to Google's Gemini API to
  generate the answer and returns the answer to you. Google processes it under the
  [Gemini API terms](https://ai.google.dev/gemini-api/terms) and [Google's privacy policy](https://policies.google.com/privacy).
- **What we store about your requests:** for each request, the feature used, credits charged, whether the answer
  came from the cache, the number of AI tokens used, how long it took, whether it succeeded, and when. We use this
  to enforce daily limits, prevent abuse and understand our costs. **The text you look up is not stored with
  these records** and is not written to our logs.
- **Shared answer cache.** To make repeat lookups faster and cheaper, answers for single words and phrases are
  stored for up to 30 days and reused for anyone who looks up the same word in the same sentence. Cached
  answers are not linked to any account and are found by a hash of the word and sentence. The answer itself may
  quote part of that sentence, but only someone who already has the exact same sentence can receive it.
  Sentences, paragraphs, writing, chat and page highlights are never cached.
- **Abuse prevention.** When you create an account, we record a keyed hash of your IP address, not the address
  itself, to limit how many accounts can be created from one network. We erase it within 48 hours. We also
  count requests per minute to stop automated abuse.
- **Hosting.** Cloudflare, our hosting provider, processes network data such as IP addresses to deliver and
  protect the service ([Cloudflare privacy policy](https://www.cloudflare.com/privacypolicy/)).

### Your own AI provider (when you add your own API key)

The request described above is sent directly from your browser to the provider you chose, with your API key.
It does not pass through LexiFlow Cloud. That provider's policy applies:

- Google Gemini: https://policies.google.com/privacy
- OpenAI: https://openai.com/policies/privacy-policy
- Anthropic: https://www.anthropic.com/legal/privacy
- Ollama runs on your own computer (`localhost`); nothing leaves your machine.

### Pronunciation audio

When you play a pronunciation, the word or short text is sent to `translate.google.com`, `ssl.gstatic.com` or
`dict.youdao.com` to fetch audio. If these are unavailable, your browser's built-in speech is used instead.

## 3. How long LexiFlow Cloud keeps data

| Data | Kept for |
|------|----------|
| Account (Google ID, email, name, plan) | Until you delete your account |
| Sign-in sessions | 30 days after last use, or until you sign out or delete your account |
| Per-request usage records | 180 days |
| Daily credit totals | 90 days |
| Signup IP hash | Up to 48 hours |
| Per-minute request counters | About 1 hour |
| Cached word and phrase answers | Up to 30 days (not linked to any account) |
| Daily cost totals per plan | 400 days (no personal data) |

Data is deleted by a daily cleanup job.

## 4. Your choices and rights

- **Use LexiFlow without an account:** choose offline mode or your own AI provider, and LexiFlow Cloud is never contacted.
- **Delete your account:** Settings → LexiFlow Cloud Account → *Delete account*. This immediately erases your
  account, sessions, usage records and credit totals on our side and signs you out on every device.
  Vocabulary stored in your browser is not affected.
- **Access or correct your data:** contact us at the address above.

We do not sell your data, use it for advertising, or use it to decide creditworthiness or for lending.
We use it only to provide and improve LexiFlow's features.

## 5. Permissions the extension requests

- **Access to all websites (content script):** to notice when you select or double-click text and show the
  explanation popup. Page content is not read or sent unless you trigger a feature in section 2.
- **storage:** save settings, vocabulary and sign-in state locally.
- **identity:** open Google's sign-in window for LexiFlow Cloud.
- **contextMenus:** the right-click "Analyze with LexiFlow AI" menu.
- **tabs, activeTab, scripting:** talk to the current tab to show the popup, page highlights and reading badge.
- **sidePanel:** open the LexiFlow dashboard beside the page.
- **declarativeNetRequest:** adjust the `Origin` header on requests to your local Ollama server so it accepts them.

## 6. Children

LexiFlow is not directed at children under 13 and does not knowingly collect their data. If you believe a child
has created a LexiFlow Cloud account, contact us and we will delete it.

## 7. Changes

We will publish changes in this policy with a new date at the top. If a change affects what LexiFlow Cloud
collects, we will also note it in the extension's release notes.

---

## সংক্ষেপে (বাংলা)

- আপনার শব্দতালিকা, রিভিউর ইতিহাস আর সেটিংস শুধু আপনার ব্রাউজারেই থাকে।
- আপনি কোনো কিছুর ব্যাখ্যা চাইলেই শুধু সেই লেখাটা পাঠানো হয়, আপনার বেছে নেওয়া AI সেবায়: LexiFlow Cloud, অথবা আপনার নিজের Gemini, OpenAI, Anthropic বা Ollama।
- LexiFlow Cloud ব্যবহার করলে আমরা আপনার Google ইমেইল, নাম, প্ল্যান আর কত credit খরচ হলো তার হিসাব রাখি। আপনি যে লেখা খোঁজেন তা আপনার অ্যাকাউন্টের সাথে রাখা হয় না, আর আমরা কখনো আপনার ডেটা বিক্রি করি না।
- Settings থেকে যেকোনো সময় অ্যাকাউন্ট মুছে ফেলতে পারবেন। তাতে আমাদের কাছে থাকা আপনার সব তথ্য মুছে যাবে।
