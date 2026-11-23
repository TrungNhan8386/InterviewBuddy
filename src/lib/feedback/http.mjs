import { FeedbackError, validateFeedbackRequest } from './contract.mjs';

const errors = {
  BAD_INPUT: [400, 'Send only a valid answerId as JSON.'],
  UNAUTHORIZED: [401, 'Please sign in first.'],
  NOT_FOUND: [404, 'Saved answer not found.'],
  GENERATION_IN_PROGRESS: [409, 'Feedback is already being generated. Try again shortly.'],
  LEASE_LOST: [409, 'This evaluation is no longer current. Reload saved feedback.'],
  STALE_ANSWER: [409, 'The saved answer changed. Reload before evaluating again.'],
  SESSION_CONTEXT_INVALID: [409, 'The saved question or answer cannot be evaluated.'],
  FEEDBACK_FORMAT_UNSUPPORTED: [409, 'This saved feedback uses an older format. It has been preserved for review.'],
  AI_DAILY_LIMIT: [429, 'You have used all AI calls for today. The limit resets at 00:00 Vietnam time.'],
  AI_RATE_LIMITED: [429, 'The AI provider is rate limited. Wait before trying again.'],
  AI_CONTENT_BLOCKED: [422, 'The AI could not evaluate this content. Your answer is saved; you can continue without feedback.'],
  INVALID_OUTPUT: [502, 'AI feedback did not pass validation. Your answer is saved. Try again or continue without feedback.'],
  AI_UNAVAILABLE: [502, 'The AI service is temporarily unavailable. Your answer is saved.'],
  AI_TIMEOUT: [504, 'Feedback took too long. Your answer is saved. Try again or continue without feedback.'],
  AI_NOT_CONFIGURED: [503, 'The AI service is not configured.'],
  AI_CONFIGURATION_ERROR: [503, 'The AI service configuration needs attention.'],
  DATABASE_NOT_READY: [503, 'The answer feedback database migration is not ready.'],
  REQUEST_CANCELLED: [408, 'The request was cancelled.'],
  SERVER_ERROR: [500, 'Could not finish saving feedback. Reload saved feedback before trying again.'],
};
const headers = { 'Cache-Control': 'no-store' };
export function createFeedbackHandlers({ authenticate, makeService, observeTiming }) {
  async function handle(request, generate) {
    const start = performance.now();
    const trace = (stage, attempt, code) => {
      try { observeTiming?.({ stage, elapsedMs: Math.round(performance.now() - start),
        ...(Number.isInteger(attempt) ? { attempt } : {}), ...(Object.hasOwn(errors, code) ? { code } : {}) }); } catch { /* Telemetry must not change the result. */ }
    };
    try {
      const auth = await authenticate(request);
      if (!auth) throw new FeedbackError('UNAUTHORIZED');
      let body;
      if (generate) {
        if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new FeedbackError('BAD_INPUT');
        const reader = request.body?.getReader();
        if (!reader) throw new FeedbackError('BAD_INPUT');
        const chunks = []; let size = 0;
        try {
          while (true) {
            const { value, done } = await reader.read(); if (done) break;
            size += value.byteLength;
            if (size > 2048) { await reader.cancel(); throw new FeedbackError('BAD_INPUT'); }
            chunks.push(value);
          }
          const bytes = new Uint8Array(size); let offset = 0;
          for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
          body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
        } catch (error) {
          if (error instanceof FeedbackError) throw error;
          throw new FeedbackError('BAD_INPUT');
        } finally { reader.releaseLock(); }
      } else {
        const params = new URL(request.url).searchParams;
        if ([...params.keys()].length !== 1 || !params.has('answerId')) throw new FeedbackError('BAD_INPUT');
        body = { answerId: params.get('answerId') };
      }
      body = validateFeedbackRequest(body);
      const service = makeService(auth);
      const result = generate ? await service.evaluate(body, { signal: request.signal, trace }) : await service.read(body);
      trace('complete');
      return Response.json(result, { status: generate && result.alreadySaved === false ? 201 : 200, headers });
    } catch (error) {
      const code = error instanceof FeedbackError && Object.hasOwn(errors, error.code) ? error.code : 'SERVER_ERROR';
      trace('failed', undefined, code);
      return Response.json({ error: { code, message: errors[code][1] } }, { status: errors[code][0], headers });
    }
  }
  return { POST: request => handle(request, true), GET: request => handle(request, false) };
}
