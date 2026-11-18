import { InterviewerError } from './interviewer-contract.mjs';
import { encodeSseEvent } from './stream-protocol.mjs';
import { createTimingTrace } from './timing-trace.mjs';

const headers = { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' };
function safeError(error) {
  return { error: {
    code: error instanceof InterviewerError ? error.code : 'SERVER_ERROR',
    message: error instanceof InterviewerError ? error.message : 'Could not generate the interview question. Please try again.',
  } };
}
function acceptsStream(request) {
  return (request.headers.get('accept') ?? '').split(',').some((part) => {
    const [type, ...parameters] = part.trim().toLowerCase().split(';');
    const quality = parameters.find((value) => value.trim().startsWith('q='));
    return type.trim() === 'text/event-stream' && (!quality || Number(quality.trim().slice(2)) > 0);
  });
}
async function streamingResponse(service, body, request, trace) {
  const lifetime = new AbortController();
  let iterator; let cancelled = false; let finished = false;
  const abort = () => { trace('cancelled', 'REQUEST_CANCELLED'); lifetime.abort(); iterator?.return().catch(() => {}); };
  request.signal.addEventListener('abort', abort, { once: true });
  const cleanup = () => request.signal.removeEventListener('abort', abort);
  let first;
  try {
    if (request.signal.aborted) lifetime.abort();
    iterator = service.stream(body, { signal: lifetime.signal, trace });
    first = await iterator.next(); // Authenticate/validate/claim before HTTP 200.
  } catch (error) { cleanup(); await iterator?.return().catch(() => {}); throw error; }
  const stream = new ReadableStream({
    async pull(controller) {
      try {
        const item = first ?? await iterator.next(); first = null;
        if (cancelled) return;
        if (item.done) { finished = true; controller.close(); cleanup(); return; }
        controller.enqueue(encodeSseEvent(item.value.event, item.value.data));
        if (item.value.event === 'complete') {
          trace('complete');
          finished = true; controller.close(); cleanup(); await iterator.return();
        }
      } catch (error) {
        trace('failed', error instanceof InterviewerError ? error.code : 'SERVER_ERROR', error?.validationReason);
        if (!cancelled) { controller.enqueue(encodeSseEvent('error', safeError(error))); controller.close(); }
        finished = true; cleanup();
      }
    },
    async cancel() {
      cancelled = true;
      trace('cancelled', 'REQUEST_CANCELLED');
      if (!finished) lifetime.abort();
      cleanup(); await iterator.return().catch(() => {});
    },
  });
  return new Response(stream, { headers: {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-store, no-transform', 'X-Accel-Buffering': 'no',
  } });
}
export function createNextHandler({ authenticate, makeService, observeTiming }) {
  return async function POST(request) {
    const trace = createTimingTrace(observeTiming);
    trace('request_started');
    try {
      const auth = await authenticate(request);
      if (!auth) throw new InterviewerError('UNAUTHORIZED', 'Please sign in first.', 401);
      trace('authenticated');
      const mediaType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
      if (mediaType !== 'application/json') {
        throw new InterviewerError('BAD_INPUT', 'Use Content-Type: application/json.', 400);
      }
      // Bounded streaming read: forged Content-Length cannot bypass the limit.
      const reader = request.body?.getReader();
      if (!reader) throw new InterviewerError('BAD_INPUT', 'Request body is required.', 400);
      const chunks = []; let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 2048) { await reader.cancel(); throw new InterviewerError('BAD_INPUT', 'Request body is too large.', 400); }
          chunks.push(value);
        }
      } finally { reader.releaseLock(); }
      let body;
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch { throw new InterviewerError('BAD_INPUT', 'Request body must be valid JSON.', 400); }
      trace('body_parsed');
      const service = makeService(auth);
      if (acceptsStream(request)) return await streamingResponse(service, body, request, trace);
      const result = await service(body, { signal: request.signal, trace });
      trace('complete');
      return Response.json(result, { headers });
    } catch (error) {
      trace('failed', error instanceof InterviewerError ? error.code : 'SERVER_ERROR', error?.validationReason);
      const known = error instanceof InterviewerError;
      return Response.json(safeError(error), { status: known ? error.status : 500, headers: {
        ...headers, ...(known && error.code === 'GENERATION_IN_PROGRESS' ? { 'Retry-After': '2' } : {}),
      } });
    }
  };
}
