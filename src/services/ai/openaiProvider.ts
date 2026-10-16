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

export class OpenAIProvider implements AIProvider {
  name = 'openai';
  private apiKey: string;
  private model: string;
  private endpoint: string;
  private targetLang: string;

  constructor(
    apiKey: string = '',
    model: string = 'gpt-4o-mini',
    endpoint: string = 'https://api.openai.com/v1',
    targetLang: string = 'bn'
  ) {
    this.apiKey = apiKey;
    this.model = model;
    this.endpoint = endpoint.replace(/\/+$/, '');
    this.targetLang = targetLang || 'bn';
  }

  isAvailable(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  private async callOpenAI(systemPrompt: string, userPrompt: string, timeoutMs: number = 12000): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error('OpenAI API key is not configured in LexiFlow settings.');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort(new Error(`OpenAI request timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    let res: Response;
    try {
      res = await fetch(`${this.endpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: `${systemPrompt}\nOutput ONLY valid raw JSON.` },
            { role: 'user', content: userPrompt }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2
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
      throw new Error(`OpenAI API error (${res.status}): ${err}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('Empty response from OpenAI API.');

    return content.trim();
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
    const raw = await this.callOpenAI(sys, prompt);
    const parsed = safeParseJSON(raw);

    if (type === 'word') return WordAnalysisSchema.parse(parsed);
    if (type === 'phrase') return PhraseAnalysisSchema.parse(parsed);
    if (type === 'sentence') return SentenceAnalysisSchema.parse(parsed);
    return ParagraphAnalysisSchema.parse(parsed);
  }

  async assistWriting(text: string, goal: WritingGoal): Promise<WritingAssistResult> {
    const sys = `Writing assistant for goal "${goal}". Return JSON adhering to WritingAssistSchema.`;
    const raw = await this.callOpenAI(sys, text);
    return WritingAssistSchema.parse(safeParseJSON(raw));
  }

  async askFollowUp(text: string, context: string, question: string): Promise<FollowUpResponse> {
    const lang = getLanguageConfig(this.targetLang);
    const sys = `You are LexiFlow AI Language Coach, an expert, warm, and highly engaging bilingual English-${lang.targetLabel} tutor.
Answer learner's question about selected text: "${text}" in context: "${context}".
In "bengaliSummary" and example translation fields, provide ${lang.promptTargetInstruction}.
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
    const raw = await this.callOpenAI(sys, `Text: ${text}\nContext: ${context}\nQuestion: ${question}`);
    return FollowUpResponseSchema.parse(safeParseJSON(raw));
  }
}
