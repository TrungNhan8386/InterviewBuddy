export class PracticeAiError extends Error {
  code: string;
}
export function buildPracticeRequest(input: unknown): Record<string, unknown>;
export function createPracticeProvider(options?: {
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
}): { model: string; generate(input: unknown, options?: { signal?: AbortSignal }): Promise<unknown> };
