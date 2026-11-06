import { randomUUID } from 'node:crypto';

const stages = new Set(['request_started', 'authenticated', 'body_parsed', 'claimed', 'context_ready',
  'upstream_started', 'upstream_headers', 'upstream_first_frame', 'upstream_first_text', 'upstream_validated',
  'decision_validated', 'persistence_started', 'persisted', 'replay', 'end', 'complete', 'failed', 'cancelled']);
const codes = new Set(['UNAUTHORIZED', 'DATABASE_NOT_READY', 'BAD_INPUT', 'NOT_FOUND', 'SESSION_CONTEXT_INVALID',
  'GENERATION_IN_PROGRESS', 'AI_NOT_CONFIGURED', 'AI_CONFIGURATION_ERROR', 'AI_RATE_LIMITED', 'AI_UNAVAILABLE',
  'AI_TIMEOUT', 'AI_CONTENT_BLOCKED', 'AI_DAILY_LIMIT', 'INVALID_OUTPUT', 'STALE_TURN', 'LEASE_LOST', 'REQUEST_CANCELLED', 'SERVER_ERROR']);

/** Server-only, opt-in, numeric spans. Never accept documents, identities or provider bodies. */
export function createTimingTrace(observe) {
  if (typeof observe !== 'function') return () => {};
  const requestId = randomUUID(); const start = performance.now();
  let terminal = false;
  return (stage, code = null) => {
    if (terminal || !stages.has(stage)) return;
    terminal = ['complete', 'failed', 'cancelled'].includes(stage);
    const event = { requestId, stage, elapsedMs: Math.max(0, performance.now() - start),
      code: code === null ? null : codes.has(code) ? code : 'SERVER_ERROR' };
    try { observe(event); } catch { /* Diagnostics must not affect the turn. */ }
  };
}
