export const REPORT_PROMPT_VERSION: string;
export class ReportSummaryError extends Error {
  code: string;
}
export function buildSummaryRequest(input: unknown): Record<string, unknown>;
export function createReportSummaryProvider(options?: {
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
}): {
  model: string;
  summarize(input: unknown, options?: { signal?: AbortSignal }): Promise<{ text: string; strengths: string[]; improvements: string[] }>;
};
