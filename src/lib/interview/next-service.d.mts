import type { InterviewDecision, InterviewerInput } from './interviewer-contract.mjs';
import type { TimingMark } from './timing-trace.mjs';
export interface NextRequest { sessionId: string; afterAnswerId: string | null }
export interface NextResponse {
  sessionId: string; action: 'follow_up' | 'next_topic' | 'end';
  question: null | { id: string; content: string; topic: string; kind: 'main' | 'follow_up'; position: number };
}
export interface NextRepository {
  claim(request: NextRequest): Promise<Record<string, unknown>>;
  finish(request: NextRequest, token: string, decision: InterviewDecision, metadata: Record<string, string>): Promise<NextResponse>;
  release(request: NextRequest, token: string): Promise<unknown>;
}
export type NextStreamEvent =
  | { event: 'ready'; data: { sessionId: string } }
  | { event: 'delta'; data: { text: string } }
  | { event: 'complete'; data: NextResponse };
export interface NextService {
  (body: unknown, options?: { signal?: AbortSignal; trace?: TimingMark }): Promise<NextResponse>;
  stream(body: unknown, options?: { signal?: AbortSignal; trace?: TimingMark }): AsyncGenerator<NextStreamEvent, void>;
}
export function validateNextRequest(body: unknown): NextRequest;
export function createNextService(options: {
  repository: NextRepository;
  provider: { model: string; next(input: InterviewerInput, options?: { signal?: AbortSignal; trace?: TimingMark }): Promise<InterviewDecision>;
    stream?(input: InterviewerInput, options?: { signal?: AbortSignal; trace?: TimingMark }): AsyncGenerator<{ type: 'delta'; text: string } | { type: 'decision'; value: InterviewDecision }, void> };
  now?: () => number;
  generationBudgetMs?: number;
}): NextService;
