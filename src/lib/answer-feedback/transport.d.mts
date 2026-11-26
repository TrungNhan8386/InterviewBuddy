import type { AnswerFeedback } from './types';
export function adaptFeedback(body: unknown, answerId: string): AnswerFeedback;
export function canRetryFeedback(code: string): boolean;
export function loadFeedback(answerId: string, options?: {signal?: AbortSignal; fetchImpl?: typeof fetch}): Promise<AnswerFeedback>;
