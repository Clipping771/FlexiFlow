/**
 * Bump whenever prompt text changes in a way that changes model output.
 * The cloud backend includes it in shared cache keys (CLOUD_BACKEND_DESIGN.md §6).
 */
export const PROMPT_VERSION = 'v1';

export function withJsonOnlyReminder(user: string): string {
  return `${user}\n\nCRITICAL: Output ONLY valid JSON.`;
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
