import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDatabase } from './interview-next-db.mjs';
import { createNextService } from '../lib/interview/next-service.mjs';
import { createNextHandler } from '../lib/interview/next-http.mjs';
import { createInterviewerProvider } from '../lib/interview/interviewer-provider.mjs';
import { readSseEvents } from '../lib/interview/stream-protocol.mjs';

let store;
before(async () => { store = await createTestDatabase(); });
after(async () => { await store?.db.close(); });
const encoder = new TextEncoder();
const decision = { action: 'next_topic', question: 'Bạn sẽ kiểm thử lỗi API như thế nào?', topic: 'Kiểm thử API', reason: 'PRIVATE_REASON' };
const frame = (text, finishReason) => encoder.encode('data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text }] }, ...(finishReason ? { finishReason } : {}) }] }) + '\n\n');
const request = (sessionId, signal) => new Request('http://localhost/api/interview/next', { method: 'POST',
  headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' }, body: JSON.stringify({ sessionId, afterAnswerId: null }), signal });
function ai(fetchImpl) { return createInterviewerProvider({ env: { GEMINI_API_KEY: 'offline-only', GEMINI_MODEL: 'offline' }, fetchImpl }); }
function handler(provider, repository = store.repository) {
  const service = createNextService({ provider, repository });
  assert.equal(typeof service.stream, 'function', 'The API service must expose a cancellable stream');
  return createNextHandler({ authenticate: async () => ({}), makeService: () => service });
}
const response = (value = decision) => new Response(new ReadableStream({ start(controller) {
  controller.enqueue(frame(JSON.stringify(value), 'STOP')); controller.close();
} }), { headers: { 'Content-Type': 'text/event-stream' } });
async function events(result) {
  assert.match(result.headers.get('content-type'), /^text\/event-stream/u, 'Accept negotiation must enable streaming');
  const values = []; for await (const value of readSseEvents(result.body)) values.push({ event: value.event, data: JSON.parse(value.data) }); return values;
}

test('HTTP delivers draft text before final generation and commits only after complete validation', async () => {
  const sessionId = await store.session(); let finish;
  const upstream = new Response(new ReadableStream({ start(controller) {
    controller.enqueue(frame('{"action":"next_topic","question":"Bạn sẽ kiểm thử '));
    finish = () => { controller.enqueue(frame('lỗi API như thế nào?","topic":"Kiểm thử API","reason":"PRIVATE_REASON"}', 'STOP')); controller.close(); };
  } }), { headers: { 'Content-Type': 'text/event-stream' } });
  const next = handler(ai(async () => upstream));
  const result = await next(request(sessionId));
  assert.match(result.headers.get('content-type'), /^text\/event-stream/u, 'Accept negotiation must enable streaming');
  const iterator = readSseEvents(result.body);
  assert.equal((await iterator.next()).value.event, 'ready');
  const delta = await iterator.next();
  assert.deepEqual(JSON.parse(delta.value.data), { text: 'Bạn sẽ kiểm thử ' });
  const pending = await store.db.query('select count(*)::int as n from public.questions where session_id=$1', [sessionId]);
  assert.equal(pending.rows[0].n, 0);
  finish();
  const rest = []; for await (const item of iterator) rest.push(item);
  assert.equal(rest.at(-1).event, 'complete');
  const complete = JSON.parse(rest.at(-1).data);
  assert.equal(complete.question.content, decision.question);
  assert.equal(JSON.stringify(rest).includes('PRIVATE_REASON'), false);
  assert.equal((await store.db.query('select count(*)::int as n from public.questions where session_id=$1', [sessionId])).rows[0].n, 1);
});

test('stream replay returns the saved question once and makes no extra upstream request', async () => {
  const sessionId = await store.session(); let calls = 0;
  const next = handler(ai(async () => { calls++; return response(); }));
  const first = await events(await next(request(sessionId)));
  const second = await events(await next(request(sessionId)));
  assert.equal(calls, 1);
  assert.deepEqual(second, [{ event: 'complete', data: first.at(-1).data }]);
});

test('invalid final structured data produces a stream error and releases the reservation without saving', async () => {
  const sessionId = await store.session();
  const bad = await events(await handler(ai(async () => response({ ...decision, score: 100 })))(request(sessionId)));
  assert.ok(bad.some((item) => item.event === 'delta'));
  assert.equal(bad.at(-1).event, 'error');
  assert.equal(bad.at(-1).data.error.code, 'INVALID_OUTPUT');
  assert.equal((await store.db.query('select count(*)::int as n from public.questions where session_id=$1', [sessionId])).rows[0].n, 0);
  const retried = await events(await handler(ai(async () => response()))(request(sessionId)));
  assert.equal(retried.at(-1).event, 'complete');
});

test('authentication and busy errors preserve HTTP status before stream headers are sent', async () => {
  const sessionId = await store.session();
  const unauthorized = createNextHandler({ authenticate: async () => null, makeService: () => assert.fail() });
  assert.equal((await unauthorized(request(sessionId))).status, 401);
  const claim = await store.repository.claim({ sessionId, afterAnswerId: null });
  try {
    const busy = await handler(ai(() => assert.fail('Busy must not call Gemini')))(request(sessionId));
    assert.equal(busy.status, 409);
    assert.equal(busy.headers.get('retry-after'), '2');
    assert.match(busy.headers.get('content-type'), /^application\/json/u);
  } finally { await store.repository.release({ sessionId, afterAnswerId: null }, claim.token); }
});

test('browser cancellation stops the upstream reader and releases the in-flight turn', async () => {
  const sessionId = await store.session(); let cancelled = false;
  const upstream = new Response(new ReadableStream({
    start(controller) { controller.enqueue(frame('{"question":"Bạn ')); }, cancel() { cancelled = true; },
  }), { headers: { 'Content-Type': 'text/event-stream' } });
  const result = await handler(ai(async () => upstream))(request(sessionId));
  assert.match(result.headers.get('content-type'), /^text\/event-stream/u, 'Accept negotiation must enable streaming');
  const reader = result.body.getReader();
  await reader.read(); await reader.read(); await reader.cancel();
  assert.equal(cancelled, true);
  assert.equal((await store.repository.claim({ sessionId, afterAnswerId: null })).kind, 'claimed');
});

test('closed session streams a completed end result without a provider call', async () => {
  const sessionId = await store.session();
  await store.db.query("update public.interview_sessions set status='abandoned' where id=$1", [sessionId]);
  const result = await events(await handler(ai(() => assert.fail('Closed session must not call Gemini')))(request(sessionId)));
  assert.deepEqual(result, [{ event: 'complete', data: { sessionId, action: 'end', question: null } }]);
});

test('time expiring after preview yields end without persisting the draft question', async () => {
  const sessionId = await store.session();
  const result = await events(await handler(ai(async () => {
    await store.db.query("update public.interview_sessions set started_at=now()-interval '16 minutes' where id=$1", [sessionId]);
    return response();
  }))(request(sessionId)));
  assert.equal(result.at(-1).data.action, 'end');
  assert.equal(result.at(-1).data.question, null);
  assert.equal((await store.db.query('select count(*)::int as n from public.questions where session_id=$1', [sessionId])).rows[0].n, 0);
});

test('lost persistence acknowledgement reports an error and replay recovers without generating twice', async () => {
  const sessionId = await store.session(); let calls = 0;
  const repository = { ...store.repository, finish: async (...args) => { await store.repository.finish(...args); throw new Error('PRIVATE_ACK_FAILURE'); } };
  const next = handler(ai(async () => { calls++; return response(); }), repository);
  const first = await events(await next(request(sessionId)));
  assert.equal(first.at(-1).data.error.code, 'SERVER_ERROR');
  assert.equal(JSON.stringify(first).includes('PRIVATE_ACK_FAILURE'), false);
  const replay = await events(await next(request(sessionId)));
  assert.equal(replay.at(-1).event, 'complete');
  assert.equal(calls, 1);
});
