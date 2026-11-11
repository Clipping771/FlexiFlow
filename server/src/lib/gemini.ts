// Server-side Gemini client. The request shape matches GeminiProvider in the extension so that
// cloud and BYOK users get the same output for the same prompt.

export class GeminiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'GeminiError';
  }
}

export interface GeminiResult {
  text: string;
  tokensIn: number;
  tokensOut: number;
}

export interface GeminiRequest {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  maxTokens: number;
  timeoutMs?: number;
}

export async function generateGeminiJson(req: GeminiRequest): Promise<GeminiResult> {
  const generationConfig: Record<string, unknown> = {
    responseMimeType: 'application/json',
    temperature: 0.1,
    maxOutputTokens: req.maxTokens
  };
  // Reasoning models add seconds of latency unless thinking is switched off.
  if (req.model.includes('thinking') || req.model.includes('2.5')) {
    generationConfig.thinkingConfig = { thinkingBudget: 0 };
  }

  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: `${req.system}\n\nRespond ONLY in valid raw JSON matching the requested schema without markdown fences.\n\nInput:\n${req.user}` }
        ]
      }
    ],
    generationConfig
  };

  let res: Response;
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(req.model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': req.apiKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(req.timeoutMs ?? 20000)
    });
  } catch (err) {
    throw new GeminiError(`Gemini request failed: ${(err as Error)?.name ?? 'Error'}`);
  }
  // The error body is not logged or returned: it can echo the prompt.
  if (!res.ok) throw new GeminiError(`Gemini returned HTTP ${res.status}`, res.status);

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new GeminiError('Gemini returned no content');

  return {
    text: text.replace(/```json/g, '').replace(/```/g, '').trim(),
    tokensIn: data.usageMetadata?.promptTokenCount ?? 0,
    tokensOut: data.usageMetadata?.candidatesTokenCount ?? 0
  };
}
