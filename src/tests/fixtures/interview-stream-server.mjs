// Local verification harness, never a deployment entrypoint. Auth and DB are
// stand-ins; the provider, service, HTTP handler and browser consumer are real.
import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createTestDatabase } from '../interview-next-db.mjs';
import { createNextHandler } from '../../lib/interview/next-http.mjs';
import { createNextService } from '../../lib/interview/next-service.mjs';
import { createInterviewerProvider } from '../../lib/interview/interviewer-provider.mjs';
import { interviewerFixtures } from '../../lib/interview/interviewer-fixtures.mjs';
import { interviewFlowFixtures } from '../../lib/interview/interview-flow-fixtures.mjs';

const live = process.argv.includes('--live');
const trace = process.argv.includes('--trace');
const portIndex = process.argv.indexOf('--port');
const port = Number(portIndex < 0 ? 4174 : process.argv[portIndex + 1]);
const instanceIndex = process.argv.indexOf('--instance');
const instanceId = instanceIndex < 0 ? randomUUID() : process.argv[instanceIndex + 1];
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Use --port <1024..65535>.');
const store = await createTestDatabase();
const encoder = new TextEncoder();
const base = structuredClone(interviewerFixtures[0].input);
base.history = [];
const copy = (id) => structuredClone(interviewerFixtures.find((fixture) => fixture.id === id).input);
const definitions = live ? [
  { id: 'live-en-opening', label: 'Gemini · mở đầu tiếng Anh', input: { ...structuredClone(base), settings: { ...base.settings, language: 'en' } } },
  { id: 'live-vi-opening', label: 'Gemini · mở đầu tiếng Việt', input: structuredClone(base) },
  { id: 'live-en-followup', label: 'Gemini · hỏi tiếp kỹ thuật', input: copy('backend-en-vague') },
  { id: 'live-vi-behavioral', label: 'Gemini · hỏi tiếp hành vi', input: copy('behavioral-vi-vague') },
  { id: 'live-long-history', label: 'Gemini · lịch sử dài', input: structuredClone(interviewFlowFixtures.find((fixture) => fixture.id === 'long-memory-en').input) },
] : [
  { id: 'slow-success', label: 'Thành công · trả chữ trước khi hoàn tất' },
  { id: 'invalid-output', label: 'Lỗi · JSON có trường score không hợp lệ' },
  { id: 'truncated', label: 'Lỗi · phản hồi bị cắt giữa chừng' },
  { id: 'cancel', label: 'Hủy khi đang nhận câu hỏi' },
  { id: 'unicode', label: 'Tiếng Việt, dấu ngoặc kép và emoji' },
  { id: 'closed', label: 'Phiên đã đóng · không gọi AI' },
  { id: 'busy', label: 'Lượt đang được tạo · HTTP 409' },
  { id: 'stop-open', label: 'STOP hợp lệ · upstream chưa đóng kết nối' },
  { id: 'slow-notices', label: 'Chờ 12 giây · thông báo chậm và chờ kéo dài' },
  { id: 'provider-timeout', label: 'Timeout upstream · không lưu draft' },
  { id: 'browser-deadline', label: 'Hết thời gian chờ ở trình duyệt', browserTimeoutMs: 1000 },
  { id: 'disconnect', label: 'Mất kết nối sau khi nhận chữ đầu' },
].map((fixture) => ({ ...fixture, input: structuredClone(base) }));
const fixtures = [];
let externalRequests = 0;
for (const definition of definitions) {
  const { input } = definition;
  const sessionId = await store.session({ type: input.settings.type, difficulty: input.settings.difficulty,
    language: input.settings.language, position: input.settings.targetPosition, jd: input.jdText, cv: input.cvText });
  await store.db.query('update public.interview_sessions set duration_minutes=$2,planned_questions=$3 where id=$1',
    [sessionId, input.settings.durationMinutes, input.settings.plannedQuestions]);
  let afterAnswerId = null; let parent = null;
  for (const [index, turn] of input.history.entries()) {
    const row = await store.db.query(`insert into public.questions(session_id,position,kind,topic,content,parent_question_id)
      values($1,$2,$3,$4,$5,$6) returning id`, [sessionId, index + 1, turn.kind, turn.topic, turn.question, turn.kind === 'main' ? null : parent]);
    if (turn.kind === 'main') parent = row.rows[0].id;
    afterAnswerId = await store.answer(row.rows[0].id, turn.answer);
  }
  if (definition.id === 'closed') await store.db.query("update public.interview_sessions set status='abandoned' where id=$1", [sessionId]);
  if (definition.id === 'busy') await store.repository.claim({ sessionId, afterAnswerId });
  fixtures.push({ ...definition, sessionId, afterAnswerId, calls: 0, upstreamCancelled: false, timings: [] });
}

function simulatedResponse(fixture) {
  const timers = [];
  const frame = (text, finishReason) => encoder.encode('data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text }] }, ...(finishReason ? { finishReason } : {}) }] }) + '\r\n\r\n');
  const cleanup = () => timers.forEach(clearTimeout);
  const stream = new ReadableStream({
    start(controller) {
      const unicode = fixture.id === 'unicode';
      timers.push(setTimeout(() => {
        const bytes = frame(unicode ? '{"question":"Bạn chọn \\"Go\\" ' : '{"question":"Bạn sẽ kiểm thử ');
        for (let i = 0; i < bytes.length; i += 7) controller.enqueue(bytes.slice(i, i + 7));
      }, 100));
      if (!['cancel', 'provider-timeout', 'browser-deadline', 'disconnect'].includes(fixture.id)) timers.push(setTimeout(() => {
        if (fixture.id === 'truncated') { controller.close(); return; }
        const tail = unicode
          ? 'và \\uD83D\\uDE00 như thế nào?","action":"next_topic","topic":"Ngôn ngữ","reason":"INTERNAL_REASON"}'
          : 'lỗi API như thế nào?","action":"next_topic","topic":"Kiểm thử API","reason":"INTERNAL_REASON"' + (fixture.id === 'invalid-output' ? ',"score":100}' : '}');
        controller.enqueue(frame(tail, 'STOP'));
        if (fixture.id !== 'stop-open') controller.close();
      }, fixture.id === 'slow-success' ? 2500 : fixture.id === 'slow-notices' ? 12000 : 850));
    },
    cancel() { fixture.upstreamCancelled = true; cleanup(); },
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } });
}
function makeHandler(fixture) {
  const diagnostic = { frames: [], providerEvents: [], error: null };
  let capture = Promise.resolve();
  const actual = createInterviewerProvider({
    ...(live ? {} : { env: { GEMINI_API_KEY: 'offline-only', GEMINI_MODEL: 'controlled-upstream',
      GEMINI_TIMEOUT_MS: fixture.id === 'provider-timeout' ? '1000' : '30000' } }),
    fetchImpl: async (...args) => {
      fixture.calls++; if (live) externalRequests++;
      const response = live ? await fetch(...args) : simulatedResponse(fixture);
      if (trace) capture = response.clone().text().then((wire) => {
        diagnostic.contentType = response.headers.get('content-type');
        diagnostic.wireLength = wire.length;
        for (const line of wire.split(/\r?\n/u).filter((line) => line.startsWith('data:'))) {
          try {
            const value = JSON.parse(line.slice(5).trim());
            for (const candidate of value.candidates ?? []) if (candidate.content?.parts) candidate.content.parts = candidate.content.parts.filter((part) => !part?.thought);
            diagnostic.frames.push(value);
          } catch { diagnostic.unparsedFrame = true; }
        }
      }).catch(() => { diagnostic.captureFailed = true; });
      return response;
    },
  });
  const provider = !trace ? actual : { ...actual, async *stream(...args) {
    try {
      for await (const item of actual.stream(...args)) { diagnostic.providerEvents.push(item); yield item; }
    } catch (error) { diagnostic.error = { code: error.code, message: error.message, stack: error.stack }; throw error; }
    finally {
      await capture;
      const directory = new URL('../../../tmp/scrum94-traces/', import.meta.url);
      await mkdir(directory, { recursive: true });
      await writeFile(new URL(fixture.id + '.json', directory), JSON.stringify(diagnostic, null, 2));
    }
  } };
  return createNextHandler({ authenticate: async () => ({ simulatedUser: true }),
    observeTiming: (event) => fixture.timings.push(event),
    makeService: () => createNextService({ repository: store.repository, provider }) });
}
const staticFiles = new Map([
  ['/', new URL('./interview-stream.html', import.meta.url)],
  ['/next-stream-client.mjs', new URL('../../lib/interview/next-stream-client.mjs', import.meta.url)],
  ['/session-contract.mjs', new URL('../../lib/interview/session-contract.mjs', import.meta.url)],
  ['/stream-protocol.mjs', new URL('../../lib/interview/stream-protocol.mjs', import.meta.url)],
]);
const server = createServer(async (incoming, outgoing) => {
  try {
    const url = new URL(incoming.url, `http://127.0.0.1:${port}`);
    if (incoming.method === 'GET' && staticFiles.has(url.pathname)) {
      outgoing.setHeader('Content-Type', url.pathname === '/' ? 'text/html; charset=utf-8' : 'text/javascript; charset=utf-8');
      outgoing.end(await readFile(staticFiles.get(url.pathname))); return;
    }
    if (url.pathname === '/fixtures') {
      outgoing.setHeader('Content-Type', 'application/json');
      outgoing.end(JSON.stringify({ instanceId, mode: live ? 'live' : 'controlled', fixtures: fixtures.map(({ id, label, sessionId, afterAnswerId, browserTimeoutMs }) => ({ id, label, sessionId, afterAnswerId, browserTimeoutMs })) })); return;
    }
    if (url.pathname === '/stats') {
      const fixture = fixtures.find((item) => item.sessionId === url.searchParams.get('sessionId'));
      if (!fixture) { outgoing.writeHead(404).end(); return; }
      const questions = await store.db.query('select count(*)::int as n from public.questions where session_id=$1', [fixture.sessionId]);
      const generations = await store.db.query('select status from public.interview_next_generations where session_id=$1', [fixture.sessionId]);
      outgoing.setHeader('Content-Type', 'application/json');
      outgoing.end(JSON.stringify({ externalRequests, calls: fixture.calls, upstreamCancelled: fixture.upstreamCancelled,
        newQuestions: questions.rows[0].n - fixture.input.history.length, generationStatus: generations.rows[0]?.status ?? null,
        timings: fixture.timings })); return;
    }
    if (incoming.method !== 'POST' || url.pathname !== '/api/interview/next') { outgoing.writeHead(404).end(); return; }
    const abort = new AbortController();
    incoming.on('aborted', () => abort.abort());
    outgoing.on('close', () => { if (!outgoing.writableEnded) abort.abort(); });
    const request = new Request(url, { method: 'POST', headers: incoming.headers,
      body: Readable.toWeb(incoming), duplex: 'half', signal: abort.signal });
    const body = await request.clone().json();
    const fixture = fixtures.find((item) => item.sessionId === body.sessionId);
    if (!fixture) { outgoing.writeHead(404).end(); return; }
    const result = await makeHandler(fixture)(request);
    outgoing.writeHead(result.status, Object.fromEntries(result.headers)); outgoing.flushHeaders();
    if (result.body) for await (const chunk of result.body) {
      if (outgoing.destroyed) break;
      if (!outgoing.write(chunk)) await new Promise((resolve) => { outgoing.once('drain', resolve); outgoing.once('close', resolve); });
      if (fixture.id === 'disconnect' && new TextDecoder().decode(chunk).startsWith('event: delta')) {
        outgoing.destroy(); break;
      }
    }
    outgoing.end();
  } catch { if (!outgoing.headersSent) outgoing.writeHead(500); outgoing.end(); }
});
server.listen(port, '127.0.0.1', () => console.log(`SCRUM-94 ${live ? 'Gemini live' : 'controlled-upstream'} verification at http://127.0.0.1:${port}; simulated auth + local PGlite.`));
const stop = () => server.close(async () => { await store.db.close(); process.exit(0); });
process.on('SIGINT', stop); process.on('SIGTERM', stop);
