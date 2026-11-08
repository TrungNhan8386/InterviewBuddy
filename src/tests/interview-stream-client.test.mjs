import test from 'node:test';
import assert from 'node:assert/strict';

const sessionId = '00000000-0000-4000-8000-000000000010';
const body = { sessionId, afterAnswerId: null };
const complete = { sessionId, action: 'next_topic', question: {
  id: '00000000-0000-4000-8000-000000000011', content: 'Bạn kiểm tra API thế nào?', topic: 'Kiểm thử', kind: 'main', position: 1,
} };
const encoder = new TextEncoder();
const ready = 'event: ready\ndata: {"sessionId":"00000000-0000-4000-8000-000000000010"}\n\n';
const delta = 'event: delta\ndata: {"text":"Bạn kiểm tra "}\n\n';
const final = 'event: complete\ndata: ' + JSON.stringify(complete) + '\n\n';
function response(text, width = 1) {
  const bytes = encoder.encode(text);
  return new Response(new ReadableStream({ start(controller) {
    for (let i = 0; i < bytes.length; i += width) controller.enqueue(bytes.slice(i, i + width));
    controller.close();
  } }), { headers: { 'Content-Type': 'text/event-stream' } });
}
async function api() {
  const consumer = await import('../lib/interview/next-stream-client.mjs').catch((error) => {
    if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
    throw error;
  });
  assert.equal(typeof consumer.requestInterviewNext, 'function', 'Browser consumer must parse and validate streamed interview responses');
  return consumer.requestInterviewNext;
}

test('a request cancelled before starting makes no fetch and leaves no rejected background promise', async () => {
  const request = await api(); const abort = new AbortController(); abort.abort();
  await assert.rejects(request(body, { signal: abort.signal, fetchImpl: () => assert.fail('Cancelled request must not reach the server') }),
    { code: 'REQUEST_CANCELLED' });
  await new Promise((resolve) => setImmediate(resolve));
});

test('slow and extended notices keep waiting for the same valid saved result and stop on completion', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const request = await api(); const statuses = []; const metrics = []; let finish; let received; let finished = false;
  const abort = new AbortController();
  const first = new Promise((resolve) => { received = resolve; });
  const wire = new Response(new ReadableStream({ start(controller) {
    controller.enqueue(encoder.encode(ready + delta));
    finish = () => { if (!finished) { finished = true; controller.enqueue(encoder.encode(final)); controller.close(); } };
  } }), { headers: { 'Content-Type': 'text/event-stream' } });
  const pending = request(body, { signal: abort.signal, fetchImpl: async () => wire,
    onPreview: (value) => { if (value) received(); },
    onStatus: (value) => statuses.push(value), onMetrics: (value) => metrics.push(value) });
  pending.catch(() => {});
  try {
  await first;
  assert.deepEqual(statuses, ['generating']);
  t.mock.timers.tick(5000); assert.deepEqual(statuses, ['generating', 'slow']);
  t.mock.timers.tick(5000); assert.deepEqual(statuses, ['generating', 'slow', 'extended']);
  assert.equal(metrics.length, 0, 'A slow notice must not complete or retry the turn');
  finish(); assert.deepEqual(await pending, complete);
  assert.equal(statuses.at(-1), 'complete');
  assert.equal(metrics.length, 1); assert.equal(metrics[0].outcome, 'complete');
  assert.ok(metrics[0].firstDeltaMs >= 0);
  const finishedCount = statuses.length;
  t.mock.timers.tick(60000); assert.equal(statuses.length, finishedCount);
  } finally { abort.abort(); await pending.catch(() => {}); }
});

test('the browser deadline cancels a stalled stream, clears its draft and never retries', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const request = await api(); let cancelled = false; let received; let calls = 0;
  const abort = new AbortController();
  const first = new Promise((resolve) => { received = resolve; });
  const statuses = []; const metrics = []; const rendered = [];
  const wire = new Response(new ReadableStream({
    start(controller) { controller.enqueue(encoder.encode(ready + delta)); },
    cancel() { cancelled = true; },
  }), { headers: { 'Content-Type': 'text/event-stream' } });
  const pending = request(body, { signal: abort.signal, fetchImpl: async () => { calls++; return wire; },
    onPreview: (text) => { rendered.push(text); if (text) received(); },
    onStatus: (value) => statuses.push(value), onMetrics: (value) => metrics.push(value) });
  const rejected = assert.rejects(pending, { code: 'RESPONSE_TIMEOUT' });
  rejected.catch(() => {});
  try {
  await first; t.mock.timers.tick(35000); await new Promise((resolve) => setImmediate(resolve));
  assert.equal(cancelled, true); assert.equal(rendered.at(-1), ''); assert.equal(calls, 1);
  await rejected;
  assert.equal(statuses.at(-1), 'error');
  assert.equal(metrics.length, 1); assert.equal(metrics[0].outcome, 'timeout');
  assert.equal(metrics[0].code, 'RESPONSE_TIMEOUT');
  } finally { abort.abort(); await rejected.catch(() => {}); }
});

test('replayed completion has no generated first-delta metric and timing observers cannot break success', async () => {
  const request = await api(); let measured;
  const output = await request(body, { fetchImpl: async () => response(final),
    onStatus: () => { throw new Error('Broken status observer'); },
    onMetrics: (value) => { measured = value; throw new Error('Broken metrics observer'); } });
  assert.deepEqual(output, complete);
  assert.ok(measured, 'Completion must report one safe timing observation');
  assert.equal(measured.firstDeltaMs, null); assert.equal(measured.outcome, 'complete');
  assert.deepEqual(Object.keys(measured).sort(), ['code', 'elapsedMs', 'firstDeltaMs', 'outcome']);
});

test('a connection lost after draft text is a network failure, not invalid model JSON', async () => {
  const request = await api(); let disconnect; let received;
  const first = new Promise((resolve) => { received = resolve; });
  const wire = new Response(new ReadableStream({ start(controller) {
    controller.enqueue(encoder.encode(ready + delta)); disconnect = () => controller.error(new TypeError('PRIVATE_CONNECTION_DETAILS'));
  } }), { headers: { 'Content-Type': 'text/event-stream' } });
  const rendered = [];
  const pending = request(body, { fetchImpl: async () => wire,
    onPreview: (text) => { rendered.push(text); if (text) received(); } });
  const rejected = assert.rejects(pending, (error) => error.code === 'NETWORK_ERROR' && !error.message.includes('PRIVATE'));
  await first; disconnect(); await rejected; assert.equal(rendered.at(-1), '');
});

test('browser client requests SSE and displays real text before the complete event arrives', async () => {
  const request = await api(); let finish; let firstText;
  const rendered = []; const first = new Promise((resolve) => { firstText = resolve; });
  const wire = new Response(new ReadableStream({ start(controller) {
    controller.enqueue(encoder.encode(ready + delta));
    finish = () => { controller.enqueue(encoder.encode(final)); controller.close(); };
  } }), { headers: { 'Content-Type': 'text/event-stream' } });
  const pending = request(body, { fetchImpl: async (url, options) => {
    assert.equal(url, '/api/interview/next');
    assert.equal(options.headers.Accept, 'text/event-stream');
    assert.deepEqual(JSON.parse(options.body), body);
    return wire;
  }, onPreview: (text) => { rendered.push(text); if (text) firstText(text); } });
  assert.equal(await first, 'Bạn kiểm tra ');
  finish();
  assert.deepEqual(await pending, complete);
  assert.equal(rendered.at(-1), 'Bạn kiểm tra API thế nào?');
});

test('one-byte UTF-8 fragments and CRLF SSE frames preserve Vietnamese text', async () => {
  const request = await api(); const rendered = [];
  const result = await request(body, { fetchImpl: async () => response((ready + delta + final).replace(/\n/gu, '\r\n')),
    onPreview: (text) => rendered.push(text) });
  assert.deepEqual(result, complete);
  assert.ok(rendered.includes('Bạn kiểm tra '));
});

test('SSE error after draft text clears the draft and returns the server error code', async () => {
  const request = await api(); const rendered = [];
  const error = 'event: error\ndata: {"error":{"code":"INVALID_OUTPUT","message":"Invalid response."}}\n\n';
  await assert.rejects(request(body, { fetchImpl: async () => response(ready + delta + error),
    onPreview: (text) => rendered.push(text) }), { code: 'INVALID_OUTPUT' });
  assert.ok(rendered.includes('Bạn kiểm tra '));
  assert.equal(rendered.at(-1), '');
});

test('a truncated stream cannot silently become a completed question', async () => {
  const request = await api(); const rendered = [];
  await assert.rejects(request(body, { fetchImpl: async () => response(ready + delta),
    onPreview: (text) => rendered.push(text) }), { code: 'INCOMPLETE_STREAM' });
  assert.equal(rendered.at(-1), '');
});

test('public complete response rejects extra internal fields and a wrong session', async () => {
  const request = await api();
  for (const value of [{ ...complete, reason: 'PRIVATE' }, { ...complete, sessionId: '00000000-0000-4000-8000-000000000099' }]) {
    const rendered = [];
    await assert.rejects(request(body, { fetchImpl: async () => response(ready + delta + 'event: complete\ndata: ' + JSON.stringify(value) + '\n\n'),
      onPreview: (text) => rendered.push(text) }), { code: 'INVALID_STREAM' });
    assert.equal(rendered.at(-1), '');
  }
});

test('end after a provisional question clears the draft rather than showing it as saved', async () => {
  const request = await api(); const rendered = [];
  const ending = { sessionId, action: 'end', question: null };
  const value = await request(body, { fetchImpl: async () => response(ready + delta + 'event: complete\ndata: ' + JSON.stringify(ending) + '\n\n'),
    onPreview: (text) => rendered.push(text) });
  assert.deepEqual(value, ending);
  assert.equal(rendered.at(-1), '');
});

test('HTTP errors before streaming keep the application error code', async () => {
  const request = await api();
  await assert.rejects(request(body, { fetchImpl: async () => Response.json({ error: { code: 'GENERATION_IN_PROGRESS', message: 'Already generating.' } }, { status: 409 }) }),
    { code: 'GENERATION_IN_PROGRESS' });
});

test('browser abort cancels its reader and clears provisional text', async () => {
  const request = await api(); const abort = new AbortController(); let shown; let cancelled = false;
  const rendered = []; const first = new Promise((resolve) => { shown = resolve; });
  const wire = new Response(new ReadableStream({ start(controller) { controller.enqueue(encoder.encode(ready + delta)); },
    cancel() { cancelled = true; } }), { headers: { 'Content-Type': 'text/event-stream' } });
  const pending = request(body, { signal: abort.signal, fetchImpl: async () => wire,
    onPreview: (text) => { rendered.push(text); if (text) shown(); } });
  await first; abort.abort();
  await assert.rejects(pending, { code: 'REQUEST_CANCELLED' });
  assert.equal(cancelled, true); assert.equal(rendered.at(-1), '');
});

test('replayed complete-only event displays the saved question without draft events', async () => {
  const request = await api(); const rendered = [];
  const value = await request(body, { fetchImpl: async () => response(final), onPreview: (text) => rendered.push(text) });
  assert.deepEqual(value, complete); assert.equal(rendered.at(-1), complete.question.content);
});

test('delta events containing unrelated internal fields are rejected before rendering', async () => {
  const request = await api(); const rendered = [];
  await assert.rejects(request(body, { fetchImpl: async () => response(ready + 'event: delta\ndata: {"text":"PRIVATE","reason":"PRIVATE"}\n\n' + final),
    onPreview: (text) => rendered.push(text) }), { code: 'INVALID_STREAM' });
  assert.equal(rendered.some((text) => text.includes('PRIVATE')), false);
});

test('unexpected JSON success response is rejected instead of pretending it was streamed', async () => {
  const request = await api();
  await assert.rejects(request(body, { fetchImpl: async () => Response.json(complete) }), { code: 'INVALID_STREAM' });
});
