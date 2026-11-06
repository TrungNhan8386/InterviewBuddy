import type { NextRequest, NextResponse } from './next-service.mjs';
export class InterviewStreamError extends Error {
  code: string;
  constructor(code: string, message: string);
}
export type InterviewStreamStatus = 'generating' | 'slow' | 'extended' | 'complete' | 'cancelled' | 'error';
export interface InterviewStreamMetrics {
  firstDeltaMs: number | null; elapsedMs: number;
  outcome: 'complete' | 'error' | 'cancelled' | 'timeout'; code: string | null;
}
export function requestInterviewNext(body: NextRequest, options?: {
  signal?: AbortSignal;
  onPreview?: (provisionalText: string) => void;
  onStatus?: (status: InterviewStreamStatus) => void;
  onMetrics?: (metrics: InterviewStreamMetrics) => void;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}): Promise<NextResponse>;
