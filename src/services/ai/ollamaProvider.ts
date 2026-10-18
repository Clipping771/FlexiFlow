import {
  SelectionType,
  LinguisticAnalysisResult,
  WritingGoal,
  WritingAssistResult,
  FollowUpResponse,
  HighlightExtractionResult
} from '../../types';
import { getLanguageConfig } from '../../config/languages';
import {
  WordAnalysisSchema,
  PhraseAnalysisSchema,
  SentenceAnalysisSchema,
  ParagraphAnalysisSchema,
  WritingAssistSchema,
  FollowUpResponseSchema,
  HighlightExtractionResultSchema
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

    // Try primary endpoint, with automatic fallback between localhost and 127.0.0.1
    const candidateEndpoints = [this.endpoint];
    if (this.endpoint.includes('localhost')) {
      candidateEndpoints.push(this.endpoint.replace('localhost', '127.0.0.1'));
    } else if (this.endpoint.includes('127.0.0.1')) {
      candidateEndpoints.push(this.endpoint.replace('127.0.0.1', 'localhost'));
    }

    let lastError: any = null;

    for (const ep of candidateEndpoints) {
      try {
        console.log(`[LexiFlow Ollama] Dispatching request to endpoint: ${ep}, active model: ${this.model}`);
        
        // 1. Primary attempt: /api/chat
        let chatRes = await fetch(`${ep}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: this.model,
            messages: [{ role: 'user', content: formattedPrompt }],
            format: 'json',
            stream: false
          })
        });

        // If model not found (e.g. 404 or error text), try auto-detecting installed model from /api/tags
        if (!chatRes.ok && (chatRes.status === 404 || chatRes.status === 400)) {
          const errText = await chatRes.text().catch(() => '');
          if (errText.includes('not found') || chatRes.status === 404) {
            console.warn(`[LexiFlow Ollama] Model "${this.model}" not found at ${ep}. Attempting model auto-discovery from /api/tags...`);
            const discovered = await this.autoDiscoverModel(ep);
            if (discovered && discovered !== this.model) {
              console.log(`[LexiFlow Ollama] Discovered and switched to active model: "${discovered}"`);
              this.model = discovered;
              chatRes = await fetch(`${ep}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  model: this.model,
                  messages: [{ role: 'user', content: formattedPrompt }],
                  format: 'json',
                  stream: false
                })
              });
            }
          }
        }

        if (chatRes.ok) {
          this.endpoint = ep; // lock on working endpoint
          const data = await chatRes.json();
          const content = data?.message?.content || data?.response;
          if (content) return content;
        }

        // 2. Secondary fallback: /api/generate
        let genRes = await fetch(`${ep}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: this.model,
            prompt: formattedPrompt,
            format: 'json',
            stream: false
          })
        });

        if (genRes.ok) {
          this.endpoint = ep;
          const data = await genRes.json();
          return data.response;
        }

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
        lastError = new Error(`Local Ollama error (${failedRes.status}): ${errText || failedRes.statusText}`);
      } catch (err: any) {
        lastError = err;
      }
    }

    if (
      !lastError ||
      lastError.name === 'TypeError' ||
      /fetch|connect|econnrefused/i.test(lastError.message || '')
    ) {
      throw new Error('Ollama is not running. Open the Ollama app and try again.');
    }

    throw lastError;
  }

  private async autoDiscoverModel(endpoint: string): Promise<string | null> {
    try {
      const res = await fetch(`${endpoint}/api/tags`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.models) && data.models.length > 0) {
          return data.models[0].name;
        }
      }
    } catch {
      // ignore
    }
    return null;
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
      prompt = `Analyze this text for an ESL ${lang.targetLabel} learner with smart hierarchical segmentation:
1. Divide text into paragraphs.
2. For each paragraph, extract each sentence.
3. For each sentence, provide the complete natural ${lang.targetLabel} translation and phrase-by-phrase breakdown.
In "bengaliTranslation" and "easyBengali", provide ${lang.promptTargetInstruction}.
Return a valid raw JSON object strictly adhering to this schema:
{
  "selectedText": "${text}",
  "selectionType": "paragraph",
  "mainIdea": "Main thesis of the text",
  "conciseSummary": "Concise summary",
  "bengaliTranslation": "Complete natural ${lang.targetLabel} translation",
  "paragraphs": [
    {
      "paragraphIndex": 1,
      "paragraphText": "Exact paragraph text",
      "mainIdea": "Paragraph main idea",
      "bengaliTranslation": "Paragraph translation in ${lang.targetLabel}",
      "sentences": [
        {
          "sentenceIndex": 1,
          "sentenceText": "Exact sentence text",
          "bengaliTranslation": "Sentence translation in ${lang.targetLabel}",
          "phraseBreakdown": [
            {
              "phrase": "Exact sequential phrase from sentence",
              "easyEnglish": "Simple English explanation",
              "easyBengali": "Natural ${lang.targetLabel} explanation"
            }
          ]
        }
      ]
    }
  ],
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

  async extractHighlights(rawText: string, pageTitle?: string): Promise<HighlightExtractionResult> {
    const lang = getLanguageConfig(this.targetLang);
    console.log(`[LexiFlow Ollama] Extracting highlights using model: "${this.model}" at ${this.endpoint}`);

    const prompt = `You are LexiFlow AI, an elite university reading instructor and bilingual language acquisition tutor.
Your mission is to identify the words, collocations, phrasal verbs, idioms, and discourse connectors that provide the GREATEST PEDAGOGICAL LEARNING VALUE for an English learner reading this specific article.

Analyze the article holistically to understand its topic, central thesis, and argument flow before selecting items.

SELECTION CRITERIA (Prioritize in this order):
1. CENTRAL-IDEA VOCABULARY: Key terms and concepts essential to comprehending the author's primary arguments and claims.
2. HIGH-VALUE DOMAIN & JOURNALISTIC VOCABULARY: Precise academic, professional, or domain-relevant words with high transferable utility across future reading situations (CEFR B2-C1).
3. MULTIWORD EXPRESSIONS & PHRASES: Idioms, phrasal verbs, and natural collocations where meaning resides in the whole phrase rather than individual words (e.g., "go beyond", "in the wake of"). Select the ENTIRE phrase, never just a single word!
4. CONTEXT-DEPENDENT MEANINGS: Words whose meaning in this article differs from their standard everyday meaning.
5. DISCOURSE CONNECTORS: Structural connectors that signal contrast, concession, cause, or qualification (e.g., "notwithstanding").

WHAT TO STRICTLY AVOID & PENALIZE:
- Trivial, everyday words with zero learning value (e.g., "wearing", "make", "piece", "good", "people", "start", "discover").
- Obscure, archaic words.
- Single words that are part of a larger multiword phrase.
- Over-highlighting: Only select terms with genuine learning value.

EVERY ITEM MUST BE GROUNDED IN THE ARTICLE:
- "text": The exact word or phrase verbatim as it appears in the text.
- "contextSentence": The complete sentence from the text containing this item.
- "type": "word" | "phrase" | "idiom".
- "easyEnglish": Clear, learner-friendly English explanation.
- "easyBengali": Natural ${lang.targetLabel} translation (${lang.promptTargetInstruction}).
- "reason": Pedagogical reason explaining why this item is valuable to learn from this article.
- "difficulty": "easy" | "medium" | "hard".
- "learningValueScore": Floating number from 0.0 to 1.0 ranking its educational value.
- "isArticleCore": boolean (true if directly related to the article's central message).

Return raw JSON strictly adhering to this schema:
{
  "items": [
    {
      "id": "hl_1",
      "text": "Exact word or phrase from text",
      "type": "word",
      "contextSentence": "Full sentence from the text where it appears",
      "easyEnglish": "Very clear, everyday English definition in 1 short sentence",
      "easyBengali": "Natural ${lang.targetLabel} translation",
      "reason": "Why this item is useful for learners to acquire",
      "difficulty": "easy" | "medium" | "hard",
      "learningValueScore": 0.85,
      "isArticleCore": true
    }
  ],
  "pageTitle": "${pageTitle || 'Webpage Article'}",
  "articleSummary": "Brief 1-sentence summary of the article's core thesis"
}

Article:
"""
${rawText.slice(0, 15000)}
"""`;

    const raw = await this.callOllama(prompt);
    let parsed: any;
    try {
      parsed = safeParseJSON(raw);
    } catch (err) {
      console.warn('[LexiFlow Ollama] extractHighlights JSON parse error, raw was:', raw.slice(0, 200));
      parsed = { items: [] };
    }

    const items = Array.isArray(parsed?.items) ? parsed.items : [];
    return HighlightExtractionResultSchema.parse({
      items,
      pageTitle: pageTitle || parsed?.pageTitle || 'Webpage Vocabulary',
      totalAnalyzedWords: rawText.split(/\s+/).filter(Boolean).length,
      sourceMode: 'ai_reasoning',
      articleSummary: parsed?.articleSummary
    });
  }
}
