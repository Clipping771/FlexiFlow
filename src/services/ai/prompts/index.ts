/**
 * Bump whenever prompt text changes in a way that changes model output.
 * The cloud backend includes it in shared cache keys (CLOUD_BACKEND_DESIGN.md §6).
 */
export const PROMPT_VERSION = 'v1';

export function withJsonOnlyReminder(user: string): string {
  return `${user}\n\nCRITICAL: Output ONLY valid JSON.`;
}

/** Generic retry prompt for outputs checked by a zod schema rather than a dedicated validator. */
export function buildSchemaCorrection(user: string, errors: string[]): string {
  return `${user}\n\nYour previous response had validation errors:\n${errors.join('\n')}\nReturn corrected, complete JSON that matches the requested schema.`;
}

export function toSinglePrompt(spec: { system: string; user: string }): string {
  return `${spec.system}\n${spec.user}`;
}

export * from './types';
export * from './stageA';
export * from './stageB';
export * from './analyze';
export * from './writing';
export * from './followUp';
export * from './highlights';
export * from './usage';
export * from './summary';
