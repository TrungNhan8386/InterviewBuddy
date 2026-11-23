import type { InterviewDecision, InterviewerInput } from './interviewer-contract.mjs';
import type { TimingMark } from './timing-trace.mjs';
export interface QuestionRepair { reason: 'EXACT_DUPLICATE' | 'NEAR_DUPLICATE' | 'INVALID_ACTION' | 'NON_QUESTION'; rejectedQuestion: string | null; rejectedAction?: 'end' | 'follow_up' | 'next_topic' }
export interface GenerationOptions { signal?: AbortSignal; trace?: TimingMark; repair?: QuestionRepair }

/** Import only from server-side code. */
export function createInterviewerProvider(options?: {
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
}): {
  model: string;
  stream(input: InterviewerInput, options?: GenerationOptions): AsyncGenerator<
    { type: 'delta'; text: string } | { type: 'decision'; value: InterviewDecision }, void>;
  next(input: InterviewerInput, options?: GenerationOptions): Promise<InterviewDecision>;
};
