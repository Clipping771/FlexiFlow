import { z } from 'zod';

/** Validates Usage Coach output (UsageCoachFeedback in src/types); see prompts/usage.ts. */
export const UsageCoachFeedbackSchema = z.object({
  targetWord: z.string().min(1),
  isGrammaticallyCorrect: z.boolean(),
  collocationScore: z.coerce.number().int().min(0).max(100),
  grammarCorrectness: z.string().optional(),
  naturalAlternative: z.string().min(1),
  bengaliFeedback: z.string().min(1),
  alternativeCollocations: z.array(z.string()).default([])
});
