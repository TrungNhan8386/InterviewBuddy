import test from 'node:test';
import assert from 'node:assert/strict';

const sessionId = '00000000-0000-4000-8000-000000000010';
const questionId = '00000000-0000-4000-8000-000000000011';
const answerId = '00000000-0000-4000-8000-000000000012';
async function transport(fetchImpl) {
  const api = await import('../lib/interview-chat/transport.mjs').catch((error) => {
    if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
    throw error;
  });
  assert.equal(typeof api.createChatTransport, 'function', 'Chat must use persistence APIs and the shared SSE consumer');
  return api.createChatTransport({ fetchImpl });
}

test('chat loads saved turns and the server start time through the authenticated session API', async () => {
  const saved = { id: sessionId, status: 'in_progress', startedAt: '2026-11-06T02:00:00Z', settings: { language: 'en' }, turns: [] };
  const api = await transport(async (url, options) => {
    assert.equal(url, `/api/interview/${sessionId}`); assert.equal(options.cache, 'no-store');
    return Response.json(saved);
  });
  assert.deepEqual(await api.loadSession(sessionId), saved);
});

test('chat saves the answer through the persistence API and uses its confirmed answer ID', async () => {
  const api = await transport(async (url, options) => {
    assert.equal(url, `/api/interview/${sessionId}/answers`); assert.equal(options.method, 'POST');
    assert.deepEqual(JSON.parse(options.body), { questionId, content: 'I would test a cancelled request.', inputMode: 'text' });
    return Response.json({ answer: { id: answerId }, alreadySaved: false }, { status: 201 });
  });
  assert.equal(await api.saveAnswer(sessionId, questionId, 'I would test a cancelled request.'), answerId);
});

test('a voice answer is saved with its input mode and speaking time (UC-07)', async () => {
  const api = await transport(async (url, options) => {
    assert.equal(url, `/api/interview/${sessionId}/answers`);
    assert.deepEqual(JSON.parse(options.body), { questionId, content: 'Edited transcript.', inputMode: 'voice', durationSeconds: 42.5 });
    return Response.json({ answer: { id: answerId }, alreadySaved: false }, { status: 201 });
  });
  assert.equal(await api.saveAnswer(sessionId, questionId, 'Edited transcript.', { inputMode: 'voice', durationSeconds: 42.5 }), answerId);
});

test('a typed answer sends no duration, so it never counts for the speaking pace', async () => {
  const api = await transport(async (url, options) => {
    assert.deepEqual(JSON.parse(options.body), { questionId, content: 'Typed.', inputMode: 'text' });
    return Response.json({ answer: { id: answerId }, alreadySaved: false }, { status: 201 });
  });
  assert.equal(await api.saveAnswer(sessionId, questionId, 'Typed.', { inputMode: 'text', durationSeconds: null }), answerId);
});

test('chat ends the session through the persistence endpoint', async () => {
  const api = await transport(async (url, options) => {
    assert.equal(url, `/api/interview/${sessionId}/end`); assert.equal(options.method, 'POST');
    return Response.json({ id: sessionId, status: 'completed' });
  });
  await api.endSession(sessionId);
});

test('chat displays an SSE draft before the saved final question and retains the answer anchor', async () => {
  const encoder = new TextEncoder(); let finish; let previewed;
  const first = new Promise((resolve) => { previewed = resolve; });
  const saved = { sessionId, action: 'next_topic', question: { id: questionId, content: 'How would you test the API?', topic: 'API testing', kind: 'main', position: 2 } };
  const api = await transport(async (url, options) => {
    assert.equal(url, '/api/interview/next'); assert.equal(options.headers.Accept, 'text/event-stream');
    assert.deepEqual(JSON.parse(options.body), { sessionId, afterAnswerId: answerId });
    return new Response(new ReadableStream({ start(controller) {
      controller.enqueue(encoder.encode(`event: ready\ndata: {"sessionId":"${sessionId}"}\n\nevent: delta\ndata: {"text":"How would you "}\n\n`));
      finish = () => { controller.enqueue(encoder.encode('event: complete\ndata: ' + JSON.stringify(saved) + '\n\n')); controller.close(); };
    } }), { headers: { 'Content-Type': 'text/event-stream' } });
  });
  const pending = api.requestNext(sessionId, answerId, { onPreview: (text) => { if (text) previewed(text); } });
  assert.equal(await first, 'How would you '); finish();
  assert.deepEqual(await pending, saved);
});

test('quota errors are returned once without an automatic retry or exposing the upstream message', async () => {
  let calls = 0;
  const api = await transport(async () => { calls++; return Response.json({ error: { code: 'AI_DAILY_LIMIT', message: 'PRIVATE_DETAIL' } }, { status: 429 }); });
  await assert.rejects(api.requestNext(sessionId, null), (error) => error.code === 'AI_DAILY_LIMIT' && !error.message.includes('PRIVATE_DETAIL'));
  assert.equal(calls, 1);
});

test('a response for another session cannot replace the current chat session', async () => {
  const api = await transport(async () => Response.json({ id: answerId, status: 'in_progress', settings: {}, turns: [] }));
  await assert.rejects(api.loadSession(sessionId), { code: 'INVALID_OUTPUT' });
});
