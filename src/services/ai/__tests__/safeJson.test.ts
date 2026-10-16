import { describe, it, expect } from 'vitest';
import { safeParseJSON } from '../safeJson';

describe('safeParseJSON shared helper', () => {
  it('parses standard valid JSON', () => {
    const input = '{"word": "scrutiny", "partOfSpeech": "noun"}';
    const result = safeParseJSON(input);
    expect(result).toEqual({ word: 'scrutiny', partOfSpeech: 'noun' });
  });

  it('removes <think>...</think> reasoning blocks before parsing', () => {
    const input = `<think>
The user is asking for the meaning of "resilient".
I should output JSON conforming to the schema.
</think>
{"selectedText": "resilient", "confidence": "high"}`;
    const result = safeParseJSON(input);
    expect(result).toEqual({ selectedText: 'resilient', confidence: 'high' });
  });

  it('strips ```json and ``` markdown code fences', () => {
    const input = `\`\`\`json
{
  "message": "hello",
  "items": [1, 2, 3]
}
\`\`\``;
    const result = safeParseJSON(input);
    expect(result).toEqual({ message: 'hello', items: [1, 2, 3] });
  });

  it('extracts JSON when surrounded by conversational prefix and postfix commentary', () => {
    const input = `Sure! Here is the JSON you requested:
{"key": "value"}
Hope this helps! Let me know if you need anything else.`;
    const result = safeParseJSON(input);
    expect(result).toEqual({ key: 'value' });
  });

  it('extracts JSON arrays as well', () => {
    const input = `[{"id": 1}, {"id": 2}]`;
    const result = safeParseJSON(input);
    expect(result).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('automatically repairs and parses truncated or cut-off JSON output', () => {
    const truncated = '{"selectedText": "Trump said", "phraseBreakdown": [{"phrase": "Trump said", "meaning": "explained"}], "difficultVocabulary": [{';
    const result = safeParseJSON(truncated);
    expect(result).toBeDefined();
    expect(result.selectedText).toBe('Trump said');
    expect(result.phraseBreakdown).toHaveLength(1);
  });

  it('throws clear error including the raw response if parsing fails', () => {
    const invalid = 'This is not JSON at all.';
    expect(() => safeParseJSON(invalid)).toThrowError(/Failed to parse AI JSON response/);
    expect(() => safeParseJSON(invalid)).toThrowError(/This is not JSON at all/);
  });
});
