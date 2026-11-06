import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDatabase } from './interview-next-db.mjs';
import { createNextHandler } from '../lib/interview/next-http.mjs';
import { createNextService } from '../lib/interview/next-service.mjs';
import { createInterviewerProvider } from '../lib/interview/interviewer-provider.mjs';
import { readSseEvents } from '../lib/interview/stream-protocol.mjs';

let store;
before(async () => { store = await createTestDatabase(); });
after(async () => { await store?.db.close(); });
const encoder = new TextEncoder();
const question = { action: 'next_topic', question: 'Bạn sẽ kiểm thử lỗi API như thế nào?', topic: 'Kiểm thử API', reason: 'PRIVATE_REASON' };
function request(sessionId, signal) {
  return new Request('http://localhost/api/interview/next', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ sessionId, afterAnswerId: null }), signal });
}
function handler(observeTiming, value = question, stalled = false) {
  const provider = createInterviewerProvider({ env: { GEMINI_API_KEY: 'PRIVATE_KEY', GEMINI_MODEL: 'offline' },
    fetchImpl: async () => new Response(new ReadableStream({ start(controller) {
      controller.enqueue(encoder.encode('data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text: stalled ? '{"question":"Bạn ' : JSON.stringify(value) }] },
        ...(stalled ? {} : { finishReason: 'STOP' }) }] }) + '\n\n'));
      if (!stalled) controller.close();
    } }), { headers: { 'Content-Type': 'text/event-stream' } }) });
  return createNextHandler({ authenticate: async () => ({}), observeTiming,
    makeService: () => createNextService({ repository: store.repository, provider }) });
}
async function events(response) { const list = []; for await (const event of readSseEvents(response.body)) list.push(event); return list; }

test('request timing spans the real provider and saved result while replay is identified separately', async () => {
  const sessionId = await store.session(); const timings = [];
  const next = handler((event) => timings.push(event));
  const result = await events(await next(request(sessionId)));
  assert.equal(result.at(-1).event, 'complete');
  const stages = timings.map((item) => item.stage);
  const expected = ['request_started', 'authenticated', 'body_parsed', 'claimed', 'context_ready', 'upstream_started',
    'upstream_headers', 'upstream_first_frame', 'upstream_first_text', 'upstream_validated', 'decision_validated', 'persistence_started', 'persisted', 'complete'];
  assert.deepEqual(stages, expected, 'Each phase needs its own timestamp; complete must follow persistence');
  assert.equal(new Set(timings.map((item) => item.requestId)).size, 1);
  for (let index = 0; index < timings.length; index++) {
    assert.deepEqual(Object.keys(timings[index]).sort(), ['code', 'elapsedMs', 'requestId', 'stage']);
    assert.ok(Number.isFinite(timings[index].elapsedMs) && timings[index].elapsedMs >= (timings[index - 1]?.elapsedMs ?? 0));
    assert.equal(timings[index].code, null);
  }
  const firstId = timings[0].requestId; timings.length = 0;
  await events(await next(request(sessionId)));
  assert.deepEqual(timings.map((item) => item.stage), ['request_started', 'authenticated', 'body_parsed', 'claimed', 'replay', 'complete']);
  assert.notEqual(timings[0].requestId, firstId);
  assert.equal(JSON.stringify(timings).includes(sessionId), false);
  assert.equal(JSON.stringify(timings).includes('PRIVATE'), false);
});

test('invalid output records a safe failure rather than a saved completion', async () => {
  const sessionId = await store.session(); const timings = [];
  const values = await events(await handler((event) => timings.push(event), { ...question, score: 100 })(request(sessionId)));
  assert.equal(values.at(-1).event, 'error');
  assert.ok(timings.length, 'A failed generation must have diagnostics too');
  assert.equal(timings.at(-1).stage, 'failed'); assert.equal(timings.at(-1).code, 'INVALID_OUTPUT');
  assert.equal(timings.some((item) => ['persisted', 'complete'].includes(item.stage)), false);
  assert.equal(JSON.stringify(timings).includes('PRIVATE'), false);
});

test('a failed timing observer cannot prevent persistence or change the public response', async () => {
  const sessionId = await store.session(); let observed = false;
  const values = await events(await handler(() => { observed = true; throw new Error('Observer unavailable'); })(request(sessionId)));
  assert.equal(observed, true);
  assert.equal(values.at(-1).event, 'complete');
  assert.equal(JSON.parse(values.at(-1).data).question.content, question.question);
});

test('request abort records cancellation even before the response consumer cancels its reader', async () => {
  const sessionId = await store.session(); const abort = new AbortController(); const timings = [];
  const response = await handler((event) => timings.push(event), question, true)(request(sessionId, abort.signal));
  const reader = response.body.getReader();
  try {
    await reader.read(); await reader.read(); abort.abort();
    assert.equal(timings.at(-1).stage, 'cancelled');
    assert.equal(timings.at(-1).code, 'REQUEST_CANCELLED');
  } finally { await reader.cancel(); }
});
