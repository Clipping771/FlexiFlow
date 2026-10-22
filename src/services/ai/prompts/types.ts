/**
 * A provider-agnostic prompt. Providers with a system/user split (Gemini, OpenAI,
 * Anthropic, the cloud backend) send both parts; Ollama joins them with `toSinglePrompt`.
 */
export interface PromptSpec {
  system: string;
  user: string;
  /** Output token budget. Providers that do not cap output may ignore it. */
  maxTokens: number;
}

/**
 * 'full' is the detailed prompt set used by Gemini and the cloud backend.
 * 'compact' is the shorter set used by OpenAI, Anthropic and Ollama.
 */
export type PromptDetail = 'full' | 'compact';
