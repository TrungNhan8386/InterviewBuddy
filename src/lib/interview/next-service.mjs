import { isUuid } from './session-contract.mjs';
import { InterviewerError, validateInterviewerInput, validateInterviewerOutput } from './interviewer-contract.mjs';
import { PROMPT_VERSION } from './interviewer-prompt.mjs';
import { QUESTION_PLAN_VERSION } from './question-plan.mjs';
import { CONVERSATION_MEMORY_VERSION } from './conversation-memory.mjs';

export function validateNextRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)
      || Object.keys(body).some((key) => !['sessionId', 'afterAnswerId'].includes(key))
      || !isUuid(body.sessionId) || !Object.hasOwn(body, 'afterAnswerId')
      || (body.afterAnswerId !== null && !isUuid(body.afterAnswerId))) {
    throw new InterviewerError('BAD_INPUT', 'Provide sessionId and afterAnswerId (null for the opening question).', 400);
  }
  return { sessionId: body.sessionId, afterAnswerId: body.afterAnswerId };
}

export function contextFromSnapshot(snapshot, now = Date.now()) {
  const { session, questions } = snapshot;
  const start = Date.parse(session.started_at);
  if (!Number.isFinite(start) || !Array.isArray(questions)) {
    throw new InterviewerError('SESSION_CONTEXT_INVALID', 'The saved session needs to be repaired before continuing.', 409);
  }
  const history = questions.map((q, index) => {
    if (q.position !== index + 1 || !q.answer) {
      throw new InterviewerError('SESSION_CONTEXT_INVALID', 'The saved question history is incomplete.', 409);
    }
    return { kind: q.kind, topic: q.topic, question: q.content, answer: q.answer.content };
  });
  try {
    return validateInterviewerInput({
      settings: {
        type: session.round_type, difficulty: session.difficulty, language: session.language,
        targetPosition: session.target_position, durationMinutes: session.duration_minutes,
        plannedQuestions: session.planned_questions,
      },
      state: { status: session.status, elapsedSeconds: Math.max(0, (now - start) / 1000) },
      jdText: session.jd_text, cvText: session.cv_text, history,
    });
  } catch {
    throw new InterviewerError('SESSION_CONTEXT_INVALID', 'The saved session context is invalid or too large.', 409);
  }
}

export function createNextService({ repository, provider, now = Date.now }) {
  async function* generate(body, { signal, streaming = false, trace = () => {} } = {}) {
    const request = validateNextRequest(body);
    if (signal?.aborted) throw new InterviewerError('REQUEST_CANCELLED', 'Request cancelled.', 408);
    // Claim is atomic in PostgreSQL; no transaction stays open across an AI call.
    const claim = await repository.claim(request);
    trace('claimed');
    if (claim.kind === 'ready') { trace('replay'); yield { event: 'complete', data: claim.response }; return; }
    if (claim.kind === 'busy') throw new InterviewerError('GENERATION_IN_PROGRESS', 'A question is already being generated. Try this turn again shortly.', 409);
    if (claim.kind !== 'claimed' || !isUuid(claim.token)) throw new InterviewerError('SERVER_ERROR', 'Could not prepare this turn.', 500);
    let release = true;
    try {
      yield { event: 'ready', data: { sessionId: request.sessionId } };
      const context = contextFromSnapshot(claim, now());
      trace('context_ready');
      let decision;
      if (streaming) {
        if (typeof provider.stream !== 'function') throw new InterviewerError('AI_CONFIGURATION_ERROR', 'Streaming is not configured.', 503);
        for await (const item of provider.stream(context, { signal, trace })) {
          if (item.type === 'delta') yield { event: 'delta', data: { text: item.text } };
          else if (item.type === 'decision' && !decision) decision = item.value;
          else throw new InterviewerError('INVALID_OUTPUT', 'The interviewer returned an invalid stream.');
        }
      } else decision = await provider.next(context, { signal, trace });
      decision = validateInterviewerOutput(decision, context);
      trace('decision_validated');
      if (decision.action === 'end') trace('end');
      if (signal?.aborted) throw new InterviewerError('REQUEST_CANCELLED', 'Request cancelled.', 408);
      // From here a failed acknowledgement may hide a successful commit.
      // Leave its reservation intact unless SQL definitively rejected it.
      release = false;
      let result;
      try {
        trace('persistence_started');
        result = await repository.finish(request, claim.token, decision, {
          model: provider.model, promptVersion: PROMPT_VERSION, contextVersion: QUESTION_PLAN_VERSION,
          memoryVersion: CONVERSATION_MEMORY_VERSION,
        });
        trace('persisted');
      } catch (error) {
        if (error instanceof InterviewerError && ['INVALID_OUTPUT', 'STALE_TURN', 'LEASE_LOST'].includes(error.code)) release = true;
        throw error;
      }
      yield { event: 'complete', data: result };
    } finally {
      // Also runs on iterator.return() after a browser disconnect. A catch-only
      // cleanup would leak a lease when the generator is suspended at a delta.
      if (release) await repository.release(request, claim.token).catch(() => {});
    }
  }
  const next = async (body, options) => {
    for await (const item of generate(body, options)) if (item.event === 'complete') return item.data;
    throw new InterviewerError('SERVER_ERROR', 'The interview did not finish.', 500);
  };
  next.stream = (body, options) => generate(body, { ...options, streaming: true });
  return next;
}
