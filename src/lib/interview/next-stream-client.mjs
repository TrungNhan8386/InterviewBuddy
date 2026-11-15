import { isUuid } from './session-contract.mjs';
import { readSseEvents } from './stream-protocol.mjs';

export class InterviewStreamError extends Error {
  constructor(code, message) { super(message); this.name = 'InterviewStreamError'; this.code = code; }
}
const invalid = () => new InterviewStreamError('INVALID_STREAM', 'The interview stream was invalid. Please try again.');
function object(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && keys.length === Object.keys(value).length && keys.every((key) => Object.hasOwn(value, key));
}
function text(value, max) { return typeof value === 'string' && value.trim().length > 0 && value.length <= max; }
function publicResult(value, sessionId) {
  if (!object(value, ['sessionId', 'action', 'question']) || value.sessionId !== sessionId) throw invalid();
  if (value.action === 'end') { if (value.question !== null) throw invalid(); return value; }
  const q = value.question;
  if (!['next_topic', 'follow_up'].includes(value.action) || !object(q, ['id', 'content', 'topic', 'kind', 'position'])
      || !isUuid(q.id) || !text(q.content, 1200) || !text(q.topic, 160)
      || q.kind !== (value.action === 'follow_up' ? 'follow_up' : 'main')
      || !Number.isInteger(q.position) || q.position < 1 || q.position > 48) throw invalid();
  return value;
}
function serverError(value) {
  const error = value?.error;
  if (!object(value, ['error']) || !object(error, ['code', 'message'])
      || !/^[A-Z_]{1,64}$/u.test(error.code) || !text(error.message, 1000)) throw invalid();
  return new InterviewStreamError(error.code, error.message);
}

/** Browser-safe consumer. onPreview is provisional; only the resolved result is saved/validated. */
export async function requestInterviewNext(body, {
  signal, onPreview, onStatus, onMetrics, timeoutMs = 35000, fetchImpl = globalThis.fetch,
} = {}) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 60000) {
    throw new InterviewStreamError('INVALID_CONFIGURATION', 'Use a browser deadline between 1000 and 60000 ms.');
  }
  let preview = ''; let response; let ready = false;
  let firstDeltaMs = null; let expired = false;
  const start = performance.now();
  const elapsed = () => Math.max(0, performance.now() - start);
  // Observability must never change the result or expose answer/document data.
  const notify = (callback, value) => { try { callback?.(value); } catch { /* Noncritical observer. */ } };
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  const timers = [
    setTimeout(() => notify(onStatus, 'slow'), 5000),
    setTimeout(() => notify(onStatus, 'extended'), 10000),
    setTimeout(() => { expired = true; controller.abort(); }, timeoutMs),
  ];
  const cancelError = () => new InterviewStreamError(expired ? 'RESPONSE_TIMEOUT' : 'REQUEST_CANCELLED',
    expired ? 'The service took too long. Retry the same turn to recover any saved question.' : 'The interview request was cancelled.');
  let rejectOnAbort = () => {};
  const show = (value) => { preview = value; onPreview?.(value); };
  try {
    show(''); notify(onStatus, 'generating');
    if (signal?.aborted || controller.signal.aborted) throw cancelError();
    const interrupted = new Promise((resolve, reject) => { rejectOnAbort = () => reject(cancelError()); });
    controller.signal.addEventListener('abort', rejectOnAbort, { once: true });
    response = await Promise.race([fetchImpl('/api/interview/next', { method: 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' }, body: JSON.stringify(body) }), interrupted]);
    if (!response.ok) throw serverError(await response.json());
    if (response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() !== 'text/event-stream') throw invalid();
    for await (const frame of readSseEvents(response.body, { signal: controller.signal })) {
      const data = JSON.parse(frame.data);
      if (frame.event === 'ready') {
        if (ready || !object(data, ['sessionId']) || data.sessionId !== body.sessionId) throw invalid();
        ready = true;
      } else if (frame.event === 'delta') {
        if (!ready || !object(data, ['text']) || typeof data.text !== 'string' || !data.text.length || preview.length + data.text.length > 1200) throw invalid();
        if (firstDeltaMs === null && /[\p{L}\p{N}]/u.test(preview + data.text)) firstDeltaMs = elapsed();
        show(preview + data.text);
      } else if (frame.event === 'complete') {
        const result = publicResult(data, body.sessionId);
        show(result.question?.content ?? '');
        notify(onStatus, 'complete');
        notify(onMetrics, { firstDeltaMs, elapsedMs: elapsed(), outcome: 'complete', code: null });
        return result;
      } else if (frame.event === 'error') throw serverError(data);
      else throw invalid();
    }
    throw new InterviewStreamError('INCOMPLETE_STREAM', 'The interview stream ended before a saved result arrived. Please retry the same turn.');
  } catch (error) {
    show('');
    const failure = controller.signal.aborted ? cancelError() : error instanceof InterviewStreamError ? error
      : !response || error instanceof TypeError ? new InterviewStreamError('NETWORK_ERROR', 'The connection to the interview service was interrupted.') : invalid();
    notify(onStatus, failure.code === 'REQUEST_CANCELLED' ? 'cancelled' : 'error');
    notify(onMetrics, { firstDeltaMs, elapsedMs: elapsed(),
      outcome: failure.code === 'REQUEST_CANCELLED' ? 'cancelled' : failure.code === 'RESPONSE_TIMEOUT' ? 'timeout' : 'error', code: failure.code });
    throw failure;
  } finally {
    timers.forEach(clearTimeout);
    signal?.removeEventListener('abort', cancel);
    controller.signal.removeEventListener('abort', rejectOnAbort);
  }
}
