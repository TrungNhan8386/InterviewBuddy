import { InterviewStreamError, requestInterviewNext } from '../interview/next-stream-client.mjs';
import { isUuid } from '../interview/session-contract.mjs';

export class ChatTransportError extends Error {
  constructor(code, status = 0) { super(code); this.code = code; this.status = status; }
}

/** Browser transport: user cookies/RLS are enforced by the existing API routes. */
export function createChatTransport({ fetchImpl = globalThis.fetch } = {}) {
  async function json(url, init) {
    let response;
    try { response = await fetchImpl(url, { ...init, cache: 'no-store' }); }
    catch { throw new ChatTransportError('NETWORK_ERROR'); }
    const body = await response.json().catch(() => null);
    if (!response.ok || !body || body.error) {
      const code = typeof body?.error?.code === 'string' && /^[A-Z_]{1,64}$/u.test(body.error.code) ? body.error.code : 'SERVER_ERROR';
      throw new ChatTransportError(code, response.status);
    }
    return body;
  }
  const path = (id) => `/api/interview/${encodeURIComponent(id)}`;
  return {
    async loadSession(id) {
      const value = await json(path(id));
      if (value.id !== id || !['in_progress', 'completed', 'abandoned'].includes(value.status)
        || !value.settings || !Array.isArray(value.turns)) throw new ChatTransportError('INVALID_OUTPUT');
      return value;
    },
    /** meta (UC-07): { inputMode: 'text' | 'voice', durationSeconds: speaking time of a voice answer or null }. */
    async saveAnswer(sessionId, questionId, content, meta = {}) {
      const inputMode = meta.inputMode === 'voice' ? 'voice' : 'text';
      const body = { questionId, content, inputMode };
      if (Number.isFinite(meta.durationSeconds) && meta.durationSeconds > 0) body.durationSeconds = meta.durationSeconds;
      const value = await json(path(sessionId) + '/answers', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body) });
      if (!isUuid(value.answer?.id)) throw new ChatTransportError('SAVE_FAILED');
      return value.answer.id;
    },
    async endSession(id) { await json(path(id) + '/end', { method: 'POST' }); },
    async requestNext(sessionId, afterAnswerId, options) {
      try { return await requestInterviewNext({ sessionId, afterAnswerId }, { ...options, fetchImpl }); }
      catch (error) { throw new ChatTransportError(error instanceof InterviewStreamError ? error.code : 'SERVER_ERROR'); }
    },
  };
}
