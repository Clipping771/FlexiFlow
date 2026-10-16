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

export class OllamaProvider implements AIProvider {
  name = 'ollama';
  private endpoint: string;
  private model: string;
  private targetLang: string;

  constructor(
    endpoint: string = 'http://localhost:11434',
    model: string = 'llama3.2',
    targetLang: string = 'bn'
  ) {
    this.endpoint = endpoint.replace(/\/+$/, '');
    this.model = model || 'llama3.2';
    this.targetLang = targetLang || 'bn';
  }

  isAvailable(): boolean {
    return true;
  }

  private async callOllama(prompt: string): Promise<string> {
    let res: Response;
    try {
      res = await fetch(`${this.endpoint}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt: `${prompt}\nRespond with JSON only adhering strictly to schema.`,
          format: 'json',
          stream: false
        })
      });
    } catch {
      throw new Error('Ollama is not running. Open the Ollama app and try again.');
    }

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error('Run `ollama signin` in a terminal (only needed for -cloud models).');
      }
      if (res.status === 403) {
        throw new Error('Ollama blocked the request.');
      }
      let errText = '';
      try {
        const errJson = await res.json();
        errText = errJson?.error || JSON.stringify(errJson);
      } catch {
        errText = await res.text().catch(() => '');
      }
      throw new Error(`Local Ollama error (${res.status}): ${errText || res.statusText}`);
    }

    const data = await res.json();
    return data.response;
  }

  async analyze(
    text: string,
    type: SelectionType,
    contextSentence?: string,
    paragraphContext?: string
  ): Promise<LinguisticAnalysisResult> {
    const lang = getLanguageConfig(this.targetLang);
    const prompt = `Analyze English text in context for an ESL ${lang.targetLabel} learner. In translation fields like "bengaliTranslation", "easyBengali", or "explanationBengali", provide ${lang.promptTargetInstruction}. Return JSON for type: "${type}". Text: "${text}". Context: "${contextSentence || ''}".`;
    const raw = await this.callOllama(prompt);
    const parsed = safeParseJSON(raw);

    if (type === 'word') return WordAnalysisSchema.parse(parsed);
    if (type === 'phrase') return PhraseAnalysisSchema.parse(parsed);
    if (type === 'sentence') return SentenceAnalysisSchema.parse(parsed);
    return ParagraphAnalysisSchema.parse(parsed);
  }

  async assistWriting(text: string, goal: WritingGoal): Promise<WritingAssistResult> {
    const raw = await this.callOllama(`Writing assist for goal "${goal}": ${text}`);
    return WritingAssistSchema.parse(safeParseJSON(raw));
  }

  async askFollowUp(text: string, context: string, question: string): Promise<FollowUpResponse> {
    const raw = await this.callOllama(`Answer question "${question}" about text: "${text}". Context: "${context}".`);
    return FollowUpResponseSchema.parse(safeParseJSON(raw));
  }
}
