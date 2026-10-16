import { StageAExplanation, StageBDetailedVocabulary, StageBSense } from '../../types';
import { StageAContextualSchema, StageBDetailedVocabularySchema } from './schemas';

export interface ValidationResult<T> {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  data?: T;
}

const BENGALI_SCRIPT_REGEX = /[\u0980-\u09FF]/;

/**
 * Validates whether a text contains genuine Bengali characters.
 */
export function hasBengaliScript(text?: string): boolean {
  if (!text) return false;
  return BENGALI_SCRIPT_REGEX.test(text);
}

/**
 * Check if text contains word or common inflection (stem).
 */
export function containsWordOrStem(text: string, target: string): boolean {
  if (!text || !target) return false;
  const cleanTarget = target.trim().toLowerCase();
  const cleanText = text.toLowerCase();

  if (cleanText.includes(cleanTarget)) return true;

  // Handle plural/verb endings (e.g., runs -> run, running -> run)
  const stem = cleanTarget.replace(/(ing|ed|es|s|ly|tion|ment)$/i, '');
  if (stem.length >= 3 && cleanText.includes(stem)) return true;

  return false;
}

/**
 * Layer 1 & Layer 2 Validation for Stage A (Immediate Contextual Explanation)
 */
export function validateStageA(raw: unknown, targetLang: string = 'bn'): ValidationResult<StageAExplanation> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Layer 1: Structural Validation
  const parsed = StageAContextualSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      isValid: false,
      errors: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
      warnings: []
    };
  }

  const data = parsed.data as StageAExplanation;

  // Layer 2: Semantic Validation
  // 1. Target language script/text check
  if (targetLang === 'bn') {
    if (!hasBengaliScript(data.easyBengali)) {
      errors.push('easyBengali must contain Bengali script text.');
    }
  } else {
    if (!data.easyBengali || data.easyBengali.trim().length === 0) {
      errors.push('Target language explanation must not be empty.');
    }
  }

  // 2. Easy English check (should not be empty or too verbose for quick reading)
  if (!data.easyEnglish || data.easyEnglish.trim().length === 0) {
    errors.push('easyEnglish must not be empty.');
  }

  // 3. Contextual meaning check
  if (!data.contextMeaning || data.contextMeaning.trim().length === 0) {
    errors.push('contextMeaning must not be empty.');
  }

  // 4. Heuristic: Example should contain target word or stem
  if (data.example && !containsWordOrStem(data.example, data.selectedText)) {
    warnings.push(`Example may not clearly demonstrate "${data.selectedText}".`);
  }

  // 5. Confidence sanity
  if (data.confidence === 'low' && !data.uncertaintyReason) {
    data.uncertaintyReason = 'Context is limited. This is one possible meaning.';
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    data: errors.length === 0 ? data : undefined
  };
}

/**
 * Layer 1 & Layer 2 Validation for Stage B (Detailed Vocabulary Exploration)
 */
export function validateStageB(raw: unknown, expectedLemma?: string, targetLang: string = 'bn'): ValidationResult<StageBDetailedVocabulary> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Layer 1: Structural Validation
  const parsed = StageBDetailedVocabularySchema.safeParse(raw);
  if (!parsed.success) {
    return {
      isValid: false,
      errors: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
      warnings: []
    };
  }

  const data = parsed.data as StageBDetailedVocabulary;
  const lemma = expectedLemma || data.lemma;

  // Layer 2: Semantic Validation
  // 1. Check senses non-empty
  if (!data.senses || data.senses.length === 0) {
    errors.push('Stage B must contain at least one sense.');
    return { isValid: false, errors, warnings };
  }

  // 2. Contextual sense matching
  const matchingSenseIndex = data.senses.findIndex(
    (s) => s.id === data.contextualSenseId || s.isContextual === true
  );

  let orderedSenses: StageBSense[] = [...data.senses];

  if (matchingSenseIndex === -1) {
    // If no explicit match, default first sense as contextual safely
    warnings.push(`contextualSenseId "${data.contextualSenseId}" not found; defaulting first sense.`);
    orderedSenses[0].isContextual = true;
    data.contextualSenseId = orderedSenses[0].id;
  } else if (matchingSenseIndex > 0) {
    // Reorder: Contextual sense MUST be first!
    const [contextualSense] = orderedSenses.splice(matchingSenseIndex, 1);
    contextualSense.isContextual = true;
    orderedSenses.unshift(contextualSense);
    data.contextualSenseId = contextualSense.id;
  } else {
    orderedSenses[0].isContextual = true;
  }

  // 3. Sense definitions & target language validation
  const seenSenseIds = new Set<string>();
  const seenDefinitions = new Set<string>();

  for (const sense of orderedSenses) {
    if (seenSenseIds.has(sense.id)) {
      warnings.push(`Duplicate sense ID found: ${sense.id}. Auto-generating unique ID.`);
      sense.id = `${sense.id}_${Math.random().toString(36).slice(2, 6)}`;
    }
    seenSenseIds.add(sense.id);

    // Text similarity deduplication
    const normDef = sense.easyEnglish.trim().toLowerCase();
    if (seenDefinitions.has(normDef)) {
      warnings.push(`Duplicate sense definition detected for: "${sense.easyEnglish}".`);
    }
    seenDefinitions.add(normDef);

    // Target language check
    if (targetLang === 'bn') {
      if (!hasBengaliScript(sense.easyBengali)) {
        errors.push(`Sense "${sense.id}" easyBengali must contain Bengali script text.`);
      }
    } else {
      if (!sense.easyBengali || sense.easyBengali.trim().length === 0) {
        errors.push(`Sense "${sense.id}" explanation must not be empty.`);
      }
    }

    // Validate examples
    for (const ex of sense.examples || []) {
      if (!containsWordOrStem(ex.english, lemma)) {
        warnings.push(`Example "${ex.english}" in sense "${sense.id}" might not contain the target word.`);
      }
      if (ex.bengali && !hasBengaliScript(ex.bengali)) {
        warnings.push(`Example Bengali translation in sense "${sense.id}" lacks Bengali script.`);
      }
    }

    // Validate synonyms & antonyms
    for (const syn of sense.synonyms || []) {
      if (syn.easyBengali && !hasBengaliScript(syn.easyBengali)) {
        warnings.push(`Synonym "${syn.word}" Bengali definition lacks Bengali script.`);
      }
    }

    for (const ant of sense.antonyms || []) {
      if (ant.easyBengali && !hasBengaliScript(ant.easyBengali)) {
        warnings.push(`Antonym "${ant.word}" Bengali definition lacks Bengali script.`);
      }
    }
  }

  data.senses = orderedSenses;

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    data: errors.length === 0 ? data : undefined
  };
}
