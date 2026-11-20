import type { NextResponse } from '../interview/next-service.mjs';
import type { InterviewStreamStatus, InterviewStreamMetrics } from '../interview/next-stream-client.mjs';
export interface ChatStreamOptions {
  signal?: AbortSignal;
  onPreview?: (text: string) => void;
  onStatus?: (status: InterviewStreamStatus) => void;
  onMetrics?: (metrics: InterviewStreamMetrics) => void;
}
export class ChatTransportError extends Error { code: string; status: number }
export function createChatTransport(options?: { fetchImpl?: typeof fetch }): {
  loadSession(id: string): Promise<unknown>;
  saveAnswer(
    sessionId: string, questionId: string, content: string,
    meta?: { inputMode?: 'text' | 'voice'; durationSeconds?: number | null },
  ): Promise<string>;
  endSession(id: string): Promise<void>;
  requestNext(sessionId: string, afterAnswerId: string | null, options?: ChatStreamOptions): Promise<NextResponse>;
};
