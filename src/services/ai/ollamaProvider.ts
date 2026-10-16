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
    const formattedPrompt = `${prompt}\nRespond with JSON only adhering strictly to schema.`;

    // 1. Primary attempt: /api/chat (supported by all modern chat/instruct models like d1, deepseek-r1, llama3, gemma)
    let chatRes: Response | null = null;
    try {
      chatRes = await fetch(`${this.endpoint}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: formattedPrompt }],
          format: 'json',
          stream: false
        })
      });
    } catch {
      throw new Error('Ollama is not running. Open the Ollama app and try again.');
    }

    if (chatRes.ok) {
      const data = await chatRes.json();
      const content = data?.message?.content || data?.response;
      if (content) return content;
    }

    // 2. Secondary fallback: /api/generate (for legacy base completion models)
    let genRes: Response | null = null;
    try {
      genRes = await fetch(`${this.endpoint}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt: formattedPrompt,
          format: 'json',
          stream: false
        })
      });
    } catch {
      throw new Error('Ollama is not running. Open the Ollama app and try again.');
    }

    if (genRes.ok) {
      const data = await genRes.json();
      return data.response;
    }

    // If both failed, surface the most informative error
    const failedRes = (!chatRes.ok && chatRes.status !== 404) ? chatRes : genRes;
    if (failedRes.status === 401) {
      throw new Error('Run `ollama signin` in a terminal (only needed for -cloud models).');
    }
    if (failedRes.status === 403) {
      throw new Error('Ollama blocked the request.');
    }
    let errText = '';
    try {
      const errJson = await failedRes.json();
      errText = errJson?.error || JSON.stringify(errJson);
    } catch {
      errText = await failedRes.text().catch(() => '');
    }
    throw new Error(`Local Ollama error (${failedRes.status}): ${errText || failedRes.statusText}`);
  }

  async analyze(
    text: string,
    type: SelectionType,
    contextSentence?: string,
    paragraphContext?: string
  ): Promise<LinguisticAnalysisResult> {
    const lang = getLanguageConfig(this.targetLang);
    let prompt = '';

    if (type === 'word') {
      prompt = `You are an expert bilingual lexicographer for an ESL ${lang.targetLabel} learner.
Analyze the word "${text}" in the context of this sentence: "${contextSentence || ''}".
In "bengaliTranslation", provide ${lang.promptTargetInstruction}.
Return a valid raw JSON object strictly adhering to this schema:
{
  "selectedText": "${text}",
  "selectionType": "word",
  "contextualMeaning": "Precise meaning in this context",
  "simpleEnglishExplanation": "Plain English explanation",
  "bengaliTranslation": "${lang.targetLabel} meaning and explanation",
  "whyFitsContext": "Why this specific meaning fits this sentence",
  "partOfSpeech": "noun / verb / adjective / adverb",
  "grammaticalNote": "Grammar or syntactic role",
  "collocations": ["collocation 1", "collocation 2"],
  "examples": ["example sentence 1"],
  "synonyms": ["synonym 1"],
  "antonyms": ["antonym 1"],
  "registerAndTone": "Tone description"
}`;
    } else if (type === 'phrase') {
      prompt = `You are an expert bilingual tutor for an ESL ${lang.targetLabel} learner.
Analyze the phrase or idiom "${text}" in context: "${contextSentence || ''}".
In "bengaliTranslation", provide ${lang.promptTargetInstruction}.
Return a valid raw JSON object strictly adhering to this schema:
{
  "selectedText": "${text}",
  "selectionType": "phrase",
  "phraseType": "idiom",
  "overallMeaning": "Meaning as a unified unit",
  "simpleEnglishExplanation": "Simple English explanation",
  "bengaliTranslation": "${lang.targetLabel} translation and explanation",
  "literalVsFigurative": "Literal vs figurative distinction",
  "whyFitsContext": "Why it fits this context",
  "examples": ["example sentence 1"]
}`;
    } else if (type === 'sentence') {
      prompt = `Analyze this sentence for an ESL ${lang.targetLabel} learner: "${text}".
Context: "${contextSentence || ''}".
In "bengaliTranslation" and "easyBengali", provide ${lang.promptTargetInstruction}.
Return a valid raw JSON object strictly adhering to this schema:
{
  "selectedText": "${text}",
  "selectionType": "sentence",
  "plainEnglishParaphrase": "Very easy plain English paraphrase",
  "overallMeaning": "Overall meaning",
  "bengaliTranslation": "Complete natural ${lang.targetLabel} translation",
  "phraseBreakdown": [
    {
      "phrase": "Exact meaningful phrase from sentence",
      "easyEnglish": "Very simple everyday English explanation.",
      "easyBengali": "Natural easy ${lang.targetLabel} explanation"
    }
  ],
  "clauses": [
    {
      "text": "Clause text",
      "type": "main",
      "role": "Main Clause",
      "explanationBengali": "Clause explanation in ${lang.targetLabel}"
    }
  ],
  "grammaticalHighlights": ["Key grammar point"],
  "difficultVocabulary": [{"word": "word", "meaningInContext": "meaning", "bengali": "translation"}],
  "toneAndRegister": "Standard English"
}`;
    } else {
      prompt = `Analyze this paragraph for an ESL ${lang.targetLabel} learner: "${text}".
In "bengaliTranslation" and "easyBengali", provide ${lang.promptTargetInstruction}.
Return a valid raw JSON object strictly adhering to this schema:
{
  "selectedText": "${text}",
  "selectionType": "paragraph",
  "mainIdea": "Main thesis of the paragraph",
  "conciseSummary": "Concise summary",
  "bengaliTranslation": "Complete natural ${lang.targetLabel} translation",
  "phraseBreakdown": [
    {
      "phrase": "Exact phrase",
      "easyEnglish": "Simple English explanation",
      "easyBengali": "Natural ${lang.targetLabel} explanation"
    }
  ],
  "keyVocabulary": [{"term": "term", "meaning": "meaning", "bengali": "translation"}],
  "toneAndRegister": "Standard English"
}`;
    }

    const raw = await this.callOllama(prompt);
    let parsed: any;
    try {
      parsed = safeParseJSON(raw);
    } catch {
      parsed = {};
    }
    if (parsed && typeof parsed === 'object') {
      if (!parsed.selectedText) parsed.selectedText = text;
      if (!parsed.selectionType) parsed.selectionType = type;
    }

    if (type === 'word') return WordAnalysisSchema.parse(parsed);
    if (type === 'phrase') return PhraseAnalysisSchema.parse(parsed);
    if (type === 'sentence') return SentenceAnalysisSchema.parse(parsed);
    return ParagraphAnalysisSchema.parse(parsed);
  }

  async assistWriting(text: string, goal: WritingGoal): Promise<WritingAssistResult> {
    const lang = getLanguageConfig(this.targetLang);
    const prompt = `Writing assist for goal "${goal}" on text: "${text}".
In "bengaliExplanation", provide ${lang.promptTargetInstruction}.
Return a valid raw JSON object strictly adhering to this schema:
{
  "originalText": "${text}",
  "goal": "${goal}",
  "improvedText": "Improved version of text",
  "changesExplanation": "Clear explanation of improvements made",
  "bengaliExplanation": "Explanation in ${lang.targetLabel}",
  "alternatives": ["Alternative phrasing 1", "Alternative phrasing 2"]
}`;
    const raw = await this.callOllama(prompt);
    return WritingAssistSchema.parse(safeParseJSON(raw));
  }

  async askFollowUp(text: string, context: string, question: string): Promise<FollowUpResponse> {
    const lang = getLanguageConfig(this.targetLang);
    const prompt = `You are LexiFlow AI Language Coach, an expert bilingual English-${lang.targetLabel} tutor.
Answer question "${question}" about text: "${text}" in context: "${context}".
In "bengaliSummary" and example translations, provide ${lang.promptTargetInstruction}.
Return a valid raw JSON object strictly adhering to this schema:
{
  "question": "${question}",
  "keyTakeaway": "Short memorable punchline or rule",
  "answer": "Engaging, conversational, well-structured explanation",
  "bengaliSummary": "Clear, natural ${lang.targetLabel} summary",
  "suggestedFollowUps": ["Follow-up question 1?", "Follow-up question 2?"],
  "examples": [
    { "english": "Example sentence", "bengali": "${lang.targetLabel} translation of example" }
  ]
}`;
    const raw = await this.callOllama(prompt);
    return FollowUpResponseSchema.parse(safeParseJSON(raw));
  }
}
