import { DEFAULT_MODEL } from '../analysis/gemini.mjs';
import { createEndDecision, InterviewerError, validateInterviewerInput, validateInterviewerOutput } from './interviewer-contract.mjs';
import { buildInterviewerRequest } from './interviewer-prompt.mjs';
import { readSseEvents, questionTextPrefix, StreamProtocolError } from './stream-protocol.mjs';
import { providerLimitMessage } from '../ai/provider-limit.mjs';

/** Server / Node only: keep this provider out of client components. No DB writes or automatic retries. */
export function createInterviewerProvider({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const model = env.GEMINI_INTERVIEW_MODEL?.trim() || env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  return {
    model,
    async *stream(value, { signal, trace = () => {} } = {}) {
      const input = validateInterviewerInput(value);
      if (signal?.aborted) throw new InterviewerError('REQUEST_CANCELLED', 'The request was cancelled.', 408);
      const ending = createEndDecision(input);
      if (ending) { yield { type: 'decision', value: validateInterviewerOutput(ending, input) }; return; }
      const apiKey = env.GEMINI_API_KEY?.trim();
      if (!apiKey) throw new InterviewerError('AI_NOT_CONFIGURED', 'Gemini is not configured on the server.', 503);
      const timeoutMs = Number(env.GEMINI_TIMEOUT_MS || 30000);
      if (!/^[a-zA-Z0-9._-]{1,100}$/.test(model) || !Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 45000) {
        throw new InterviewerError('AI_CONFIGURATION_ERROR', 'Invalid server Gemini configuration.', 503);
      }
      const lifetime = new AbortController();
      const timeout = AbortSignal.timeout(timeoutMs);
      const combined = AbortSignal.any([lifetime.signal, timeout, ...(signal ? [signal] : [])]);
      let output = ''; let preview = ''; let stopped = false; let firstFrame = true; let firstText = true;
      try {
        const payload = JSON.stringify(buildInterviewerRequest(input, { contextMode: env.GEMINI_INTERVIEW_CONTEXT_MODE }));
        trace('upstream_started');
        const response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`, {
          method: 'POST', redirect: 'error', signal: combined,
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: payload,
        });
        trace('upstream_headers');
        if (!response.ok) {
          await response.body?.cancel();
          const code = response.status === 429 ? 'AI_RATE_LIMITED'
            : [400, 401, 403, 404].includes(response.status) ? 'AI_CONFIGURATION_ERROR' : 'AI_UNAVAILABLE';
          throw new InterviewerError(code, code === 'AI_RATE_LIMITED' ? providerLimitMessage('en') : 'Gemini could not complete the interview request.', code === 'AI_RATE_LIMITED' ? 429 : code === 'AI_CONFIGURATION_ERROR' ? 503 : 502);
        }
        if (response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() !== 'text/event-stream') {
          await response.body?.cancel();
          throw new InterviewerError('INVALID_OUTPUT', 'Gemini did not return a valid event stream.');
        }
        for await (const frame of readSseEvents(response.body, { signal: combined })) {
          if (firstFrame) { firstFrame = false; trace('upstream_first_frame'); }
          if (frame.data === '[DONE]') { if (!stopped) throw new SyntaxError('Incomplete generation.'); continue; }
          const envelope = JSON.parse(frame.data);
          if (envelope?.error) {
            const status = Number(envelope.error.code);
            const code = status === 429 ? 'AI_RATE_LIMITED'
              : [400, 401, 403, 404].includes(status) ? 'AI_CONFIGURATION_ERROR' : 'AI_UNAVAILABLE';
            throw new InterviewerError(code, code === 'AI_RATE_LIMITED' ? providerLimitMessage('en') : 'Gemini could not complete the interview request.', code === 'AI_RATE_LIMITED' ? 429 : code === 'AI_CONFIGURATION_ERROR' ? 503 : 502);
          }
          const candidate = envelope?.candidates?.[0];
          if (envelope?.promptFeedback?.blockReason || candidate?.finishReason === 'SAFETY') {
            throw new InterviewerError('AI_CONTENT_BLOCKED', 'The interview request was blocked by the provider.', 422);
          }
          if (!candidate) {
            if (envelope?.usageMetadata) continue;
            throw new SyntaxError('Invalid generation frame.');
          }
          const parts = candidate.content?.parts ?? [];
          if (!Array.isArray(parts) || parts.some((part) => !part || typeof part !== 'object')) throw new SyntaxError('Invalid content parts.');
          const text = parts.filter((part) => !part.thought && typeof part.text === 'string').map((part) => part.text).join('');
          if (stopped && text) throw new SyntaxError('Text after final response.');
          output += text;
          if (output.length > 12000) throw new SyntaxError('Generation too large.');
          const next = questionTextPrefix(output);
          if (next.length > 1200) throw new SyntaxError('Question too large.');
          if (!next.startsWith(preview)) throw new SyntaxError('Question prefix changed.');
          if (next.length > preview.length) {
            const delta = next.slice(preview.length); preview = next;
            if (firstText && /[\p{L}\p{N}]/u.test(preview)) { firstText = false; trace('upstream_first_text'); }
            yield { type: 'delta', text: delta };
          }
          if (candidate.finishReason) {
            if (candidate.finishReason !== 'STOP') throw new SyntaxError('Incomplete generation.');
            stopped = true;
            // STOP terminates this candidate. Release the upstream reader rather
            // than waiting for transport EOF; validate the complete JSON below.
            break;
          }
        }
        if (!stopped || !output) throw new SyntaxError('Incomplete generation.');
        const decision = validateInterviewerOutput(JSON.parse(output), input);
        trace('upstream_validated');
        yield { type: 'decision', value: decision };
      } catch (error) {
        if (error instanceof InterviewerError) throw error;
        if (signal?.aborted) throw new InterviewerError('REQUEST_CANCELLED', 'The request was cancelled.', 408);
        if (timeout.aborted) throw new InterviewerError('AI_TIMEOUT', 'The interview request timed out.', 504);
        if (error instanceof SyntaxError || error instanceof StreamProtocolError) {
          throw new InterviewerError('INVALID_OUTPUT', 'Gemini returned an invalid interview stream.');
        }
        throw new InterviewerError('AI_UNAVAILABLE', 'Gemini is temporarily unavailable.');
      } finally { lifetime.abort(); }
    },
    async next(value, { signal, trace = () => {} } = {}) {
      const input = validateInterviewerInput(value);
      if (signal?.aborted) throw new InterviewerError('REQUEST_CANCELLED', 'The request was cancelled.', 408);
      const ending = createEndDecision(input);
      if (ending) return validateInterviewerOutput(ending, input);
      const apiKey = env.GEMINI_API_KEY?.trim();
      if (!apiKey) throw new InterviewerError('AI_NOT_CONFIGURED', 'Gemini is not configured on the server.', 503);
      const timeoutMs = Number(env.GEMINI_TIMEOUT_MS || 30000);
      if (!/^[a-zA-Z0-9._-]{1,100}$/.test(model) || !Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 45000) {
        throw new InterviewerError('AI_CONFIGURATION_ERROR', 'Invalid server Gemini configuration.', 503);
      }
      const timeout = AbortSignal.timeout(timeoutMs);
      const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
      try {
        const payload = JSON.stringify(buildInterviewerRequest(input, { contextMode: env.GEMINI_INTERVIEW_CONTEXT_MODE }));
        trace('upstream_started');
        const response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: 'POST', redirect: 'error', signal: combined,
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: payload,
        });
        trace('upstream_headers');
        if (!response.ok) {
          // Provider bodies may echo inputs or credentials. Never log or forward them.
          await response.body?.cancel();
          const code = response.status === 429 ? 'AI_RATE_LIMITED'
            : [400, 401, 403, 404].includes(response.status) ? 'AI_CONFIGURATION_ERROR' : 'AI_UNAVAILABLE';
          throw new InterviewerError(code, code === 'AI_RATE_LIMITED' ? providerLimitMessage('en') : 'Gemini could not complete the interview request.', code === 'AI_RATE_LIMITED' ? 429 : code === 'AI_CONFIGURATION_ERROR' ? 503 : 502);
        }
        const envelope = await response.json();
        const candidate = envelope?.candidates?.[0];
        if (envelope?.promptFeedback?.blockReason || candidate?.finishReason === 'SAFETY') {
          throw new InterviewerError('AI_CONTENT_BLOCKED', 'The interview request was blocked by the provider.', 422);
        }
        if (candidate?.finishReason !== 'STOP' || !Array.isArray(candidate.content?.parts)) {
          throw new InterviewerError('INVALID_OUTPUT', 'Gemini returned an incomplete interview response.');
        }
        const output = candidate.content.parts.filter((part) => part && !part.thought && typeof part.text === 'string').map((part) => part.text).join('');
        if (!output || output.length > 12000) throw new InterviewerError('INVALID_OUTPUT', 'Gemini returned an invalid interview response.');
        const decision = validateInterviewerOutput(JSON.parse(output), input);
        trace('upstream_validated');
        return decision;
      } catch (error) {
        if (error instanceof InterviewerError) throw error;
        if (signal?.aborted) throw new InterviewerError('REQUEST_CANCELLED', 'The request was cancelled.', 408);
        if (timeout.aborted) throw new InterviewerError('AI_TIMEOUT', 'The interview request timed out.', 504);
        if (error instanceof SyntaxError) throw new InterviewerError('INVALID_OUTPUT', 'Gemini returned invalid JSON.');
        throw new InterviewerError('AI_UNAVAILABLE', 'Gemini is temporarily unavailable.');
      }
    },
  };
}
