import {
  SelectionType,
  LinguisticAnalysisResult,
  WritingGoal,
  WritingAssistResult,
  FollowUpResponse
} from '../../types';
import { getLanguageConfig } from '../../config/languages';
import {
  WordAnalysisSchema,
  PhraseAnalysisSchema,
  SentenceAnalysisSchema,
  ParagraphAnalysisSchema,
  WritingAssistSchema,
  FollowUpResponseSchema
} from './schemas';
import { AIProvider } from './types';
import { safeParseJSON } from './safeJson';

export class AnthropicProvider implements AIProvider {
  name = 'anthropic';
  private apiKey: string;
  private model: string;
  private targetLang: string;

  constructor(
    apiKey: string = '',
    model: string = 'claude-3-5-sonnet-20241022',
    targetLang: string = 'bn'
  ) {
    this.apiKey = apiKey;
    this.model = model;
    this.targetLang = targetLang || 'bn';
  }

  isAvailable(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  private async callAnthropic(systemPrompt: string, userPrompt: string, timeoutMs: number = 12000): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error('Anthropic API key is not configured.');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort(new Error(`Anthropic request timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    let res: Response;
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 1800,
          system: `${systemPrompt}\nOutput strictly valid raw JSON only. Do not add markdown backticks.`,
          messages: [{ role: 'user', content: userPrompt }]
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Anthropic API error (${res.status}): ${err}`);
    }

    const data = await res.json();
    const content = data.content?.[0]?.text;
    if (!content) throw new Error('Empty response from Anthropic API.');

    return content.replace(/```json/g, '').replace(/```/g, '').trim();
  }

  async analyze(
    text: string,
    type: SelectionType,
    contextSentence?: string,
    paragraphContext?: string
  ): Promise<LinguisticAnalysisResult> {
    const lang = getLanguageConfig(this.targetLang);
    const sys = `Analyze English text in context for an ESL ${lang.targetLabel} learner. In translation fields like "bengaliTranslation", "easyBengali", or "explanationBengali", provide ${lang.promptTargetInstruction}. Format as JSON adhering to schema for ${type}.`;
    const prompt = `Text: ${text}\nType: ${type}\nSentence: ${contextSentence || ''}\nParagraph: ${paragraphContext || ''}`;
    const raw = await this.callAnthropic(sys, prompt);
    const parsed = safeParseJSON(raw);

    if (type === 'word') return WordAnalysisSchema.parse(parsed);
    if (type === 'phrase') return PhraseAnalysisSchema.parse(parsed);
    if (type === 'sentence') return SentenceAnalysisSchema.parse(parsed);
    return ParagraphAnalysisSchema.parse(parsed);
  }

  async assistWriting(text: string, goal: WritingGoal): Promise<WritingAssistResult> {
    const raw = await this.callAnthropic(`Writing assistant for goal "${goal}". Return JSON.`, text);
    return WritingAssistSchema.parse(safeParseJSON(raw));
  }

  async askFollowUp(text: string, context: string, question: string): Promise<FollowUpResponse> {
    const lang = getLanguageConfig(this.targetLang);
    const sys = `You are LexiFlow AI Language Coach, an expert, warm, and highly engaging bilingual English-${lang.targetLabel} tutor.
Answer the learner's question with pedagogical clarity, conversational engagement, and natural ${lang.targetLabel} insight (${lang.targetNativeHeader}).
In "bengaliSummary" and example translations, provide ${lang.promptTargetInstruction}.
Return JSON adhering to FollowUpResponseSchema:
{
  "question": "${question}",
  "keyTakeaway": "Short memorable punchline or rule",
  "answer": "Engaging, conversational, well-structured explanation",
  "bengaliSummary": "Clear, natural ${lang.targetLabel} summary (${lang.targetNativeHeader})",
  "suggestedFollowUps": ["Follow-up 1?", "Follow-up 2?"],
  "examples": [
    { "english": "Example sentence", "bengali": "${lang.targetLabel} translation of example" }
  ]
}`;
    const raw = await this.callAnthropic(sys, `Text: ${text}\nContext: ${context}\nQuestion: ${question}`);
    return FollowUpResponseSchema.parse(safeParseJSON(raw));
  }
}
