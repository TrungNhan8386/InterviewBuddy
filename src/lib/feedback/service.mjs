import { AiLimitError } from '../ai/daily-limit.mjs';
import { FeedbackError, validateFeedback, validateFeedbackContext, validateFeedbackRequest } from './contract.mjs';
import { FEEDBACK_PROMPT_VERSION } from './provider.mjs';

export function createFeedbackService({ repository, provider, consume, timeoutMs = 10000 }) {
  return {
    async read(body) { return repository.read(validateFeedbackRequest(body).answerId); },
    async evaluate(body, { signal, trace = () => {} } = {}) {
      const { answerId } = validateFeedbackRequest(body);
      if (signal?.aborted) throw new FeedbackError('REQUEST_CANCELLED', 408);
      const claim = await repository.claim(answerId);
      if (claim.kind === 'ready') return claim.response;
      if (claim.kind === 'busy') throw new FeedbackError('GENERATION_IN_PROGRESS', 409);
      if (claim.kind !== 'claimed' || !claim.token) throw new FeedbackError('SERVER_ERROR', 500);
      let release = true;
      try {
        if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 45000) throw new FeedbackError('AI_CONFIGURATION_ERROR', 503);
        const timeout = AbortSignal.timeout(timeoutMs);
        const lifetime = signal ? AbortSignal.any([signal, timeout]) : timeout;
        const context = validateFeedbackContext(claim.context);
        let feedback; let repairReason;
        for (let attempt = 0; attempt < 2; attempt++) {
          if (lifetime.aborted) throw new FeedbackError(timeout.aborted ? 'AI_TIMEOUT' : 'REQUEST_CANCELLED', timeout.aborted ? 504 : 408);
          try {
            await consume();
          } catch (error) {
            if (error instanceof AiLimitError) throw new FeedbackError(error.code, error.code === 'AI_DAILY_LIMIT' ? 429 : error.code === 'DATABASE_NOT_READY' ? 503 : 500);
            throw error;
          }
          try {
            feedback = validateFeedback(await provider.generate(context, { signal: lifetime, repairReason }), context);
            trace('validated', attempt + 1); break;
          } catch (error) {
            const code = error instanceof FeedbackError ? error.code : 'SERVER_ERROR';
            trace('attempt_failed', attempt + 1, code);
            if (attempt !== 0 || lifetime.aborted || !['INVALID_OUTPUT', 'AI_UNAVAILABLE'].includes(code)) throw error;
            repairReason = code;
          }
        }
        if (lifetime.aborted) throw new FeedbackError(timeout.aborted ? 'AI_TIMEOUT' : 'REQUEST_CANCELLED', timeout.aborted ? 504 : 408);
        // A lost DB acknowledgement may hide a successful commit. Replay first;
        // never release the reservation and immediately bill a second generation.
        release = false;
        return await repository.finish(answerId, claim.token, feedback, {
          model: provider.model, promptVersion: FEEDBACK_PROMPT_VERSION,
        });
      } finally {
        if (release) await repository.release(answerId, claim.token).catch(() => {});
      }
    },
  };
}
