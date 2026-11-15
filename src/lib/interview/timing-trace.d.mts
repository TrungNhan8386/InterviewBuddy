export type TimingStage = 'request_started' | 'authenticated' | 'body_parsed' | 'claimed' | 'context_ready'
  | 'upstream_started' | 'upstream_headers' | 'upstream_first_frame' | 'upstream_first_text' | 'upstream_validated'
  | 'decision_validated' | 'persistence_started' | 'persisted' | 'replay' | 'end' | 'complete' | 'failed' | 'cancelled';
export interface InterviewTimingEvent { requestId: string; stage: TimingStage; elapsedMs: number; code: string | null }
export type TimingMark = (stage: TimingStage, code?: string) => void;
export function createTimingTrace(observe?: (event: InterviewTimingEvent) => void): TimingMark;
