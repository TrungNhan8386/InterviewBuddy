// Interview Session API contract (SCRUM-56): allowed values, request validation
// and the mapping between the API (camelCase) and the database (snake_case).
// Pure functions with no Next.js or Supabase imports, so `npm test` can run them.
// Full contract: docs/api/INTERVIEW_SESSION_API_v1.md

export const INTERVIEW_TYPES = ['hr', 'technical', 'behavioral'];
export const DIFFICULTIES = ['easy', 'medium', 'hard'];
export const LANGUAGES = ['vi', 'en'];
export const DURATIONS = [15, 30, 45];
export const INPUT_MODES = ['text', 'voice'];

// The interview engine stops after this many main questions.
export const QUESTIONS_BY_DURATION = { 15: 5, 30: 8, 45: 12 };

export const TARGET_POSITION_MAX = 120;

const ALLOWED_FIELDS = [
  'type', 'difficulty', 'language', 'targetPosition',
  'interviewDate', 'durationMinutes', 'inputMode', 'fitAnalysisId',
];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isUuid(value) {
  return typeof value === 'string' && UUID.test(value);
}

function isRealDate(value) {
  const m = typeof value === 'string' && ISO_DATE.exec(value);
  if (!m) return false;
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return date.toISOString().slice(0, 10) === value;
}

// Today's date (YYYY-MM-DD) for Vietnamese users, whatever time zone the server runs in.
export function todayInVietnam(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(now);
}

/**
 * Validates the body of POST /api/interview.
 * `today` is a YYYY-MM-DD string; interviewDate must not be earlier (UC-05, alternative flow 4).
 * fitAnalysisId: omitted = link the latest analysis, null = no analysis, uuid = that analysis.
 */
export function validateCreateSession(body, { today }) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, fields: { body: 'Request body must be a JSON object.' } };
  }

  const fields = {};
  for (const key of Object.keys(body)) {
    if (!ALLOWED_FIELDS.includes(key)) fields[key] = 'Unknown field.';
  }

  const oneOf = (key, allowed) => {
    if (!allowed.includes(body[key])) fields[key] = `Must be one of: ${allowed.join(', ')}.`;
  };
  oneOf('type', INTERVIEW_TYPES);
  oneOf('difficulty', DIFFICULTIES);
  oneOf('language', LANGUAGES);
  oneOf('durationMinutes', DURATIONS);
  oneOf('inputMode', INPUT_MODES);

  const position = typeof body.targetPosition === 'string' ? body.targetPosition.trim() : '';
  if (!position) {
    fields.targetPosition = 'Required.';
  } else if (position.length > TARGET_POSITION_MAX) {
    fields.targetPosition = `At most ${TARGET_POSITION_MAX} characters.`;
  }

  const date = body.interviewDate ?? null;
  if (date !== null) {
    if (!isRealDate(date)) fields.interviewDate = 'Must be a date in YYYY-MM-DD format, or null.';
    else if (date < today) fields.interviewDate = 'Must be today or later.';
  }

  if (body.fitAnalysisId !== undefined && body.fitAnalysisId !== null && !isUuid(body.fitAnalysisId)) {
    fields.fitAnalysisId = 'Must be a UUID, null, or omitted.';
  }

  if (Object.keys(fields).length > 0) return { ok: false, fields };

  return {
    ok: true,
    value: {
      type: body.type,
      difficulty: body.difficulty,
      language: body.language,
      targetPosition: position,
      interviewDate: date,
      durationMinutes: body.durationMinutes,
      inputMode: body.inputMode,
      fitAnalysisId: body.fitAnalysisId,
    },
  };
}

/** Database row for public.interview_sessions from validated settings. */
export function toSessionRow(value, { userId, analysis }) {
  return {
    user_id: userId,
    round_type: value.type,
    difficulty: value.difficulty,
    language: value.language,
    target_position: value.targetPosition,
    interview_date: value.interviewDate,
    duration_minutes: value.durationMinutes,
    input_mode: value.inputMode,
    planned_questions: QUESTIONS_BY_DURATION[value.durationMinutes],
    title: `${value.targetPosition} – ${value.type}`,
    fit_analysis_id: analysis?.id ?? null,
    // Snapshot, so the session keeps working if the analysis is deleted later.
    jd_text: analysis?.jd_text ?? null,
    cv_text: analysis?.cv_text ?? null,
  };
}

/** Response body of GET /api/interview/{id}. */
export function toSessionResponse(row) {
  const analysis = row.fit_analyses ?? null;
  return {
    id: row.id,
    status: row.status,
    createdAt: row.created_at,
    startedAt: row.started_at ?? null,
    endedAt: row.ended_at ?? null,
    settings: {
      type: row.round_type,
      difficulty: row.difficulty,
      language: row.language,
      targetPosition: row.target_position,
      interviewDate: row.interview_date,
      durationMinutes: row.duration_minutes,
      inputMode: row.input_mode,
      plannedQuestions: row.planned_questions,
    },
    analysis: analysis && {
      id: analysis.id,
      fitScore: analysis.fit_score,
      language: analysis.language,
      createdAt: analysis.created_at,
      result: analysis.result,
    },
  };
}

// ---------------------------------------------------------------------------
// Answers and resume (SCRUM-80)
// ---------------------------------------------------------------------------

export const ANSWER_MAX = 12000; // same limit as the AI interviewer input
export const ANSWER_DURATION_MAX = 3600;

const ANSWER_FIELDS = ['questionId', 'content', 'inputMode', 'durationSeconds'];

/** Validates the body of POST /api/interview/{id}/answers. */
export function validateSaveAnswer(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, fields: { body: 'Send a JSON object.' } };
  }
  const fields = {};
  for (const key of Object.keys(body)) {
    if (!ANSWER_FIELDS.includes(key)) fields[key] = 'Unknown field.';
  }
  if (!isUuid(body.questionId)) fields.questionId = 'Must be the id of the current question.';
  const content = typeof body.content === 'string' ? body.content.trim() : '';
  if (!content) fields.content = 'Required.';
  else if (content.length > ANSWER_MAX) fields.content = `At most ${ANSWER_MAX} characters.`;
  const inputMode = body.inputMode ?? 'text';
  if (!INPUT_MODES.includes(inputMode)) fields.inputMode = `One of: ${INPUT_MODES.join(', ')}.`;
  const duration = body.durationSeconds ?? null;
  if (duration !== null && (typeof duration !== 'number' || !Number.isFinite(duration)
      || duration < 0 || duration > ANSWER_DURATION_MAX)) {
    fields.durationSeconds = `A number from 0 to ${ANSWER_DURATION_MAX}, or null.`;
  }
  if (Object.keys(fields).length) return { ok: false, fields };
  return { ok: true, value: { questionId: body.questionId, content, inputMode, durationSeconds: duration } };
}

/** Questions (ordered by position, each with its answer or null) in API shape. */
export function toTurns(questionRows) {
  return [...questionRows]
    .sort((a, b) => a.position - b.position)
    .map((q) => {
      // PostgREST returns a one-to-one embed as an object; accept an array too.
      const answer = Array.isArray(q.answers) ? q.answers[0] ?? null : q.answers ?? null;
      return {
        question: {
          id: q.id, position: q.position, kind: q.kind, topic: q.topic ?? null,
          content: q.content, createdAt: q.created_at,
        },
        answer: answer && {
          id: answer.id, content: answer.content, inputMode: answer.input_mode,
          durationSeconds: answer.duration_seconds == null ? null : Number(answer.duration_seconds),
          createdAt: answer.created_at,
        },
      };
    });
}

/**
 * What the chat page should do when it opens (or reopens) a session:
 * - not_started:       POST /api/interview/next { sessionId, afterAnswerId: null }
 * - awaiting_answer:   show `questionId` and wait for the user's answer
 * - awaiting_question: POST /api/interview/next { sessionId, afterAnswerId }
 * - finished:          show the end of the interview
 */
export function toResumeState(status, turns) {
  if (status !== 'in_progress') return { state: 'finished' };
  const last = turns.at(-1);
  if (!last) return { state: 'not_started', afterAnswerId: null };
  if (!last.answer) return { state: 'awaiting_answer', questionId: last.question.id };
  return { state: 'awaiting_question', afterAnswerId: last.answer.id };
}

/** Counts shown in the chat header ("Question 3 of 8"). */
export function toProgress(turns, plannedQuestions) {
  const main = turns.filter((t) => t.question.kind === 'main');
  return {
    mainQuestionsAsked: main.length,
    mainQuestionsAnswered: main.filter((t) => t.answer).length,
    plannedQuestions,
  };
}
