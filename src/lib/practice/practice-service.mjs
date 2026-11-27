// /api/practice/generate and /api/practice/start (UC-10, SCRUM-178, SCRUM-204).
// Everything runs as the signed-in user (RLS). Scores are taken from the same
// code as the report (buildReport), so the page and the practice set agree.
// One set per session: a saved set is returned again without an AI call
// (UC-10 alternative flow 1). Contract: docs/api/PRACTICE_API_v1.md
import { AiLimitError } from '../ai/daily-limit.mjs';
import { buildReport } from '../report/report-builder.mjs';
import { buildPracticeInput, pickWeakCriteria, toPracticeResponse, toPracticeRows } from './practice-builder.mjs';
import { PracticeAiError } from './practice-provider.mjs';

export const PRACTICE_ERROR_STATUS = {
  BAD_INPUT: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  SESSION_NOT_COMPLETED: 409,
  NOT_ENOUGH_SCORES: 409,
  AI_DAILY_LIMIT: 429,
  AI_RATE_LIMITED: 503,
  AI_UNAVAILABLE: 503,
  AI_TIMEOUT: 503,
  AI_CONTENT_BLOCKED: 502,
  INVALID_OUTPUT: 502,
  AI_NOT_CONFIGURED: 500,
  AI_CONFIGURATION_ERROR: 500,
  DATABASE_NOT_READY: 503,
  SERVER_ERROR: 500,
};

export class PracticeError extends Error {
  constructor(code, details = null) {
    super(code);
    this.name = 'PracticeError';
    this.code = code;
    this.status = PRACTICE_ERROR_STATUS[code] ?? 500;
    this.details = details; // { resetAt } for AI_DAILY_LIMIT
  }
}

const SESSION_COLUMNS = 'id, status, round_type, difficulty, language, target_position, started_at, ended_at';
const QUESTION_COLUMNS = 'id, position, kind, topic, content, created_at, '
  + 'answers (id, content, input_mode, duration_seconds, word_count, created_at, '
  + 'feedbacks (content_score, structure_score, clarity_score, confidence_score, overall_score, strengths, improvements))';
const PRACTICE_COLUMNS = 'id, criterion, criterion_score, position, content, tip, language, practice_session_id, created_at';

// The migration 20261124000000_practice_questions.sql has not been applied yet.
const MISSING = new Set(['42P01', 'PGRST205', '42883', 'PGRST202', '42703']);

/** Supabase access as the signed-in user. Every query is limited by RLS. */
export function createPracticeRepository(supabase) {
  const check = (result) => {
    if (result.error) {
      if (MISSING.has(result.error.code)) throw new PracticeError('DATABASE_NOT_READY');
      throw Object.assign(new PracticeError('SERVER_ERROR'), { dbCode: result.error.code });
    }
    return result.data;
  };
  return {
    async session(id) {
      return check(await supabase.from('interview_sessions').select(SESSION_COLUMNS).eq('id', id).maybeSingle());
    },
    async questions(id) {
      return check(await supabase.from('questions').select(QUESTION_COLUMNS).eq('session_id', id).order('position'));
    },
    async saved(id) {
      return check(await supabase.from('practice_questions').select(PRACTICE_COLUMNS).eq('session_id', id).order('position'));
    },
    /** Inserts the whole set in one statement. Returns null if another request saved a set first. */
    async insert(rows) {
      const result = await supabase.from('practice_questions').insert(rows).select(PRACTICE_COLUMNS);
      if (result.error?.code === '23505') return null;
      return check(result);
    },
    // mode 'single': only this question (UC10-02). mode 'all': every saved question
    // of the report in list order, starting with this one (UC10-03).
    async start(practiceQuestionId, mode = 'single') {
      const args = { p_practice_question_id: practiceQuestionId };
      if (mode !== 'single') args.p_mode = mode;
      const data = check(await supabase.rpc('start_practice_session', args));
      if (!data || typeof data !== 'object') throw new PracticeError('SERVER_ERROR');
      if (data.error) {
        throw new PracticeError(data.error === 'NOT_FOUND' ? 'NOT_FOUND' : data.error === 'BAD_INPUT' ? 'BAD_INPUT' : 'SERVER_ERROR');
      }
      return { sessionId: data.sessionId, resumed: Boolean(data.resumed) };
    },
  };
}

export function createPracticeService({ repository, provider, consume }) {
  async function completedSession(sessionId) {
    const session = await repository.session(sessionId);
    if (!session) throw new PracticeError('NOT_FOUND');
    if (session.status !== 'completed') throw new PracticeError('SESSION_NOT_COMPLETED');
    return session;
  }

  /** GET: the saved set, or state "not_generated". Never calls the AI. */
  async function read(sessionId) {
    await completedSession(sessionId);
    const rows = await repository.saved(sessionId);
    if (!rows?.length) return { sessionId, state: 'not_generated', groups: [] };
    return toPracticeResponse(sessionId, rows, { state: 'ready', alreadySaved: true });
  }

  /** POST: return the saved set, or generate, save and return a new one. */
  async function generate(sessionId, { signal } = {}) {
    const session = await completedSession(sessionId);
    const saved = await repository.saved(sessionId);
    if (saved?.length) return toPracticeResponse(sessionId, saved, { state: 'ready', alreadySaved: true });

    const questions = (await repository.questions(sessionId)) ?? [];
    let report;
    try {
      report = buildReport(session, questions, null);
    } catch (error) {
      if (error.code === 'NO_SCORED_ANSWERS') throw new PracticeError('NOT_ENOUGH_SCORES');
      throw error;
    }
    const focus = pickWeakCriteria(report.criteria);
    if (!focus.length) throw new PracticeError('NOT_ENOUGH_SCORES');

    const input = buildPracticeInput(session, focus, questions);
    try {
      await consume();
    } catch (error) {
      if (error instanceof AiLimitError && error.code === 'AI_DAILY_LIMIT') {
        throw new PracticeError('AI_DAILY_LIMIT', { resetAt: error.usage?.resetAt ?? null });
      }
      if (error instanceof AiLimitError && error.code === 'DATABASE_NOT_READY') throw new PracticeError('DATABASE_NOT_READY');
      throw new PracticeError('AI_UNAVAILABLE');
    }
    let groups;
    try {
      groups = await provider.generate(input, { signal });
    } catch (error) {
      if (error instanceof PracticeAiError) throw new PracticeError(error.code);
      throw new PracticeError('AI_UNAVAILABLE');
    }

    const rows = toPracticeRows(sessionId, input.language, focus, groups, { model: provider.model });
    const inserted = await repository.insert(rows);
    // Another tab saved a set at the same time: show that one (UC-10 AF1).
    const final = inserted ?? (await repository.saved(sessionId));
    return toPracticeResponse(sessionId, final ?? [], { state: 'ready', alreadySaved: !inserted });
  }

  async function start(practiceQuestionId, mode = 'single') {
    return repository.start(practiceQuestionId, mode);
  }

  return { read, generate, start };
}
