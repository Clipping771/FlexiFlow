/**
 * Shared helper to safely and robustly parse JSON from AI outputs.
 * 
 * 1. Removes <think>...</think> reasoning blocks (e.g. DeepSeek R1, Qwen reasoning models)
 * 2. Strips ```json and ``` markdown code fences
 * 3. Extracts from the first '{' or '['
 * 4. Automatically repairs truncated or cut-off JSON outputs (e.g. when LLM token limits are reached)
 * 5. Calls JSON.parse and gracefully falls back to repaired JSON
 * 6. Throws a clear error including the raw text if parsing fails completely
 */

/**
 * Repairs truncated or partially cut-off JSON strings by closing unclosed quotes,
 * removing dangling incomplete keys/values, and balancing open brackets/braces.
 */
export function repairTruncatedJSON(jsonStr: string): any | null {
  const str = jsonStr.trim();
  if (!str) return null;

  try {
    return JSON.parse(str);
  } catch {}

  let candidate = str;

  for (let attempt = 0; attempt < 50; attempt++) {
    // 1. Detect unclosed string literals
    let inStr = false;
    let esc = false;
    for (let i = 0; i < candidate.length; i++) {
      const ch = candidate[i];
      if (esc) {
        esc = false;
        continue;
      }
      if (ch === '\\') {
        esc = true;
        continue;
      }
      if (ch === '"') {
        inStr = !inStr;
      }
    }

    let attemptStr = candidate;
    if (inStr) {
      attemptStr += '"';
    }

    // 2. Track open braces and brackets
    const openStack: string[] = [];
    inStr = false;
    esc = false;
    for (let i = 0; i < attemptStr.length; i++) {
      const ch = attemptStr[i];
      if (esc) {
        esc = false;
        continue;
      }
      if (ch === '\\') {
        esc = true;
        continue;
      }
      if (ch === '"') {
        inStr = !inStr;
        continue;
      }
      if (inStr) continue;

      if (ch === '{') openStack.push('}');
      else if (ch === '[') openStack.push(']');
      else if (ch === '}' || ch === ']') {
        if (openStack.length > 0 && openStack[openStack.length - 1] === ch) {
          openStack.pop();
        }
      }
    }

    // Attempt closing with stack
    const closed = attemptStr + openStack.reverse().join('');
    try {
      return JSON.parse(closed);
    } catch {}

    // 3. Trim back trailing incomplete fragment before retrying
    const trimmed = candidate
      .replace(/,\s*$/, '')
      .replace(/:\s*$/, '')
      .replace(/,\s*"[^"]*"?\s*:?\s*$/, '')
      .replace(/,\s*\[\s*$/, '')
      .replace(/,\s*\{\s*$/, '')
      .replace(/\[\s*$/, '')
      .replace(/\{\s*$/, '')
      .trim();

    if (trimmed === candidate) {
      candidate = candidate.slice(0, -1).trim();
    } else {
      candidate = trimmed;
    }

    if (!candidate || candidate.length < 2) break;
  }

  return null;
}

export function safeParseJSON<T = any>(text: string): T {
  if (typeof text !== 'string') {
    throw new Error(`safeParseJSON: Expected string input, received ${typeof text}`);
  }

  // 1. Remove <think>...</think> blocks
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // 2. Strip ```json and ``` code block fences
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  // 3. Extract from the first '{' or '['
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

  if (startIdx !== -1) {
    cleaned = cleaned.slice(startIdx).trim();
  }

  // 4. Try direct JSON.parse
  try {
    return JSON.parse(cleaned) as T;
  } catch {}

  // 5. Try slicing to the last '}' or ']'
  const lastBrace = cleaned.lastIndexOf('}');
  const lastBracket = cleaned.lastIndexOf(']');
  const endIdx = Math.max(lastBrace, lastBracket);
  if (endIdx > 0 && endIdx < cleaned.length) {
    try {
      const sliced = cleaned.slice(0, endIdx + 1).trim();
      return JSON.parse(sliced) as T;
    } catch {}
  }

  // 6. Try intelligent repair for truncated responses
  const repaired = repairTruncatedJSON(cleaned);
  if (repaired !== null) {
    return repaired as T;
  }

  // 7. If all attempts fail, throw a detailed error
  throw new Error(
    `Failed to parse AI JSON response: Invalid or severely truncated JSON.\nRaw response was:\n${text}`
  );
}
