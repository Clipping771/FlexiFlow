/**
 * Paid plans in the UI: the PRO badge, Free/Pro labels, "credits" wording and upgrade prompts.
 * Off for the free launch, where LexiFlow Cloud only needs a Google sign-in. Turn on together with
 * MONETIZATION_ENABLED in server/wrangler.toml once payments exist.
 * Daily limits stay on either way: they protect AI costs and are shown as a plain daily limit.
 */
export const MONETIZATION_ENABLED = false;
