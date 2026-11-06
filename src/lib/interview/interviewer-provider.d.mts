import type { InterviewDecision, InterviewerInput } from './interviewer-contract.mjs';
import type { TimingMark } from './timing-trace.mjs';

/** Import only from server-side code. */
export function createInterviewerProvider(options?: {
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
}): {
  model: string;
  stream(input: InterviewerInput, options?: { signal?: AbortSignal; trace?: TimingMark }): AsyncGenerator<
    { type: 'delta'; text: string } | { type: 'decision'; value: InterviewDecision }, void>;
  next(input: InterviewerInput, options?: { signal?: AbortSignal; trace?: TimingMark }): Promise<InterviewDecision>;
};
