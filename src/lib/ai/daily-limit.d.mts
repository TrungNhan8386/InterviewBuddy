import type { SupabaseClient } from '@supabase/supabase-js';

export const DEFAULT_DAILY_AI_LIMIT: number;
export function dailyLimitFromEnv(env?: Record<string, string | undefined>): number;

export interface AiUsage {
  allowed: boolean;
  used: number;
  limit: number;
  /** Next 00:00 in Vietnam time (ISO timestamp). */
  resetAt: string;
}

export class AiLimitError extends Error {
  code: 'AI_DAILY_LIMIT' | 'DATABASE_NOT_READY' | 'SERVER_ERROR';
  usage: AiUsage | null;
}

export function createAiCallCounter(
  supabase: Pick<SupabaseClient, 'rpc'>,
  options?: { limit?: number },
): () => Promise<AiUsage>;

export function withAnalysisLimit<T extends { analyze: (...args: never[]) => unknown }>(provider: T, consume: () => Promise<unknown>): T;
export function withInterviewerLimit<T extends { next: (...args: never[]) => unknown }>(provider: T, consume: () => Promise<unknown>): T;
