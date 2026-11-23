import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestDatabase } from './interview-next-db.mjs';
import { createNextService } from '../lib/interview/next-service.mjs';
import { createNextHandler } from '../lib/interview/next-http.mjs';
import { createInterviewerProvider } from '../lib/interview/interviewer-provider.mjs';
import { withInterviewerLimit } from '../lib/ai/daily-limit.mjs';
import { readSseEvents } from '../lib/interview/stream-protocol.mjs';

for (const streaming of [false, true]) {
  test(`${streaming ? 'SSE' : 'JSON'} repair persists one new question through the real SQL reservation and replay`, async () => {
    const store = await createTestDatabase();
    try {
      const sessionId = await store.session({ difficulty: 'easy', language: 'en' });
      const questions = ['How would you define TypeScript types for props in a React component?',
        'How would you type the props of a React component using TypeScript?',
        'How would you resolve a Git merge conflict?'];
      let calls = 0, quota = 0;
      const provider = withInterviewerLimit(createInterviewerProvider({
        env: { GEMINI_API_KEY: 'PRIVATE_TEST_ONLY', GEMINI_MODEL: 'offline' },
        fetchImpl: async (url) => {
          const result = { question: questions[calls++], action: 'next_topic', topic: calls < 3 ? 'React props' : 'Git merge', reason: 'PRIVATE_REASON' };
          const envelope = { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(result) }] } }] };
          return url.includes(':streamGenerateContent') ? new Response(`data: ${JSON.stringify(envelope)}\n\n`, { headers: { 'Content-Type': 'text/event-stream' } }) : Response.json(envelope);
        },
      }), async () => { quota++; });
      const next = createNextService({ repository: store.repository, provider });
      const opening = await next({ sessionId, afterAnswerId: null });
      const afterAnswerId = await store.answer(opening.question.id, 'PRIVATE_ANSWER: I use a props type for each component.');
      const body = { sessionId, afterAnswerId }, timing = [];
      const POST = createNextHandler({ authenticate: async () => ({}), makeService: () => next, observeTiming: event => timing.push(event) });
      const response = await POST(new Request('http://localhost/api/interview/next', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(streaming ? { Accept: 'text/event-stream' } : {}) }, body: JSON.stringify(body) }));
      let result;
      if (streaming) {
        const events = []; for await (const event of readSseEvents(response.body)) events.push(event);
        assert.equal(events.at(-1).event, 'complete'); assert.equal(events.some(event => event.event === 'error'), false);
        result = JSON.parse(events.at(-1).data);
        assert.equal(events.filter(event => event.event === 'delta').map(event => JSON.parse(event.data).text).join(''), questions[1], 'Repair must not append a second question to the provisional draft');
      } else result = await response.json();
      assert.equal(response.status, 200); assert.equal(result.question.content, questions[2]);
      assert.equal(result.question.position, 2); assert.equal(calls, 3); assert.equal(quota, 3);
      assert.deepEqual(await next(body), result); assert.equal(calls, 3);
      const saved = await store.db.query('select content from public.questions where session_id=$1 order by position', [sessionId]);
      assert.deepEqual(saved.rows.map(row => row.content), [questions[0], questions[2]]);
      assert.ok(timing.some(event => event.validationReason === 'NEAR_DUPLICATE'));
      assert.equal(JSON.stringify(timing).includes('PRIVATE'), false);
      assert.equal(JSON.stringify(timing).includes(sessionId), false);
    } finally { await store.db.close(); }
  });
}
