/**
 * Shared helper to safely and robustly parse JSON from AI outputs.
 * 
 * 1. Removes <think>...</think> reasoning blocks (e.g. DeepSeek R1, Qwen reasoning models)
 * 2. Strips ```json and ``` markdown code fences
 * 3. Extracts from the first '{' or '[' to the last '}' or ']'
 * 4. Trims whitespace
 * 5. Calls JSON.parse
 * 6. Throws a clear error including the raw text if parsing fails
 */
export function safeParseJSON<T = any>(text: string): T {
  if (typeof text !== 'string') {
    throw new Error(`safeParseJSON: Expected string input, received ${typeof text}`);
  }

  // 1. Remove <think>...</think> blocks
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // 2. Strip ```json and ``` code block fences
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  // 3. Extract from the first '{' or '[' to the last '}' or ']'
  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');
  let startIdx = -1;
  if (firstBrace !== -1 && firstBracket !== -1) {
    startIdx = Math.min(firstBrace, firstBracket);
  } else if (firstBrace !== -1) {
    startIdx = firstBrace;
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
  }

  const lastBrace = cleaned.lastIndexOf('}');
  const lastBracket = cleaned.lastIndexOf(']');
  const endIdx = Math.max(lastBrace, lastBracket);

  if (startIdx !== -1 && endIdx !== -1 && endIdx >= startIdx) {
    cleaned = cleaned.slice(startIdx, endIdx + 1).trim();
  }

  // 4. Parse JSON
  try {
    return JSON.parse(cleaned) as T;
  } catch (err: any) {
    throw new Error(
      `Failed to parse AI JSON response: ${err?.message || 'Invalid JSON format'}.\nRaw response was:\n${text}`
    );
  }
}
