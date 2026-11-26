import type { SupabaseClient } from '@supabase/supabase-js';

export type PracticeCriterion = 'content' | 'structure' | 'clarity' | 'confidence';
export type PracticeErrorCode =
  | 'BAD_INPUT' | 'UNAUTHORIZED' | 'NOT_FOUND' | 'SESSION_NOT_COMPLETED' | 'NOT_ENOUGH_SCORES'
  | 'AI_DAILY_LIMIT' | 'AI_RATE_LIMITED' | 'AI_UNAVAILABLE' | 'AI_TIMEOUT' | 'AI_CONTENT_BLOCKED'
  | 'INVALID_OUTPUT' | 'AI_NOT_CONFIGURED' | 'AI_CONFIGURATION_ERROR' | 'DATABASE_NOT_READY' | 'SERVER_ERROR';

export const PRACTICE_ERROR_STATUS: Record<PracticeErrorCode, number>;

export class PracticeError extends Error {
  code: PracticeErrorCode;
  status: number;
  details: { resetAt: string | null } | null;
}

export interface PracticeQuestionItem {
  id: string;
  position: number;
  question: string;
  tip: string | null;
  practiceSessionId: string | null;
}

export interface PracticeGroup {
  criterion: PracticeCriterion;
  score: number | null;
  questions: PracticeQuestionItem[];
}

/** 200 response of GET and POST /api/practice/generate. */
export interface PracticeResponse {
  sessionId: string;
  state: 'ready' | 'not_generated';
  language?: 'vi' | 'en';
  generatedAt?: string | null;
  noMajorWeakness?: boolean;
  alreadySaved?: boolean;
  groups: PracticeGroup[];
}

export interface PracticeRepository {
  session(id: string): Promise<unknown>;
  questions(id: string): Promise<unknown[] | null>;
  saved(id: string): Promise<unknown[] | null>;
  insert(rows: unknown[]): Promise<unknown[] | null>;
  start(practiceQuestionId: string): Promise<{ sessionId: string; resumed: boolean }>;
}

export function createPracticeRepository(supabase: SupabaseClient): PracticeRepository;

export function createPracticeService(deps: {
  repository: PracticeRepository;
  provider: { model: string; generate(input: unknown, options?: { signal?: AbortSignal }): Promise<unknown> };
  consume: () => Promise<unknown>;
}): {
  read(sessionId: string): Promise<PracticeResponse>;
  generate(sessionId: string, options?: { signal?: AbortSignal }): Promise<PracticeResponse>;
  start(practiceQuestionId: string): Promise<{ sessionId: string; resumed: boolean }>;
};
