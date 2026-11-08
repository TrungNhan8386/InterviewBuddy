import test from 'node:test';
import assert from 'node:assert/strict';
import { createInterviewerProvider } from '../lib/interview/interviewer-provider.mjs';
import { interviewerFixtures } from '../lib/interview/interviewer-fixtures.mjs';

const input = { ...interviewerFixtures[0].input, history: [] };
const encoder = new TextEncoder();
const envelope = (text, finishReason) => ({ candidates: [{ content: { parts: [{ text }] }, ...(finishReason ? { finishReason } : {}) }] });
const frame = (value) => 'data: ' + JSON.stringify(value) + '\r\n\r\n';
const decision = { action: 'next_topic', question: 'Bạn sẽ kiểm tra lỗi API như thế nào?', topic: 'Kiểm thử API', reason: 'PRIVATE_OPERATIONAL_REASON' };
function upstream(values, fragment = 7) {
  const bytes = encoder.encode(values.map(frame).join(''));
  return new Response(new ReadableStream({ start(controller) {
    for (let i = 0; i < bytes.length; i += fragment) controller.enqueue(bytes.slice(i, i + fragment));
    controller.close();
  } }), { headers: { 'Content-Type': 'text/event-stream' } });
}
function provider(fetchImpl) {
  const result = createInterviewerProvider({ env: { GEMINI_API_KEY: 'offline-only', GEMINI_MODEL: 'offline' }, fetchImpl });
  assert.equal(typeof result.stream, 'function', 'Provider must support incremental validated streaming');
  return result;
}
async function collect(generator) { const values = []; for await (const value of generator) values.push(value); return values; }

test('stream emits real question text before upstream completion and excludes internal fields', async () => {
  let finish; let entered;
  const waiting = new Promise((resolve) => { entered = resolve; });
  const response = new Response(new ReadableStream({ start(controller) {
    controller.enqueue(encoder.encode(frame(envelope('{"action":"next_topic","question":"Bạn sẽ kiểm tra '))));
    entered();
    finish = () => { controller.enqueue(encoder.encode(frame(envelope('lỗi API như thế nào?","topic":"Kiểm thử API","reason":"PRIVATE_OPERATIONAL_REASON"}', 'STOP')))); controller.close(); };
  } }), { headers: { 'Content-Type': 'text/event-stream' } });
  const ai = provider(async (url, options) => {
    assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/models/offline:streamGenerateContent?alt=sse');
    assert.equal(options.headers['x-goog-api-key'], 'offline-only');
    assert.equal(options.redirect, 'error');
    return response;
  });
  const iterator = ai.stream(input);
  await waiting;
  const first = await iterator.next();
  assert.deepEqual(first.value, { type: 'delta', text: 'Bạn sẽ kiểm tra ' });
  finish();
  const rest = await collect(iterator);
  assert.equal(rest.filter((value) => value.type === 'delta').map((value) => value.text).join(''), 'lỗi API như thế nào?');
  assert.deepEqual(rest.at(-1), { type: 'decision', value: decision });
  assert.equal(JSON.stringify(rest.filter((value) => value.type === 'delta')).includes('PRIVATE'), false);
});

test('split UTF-8 bytes and split JSON escapes preserve Vietnamese, quotes and surrogate-pair emoji', async () => {
  const chunks = ['{"question":"Bạn chọn \\"Go\\" và ', '\\uD83D', '\\uDE00 như thế nào?","action":"next_topic","topic":"Ngôn ngữ","reason":"Làm rõ."}'];
  // Build the escaped quotation with JSON.stringify, independently of the parser.
  chunks[0] = '{"question":' + JSON.stringify('Bạn chọn "Go" và ').slice(0, -1);
  const ai = provider(async () => upstream(chunks.map((text, i) => envelope(text, i === chunks.length - 1 ? 'STOP' : undefined)), 1));
  const values = await collect(ai.stream(input));
  assert.equal(values.filter((value) => value.type === 'delta').map((value) => value.text).join(''), 'Bạn chọn "Go" và 😀 như thế nào?');
  assert.equal(values.at(-1).value.question, 'Bạn chọn "Go" và 😀 như thế nào?');
});

test('a question-looking substring in reason and thought parts is never rendered as question text', async () => {
  const value = { ...decision, reason: 'PRIVATE \\"question\\": \\"not a user question\\"' };
  const data = { reason: value.reason, topic: value.topic, action: value.action, question: value.question };
  const first = envelope(''); first.candidates[0].content.parts = [{ thought: true, text: 'THOUGHT_SECRET' }];
  const ai = provider(async () => upstream([first, envelope(JSON.stringify(data), 'STOP')]));
  const values = await collect(ai.stream(input));
  assert.equal(values.filter((item) => item.type === 'delta').map((item) => item.text).join(''), decision.question);
  assert.equal(JSON.stringify(values.filter((item) => item.type === 'delta')).includes('PRIVATE'), false);
});

test('final JSON with an extra score field is rejected after provisional text', async () => {
  const ai = provider(async () => upstream([envelope(JSON.stringify({ ...decision, score: 100 }), 'STOP')]));
  await assert.rejects(collect(ai.stream(input)), { code: 'INVALID_OUTPUT' });
});

test('valid-looking JSON without STOP is rejected instead of being committed as complete', async () => {
  const ai = provider(async () => upstream([envelope(JSON.stringify(decision))]));
  await assert.rejects(collect(ai.stream(input)), { code: 'INVALID_OUTPUT' });
});

test('safety rejection mid-stream yields a safe error and no final decision', async () => {
  const ai = provider(async () => upstream([envelope('{"question":"Bạn '), envelope('', 'SAFETY')]));
  const iterator = ai.stream(input);
  assert.equal((await iterator.next()).value.type, 'delta');
  await assert.rejects(iterator.next(), { code: 'AI_CONTENT_BLOCKED', status: 422 });
});

test('cancelling a stalled upstream stream cancels its reader and rejects the generation', async () => {
  const controller = new AbortController(); let cancelled = false;
  const response = new Response(new ReadableStream({
    start(stream) { stream.enqueue(encoder.encode(frame(envelope('{"question":"Bạn ')))); },
    cancel() { cancelled = true; },
  }), { headers: { 'Content-Type': 'text/event-stream' } });
  const ai = provider(async () => response);
  const iterator = ai.stream(input, { signal: controller.signal });
  await iterator.next(); controller.abort();
  await assert.rejects(iterator.next(), { code: 'REQUEST_CANCELLED' });
  assert.equal(cancelled, true);
});

test('rate limit is exposed once with a safe code, not an automatic retry or upstream body', async () => {
  let requests = 0;
  const ai = provider(async () => { requests++; return new Response('PRIVATE_UPSTREAM_BODY', { status: 429 }); });
  await assert.rejects(collect(ai.stream(input)), { code: 'AI_RATE_LIMITED', status: 429 });
  assert.equal(requests, 1);
});

test('terminal provider streaming does not need credentials or make an upstream request', async () => {
  const ai = createInterviewerProvider({ env: {}, fetchImpl: () => assert.fail('End must be local') });
  assert.equal(typeof ai.stream, 'function', 'Provider must support incremental validated streaming');
  const values = await collect(ai.stream({ ...input, state: { status: 'completed', elapsedSeconds: 0 } }));
  assert.equal(values.length, 1);
  assert.equal(values[0].value.action, 'end');
});

test('network failure is reported as unavailable rather than invalid model output', async () => {
  const ai = provider(async () => { throw new TypeError('PRIVATE_NETWORK_DETAILS'); });
  await assert.rejects(collect(ai.stream(input)), { code: 'AI_UNAVAILABLE', status: 502 });
});

test('an oversized question is rejected before its draft is forwarded', async () => {
  const ai = provider(async () => upstream([envelope(JSON.stringify({ ...decision, question: 'a'.repeat(1201) }), 'STOP')]));
  const previews = [];
  await assert.rejects(async () => { for await (const value of ai.stream(input)) if (value.type === 'delta') previews.push(value.text); }, { code: 'INVALID_OUTPUT' });
  assert.deepEqual(previews, []);
});

for (const [status, code] of [[503, 'AI_UNAVAILABLE'], [429, 'AI_RATE_LIMITED']]) {
  test(`HTTP 200 followed by an in-band ${status} error is classified as an upstream failure`, async () => {
    const ai = provider(async () => upstream([envelope('{"action":"next'), { error: { code: status, message: 'PRIVATE_UPSTREAM_DIAGNOSTICS', status: 'UNAVAILABLE' } }]));
    await assert.rejects(collect(ai.stream(input)), (error) => {
      assert.equal(error.code, code);
      assert.equal(error.message.includes('PRIVATE_UPSTREAM'), false);
      return true;
    });
  });
}

test('a validated STOP decision completes without waiting for the upstream connection to close', async () => {
  const abort = new AbortController(); let cancelled = false; let timer; let pending;
  const response = new Response(new ReadableStream({
    start(controller) { controller.enqueue(encoder.encode(frame(envelope(JSON.stringify(decision), 'STOP')))); },
    cancel() { cancelled = true; },
  }), { headers: { 'Content-Type': 'text/event-stream' } });
  const iterator = provider(async () => response).stream(input, { signal: abort.signal });
  try {
    assert.equal((await iterator.next()).value.type, 'delta');
    pending = iterator.next();
    const result = await Promise.race([pending, new Promise((resolve) => { timer = setTimeout(() => resolve('still-waiting-for-eof'), 200); })]);
    assert.notEqual(result, 'still-waiting-for-eof', 'STOP is terminal; waiting for TCP EOF delays an already finished answer');
    assert.deepEqual(result.value, { type: 'decision', value: decision });
    assert.equal(cancelled, true, 'Release the upstream reader before delivering the validated decision');
  } finally {
    clearTimeout(timer); abort.abort(); await pending?.catch(() => {}); await iterator.return();
  }
});

test('a stalled partial stream reaches AI_TIMEOUT and cancels its upstream reader', async () => {
  let cancelled = false;
  const keepAlive = setTimeout(() => {}, 1500);
  const ai = createInterviewerProvider({ env: { GEMINI_API_KEY: 'offline-only', GEMINI_MODEL: 'offline', GEMINI_TIMEOUT_MS: '1000' },
    fetchImpl: async () => new Response(new ReadableStream({
      start(controller) { controller.enqueue(encoder.encode(frame(envelope('{"question":"Bạn ')))); },
      cancel() { cancelled = true; },
    }), { headers: { 'Content-Type': 'text/event-stream' } }) });
  try { await assert.rejects(collect(ai.stream(input)), { code: 'AI_TIMEOUT', status: 504 }); }
  finally { clearTimeout(keepAlive); }
  assert.equal(cancelled, true);
});
