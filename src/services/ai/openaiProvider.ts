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
    let sys = '';

    if (type === 'word') {
      sys = `You are an expert bilingual lexicographer for an ESL ${lang.targetLabel} learner.
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
      sys = `You are an expert bilingual tutor for an ESL ${lang.targetLabel} learner.
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
      sys = `Analyze this sentence for an ESL ${lang.targetLabel} learner.
In "bengaliTranslation" and "easyBengali", provide ${lang.promptTargetInstruction}.
Important: All translation fields ("bengaliTranslation", "easyBengali", "explanationBengali") must be strictly written in ${lang.targetLabel} (${lang.targetNativeLabel}). Never output Bengali if the target language is NOT Bengali. If target language is Bengali, write strictly in Bengali script.
Important: In "phraseBreakdown", you MUST partition the ENTIRE sentence from the first word to the last word into sequential, contiguous chunks without skipping any words (100% sentence coverage).
Important Grammatical Instructions:
1. Classify sentence complexity (simple, compound, complex, compound-complex) using true coordination and subordination, NOT clause count alone.
2. For each clause, extract Subject, Verb, Direct Object, and Clause Pattern.
3. Recognize conversational self-corrections (e.g. "sorry product") and discourse markers. NEVER classify conversational repairs as separate clauses!
4. Strictly ground syntactic tree in the original sentence without introducing external details (e.g. no external names or locations not in sentence).
Return a valid raw JSON object strictly adhering to this schema:
{
  "selectedText": "${text}",
  "selectionType": "sentence",
  "plainEnglishParaphrase": "Very easy plain English paraphrase",
  "overallMeaning": "Overall meaning",
  "sentenceStructure": {
    "type": "simple" | "compound" | "complex" | "compound-complex",
    "explanation": "Structure explanation in English",
    "explanationBengali": "Structure explanation in ${lang.targetLabel}"
  },
  "bengaliTranslation": "Complete natural ${lang.targetLabel} translation",
  "phraseBreakdown": [
    {
      "phrase": "Sequential contiguous chunk of sentence (in chronological order, covering 100% of the sentence without skipping words)",
      "easyEnglish": "Very simple everyday English explanation.",
      "easyBengali": "Natural easy ${lang.targetLabel} explanation"
    }
  ],
  "clauses": [
    {
      "text": "Clause text",
      "type": "main" | "subordinate" | "relative" | "noun",
      "role": "Main Clause",
      "subject": "Subject",
      "verb": "Verb",
      "directObject": "Direct object if present",
      "clausePattern": "e.g. S + V + DO",
      "explanationBengali": "Clause explanation in ${lang.targetLabel}"
    }
  ],
  "conversationalElements": [
    {
      "text": "e.g. sorry product",
      "type": "self_correction",
      "typeLabel": "Conversational Repair",
      "targetOriginal": "invention",
      "correctedTo": "product",
      "explanation": "Self-correction in English",
      "explanationBengali": "Correction explanation in ${lang.targetLabel}"
    }
  ],
  "grammaticalHighlights": ["Key grammar point"],
  "difficultVocabulary": [{"word": "word", "meaningInContext": "meaning", "bengali": "translation", "grammaticalRole": "role"}],
  "toneAndRegister": "Standard English"
}`;
    } else {
      sys = `Analyze this text for a learner using smart hierarchical segmentation:
1. Divide text into paragraphs.
2. For each paragraph, extract each sentence.
3. For each sentence, provide the complete natural ${lang.targetLabel} translation and sequential phrase-by-phrase breakdown with plain English and ${lang.targetLabel} explanations.
All translation and explanation fields ("bengaliTranslation", "easyBengali") must be strictly written in ${lang.targetLabel} (${lang.targetNativeLabel}).

Return a valid raw JSON object strictly adhering to this schema:
{
  "selectedText": "${text}",
  "selectionType": "paragraph",
  "mainIdea": "Main thesis of the entire text",
  "conciseSummary": "Concise summary",
  "bengaliTranslation": "Complete natural ${lang.targetLabel} translation of text (${lang.promptTargetInstruction})",
  "paragraphs": [
    {
      "paragraphIndex": 1,
      "paragraphText": "Exact text of paragraph 1",
      "mainIdea": "Main idea of this paragraph",
      "bengaliTranslation": "Natural ${lang.targetLabel} translation of this paragraph",
      "sentences": [
        {
          "sentenceIndex": 1,
          "sentenceText": "Exact sentence text",
          "bengaliTranslation": "Natural ${lang.targetLabel} translation of this sentence",
          "phraseBreakdown": [
            {
              "phrase": "Exact sequential chunk from this sentence",
              "easyEnglish": "Very simple everyday English explanation.",
              "easyBengali": "Natural easy ${lang.targetLabel} explanation (${lang.promptTargetInstruction})"
            }
          ]
        }
      ]
    }
  ],
  "phraseBreakdown": [
    {
      "phrase": "Exact meaningful phrase from text",
      "easyEnglish": "Simple English explanation",
      "easyBengali": "Natural easy ${lang.targetLabel} explanation"
    }
  ],
  "sentenceBreakdown": ["Sentence 1 summary", "Sentence 2 summary"],
  "keyVocabulary": [{"term": "term", "meaning": "meaning", "bengali": "translation"}],
  "toneAndRegister": "Standard English"
}`;
    }

    const prompt = `Text: ${text}\nType: ${type}\nSentence: ${contextSentence || ''}\nParagraph: ${paragraphContext || ''}`;
    const raw = await this.callOpenAI(sys, prompt);
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
    const sys = `Writing assistant for goal "${goal}".
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
