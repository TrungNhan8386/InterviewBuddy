// GET /api/report/{sessionId} (UC-09, SCRUM-186): load the saved session as the
// signed-in user (RLS), compute the report in code, ask Gemini once for the
// session summary and save the result in the reports table.
// Scores and indicators are recomputed on every request from the feedbacks, so
// they never go stale. The AI summary is written once; when it failed, it is
// only tried again when the page asks for it (?retry=summary), so reopening a
// report never spends the daily AI limit by itself.
import { AiLimitError } from '../ai/daily-limit.mjs';
import { buildReport, buildSummaryInput, toReportRow } from './report-builder.mjs';
import { ReportSummaryError } from './report-summary.mjs';

export class ReportError extends Error {
  constructor(code, status) {
    super(code);
    this.name = 'ReportError';
    this.code = code; // NOT_FOUND | SESSION_NOT_COMPLETED | NO_SCORED_ANSWERS | SERVER_ERROR
    this.status = status;
  }
}

const SESSION_COLUMNS = 'id, status, round_type, difficulty, language, target_position, duration_minutes, started_at, ended_at';
const QUESTION_COLUMNS = 'id, position, kind, topic, content, created_at, '
  + 'answers (id, content, input_mode, duration_seconds, word_count, created_at, '
  + 'feedbacks (content_score, structure_score, clarity_score, confidence_score, overall_score, strengths, improvements))';

/** Supabase access as the signed-in user. Every query is limited by RLS. */
export function createReportRepository(supabase) {
  const check = (result) => {
    if (result.error) throw new ReportError('SERVER_ERROR', 500);
    return result.data;
  };
  return {
    async session(id) {
      return check(await supabase.from('interview_sessions').select(SESSION_COLUMNS).eq('id', id).maybeSingle());
    },
    async questions(id) {
      return check(await supabase.from('questions').select(QUESTION_COLUMNS).eq('session_id', id).order('position'));
    },
    async savedReport(id) {
      return check(await supabase.from('reports').select('summary, strengths, improvements, created_at').eq('session_id', id).maybeSingle());
    },
    // The most recent earlier completed session that already has a report.
    async previous(session) {
      if (!session.ended_at) return null;
      const rows = check(await supabase.from('interview_sessions')
        .select('id, ended_at, reports (overall_score)')
        .eq('status', 'completed').neq('id', session.id).lt('ended_at', session.ended_at)
        .order('ended_at', { ascending: false }).limit(10));
      for (const row of rows ?? []) {
        const report = Array.isArray(row.reports) ? row.reports[0] : row.reports;
        if (report?.overall_score != null) return { sessionId: row.id, overallScore: Number(report.overall_score) };
      }
      return null;
    },
    async save(row) {
      return check(await supabase.from('reports').upsert(row, { onConflict: 'session_id' }).select('created_at').single());
    },
  };
}

export function createReportService({ repository, provider, consume, now = () => new Date() }) {
  return async function getReport(sessionId, { retrySummary = false, signal } = {}) {
    const session = await repository.session(sessionId);
    if (!session) throw new ReportError('NOT_FOUND', 404);
    if (session.status !== 'completed') throw new ReportError('SESSION_NOT_COMPLETED', 409);

    const [questions, saved, previous] = await Promise.all([
      repository.questions(sessionId), repository.savedReport(sessionId), repository.previous(session),
    ]);
    let report;
    try {
      report = buildReport(session, questions ?? [], previous);
    } catch (error) {
      if (error.code === 'NO_SCORED_ANSWERS') throw new ReportError('NO_SCORED_ANSWERS', 409);
      throw error;
    }

    // Reuse the saved summary. Ask Gemini only for a new report, or when the
    // Candidate presses "Try again" after a failed summary (UC-09 AF2).
    let summary = saved?.summary ? { text: saved.summary, strengths: saved.strengths ?? [], improvements: saved.improvements ?? [] } : null;
    let summaryError = null;
    if (!summary && (!saved || retrySummary)) {
      try {
        await consume();
        summary = await provider.summarize(buildSummaryInput(session, report, questions ?? []), { signal });
      } catch (error) {
        if (error instanceof AiLimitError) summaryError = error.code === 'AI_DAILY_LIMIT' ? 'AI_DAILY_LIMIT' : 'AI_UNAVAILABLE';
        else if (error instanceof ReportSummaryError) summaryError = error.code;
        else summaryError = 'AI_UNAVAILABLE';
      }
    } else if (!summary) {
      summaryError = 'SUMMARY_NOT_GENERATED';
    }

    const stored = await repository.save(toReportRow(sessionId, report, summary));
    return {
      sessionId,
      generatedAt: stored?.created_at ?? now().toISOString(),
      settings: {
        type: session.round_type,
        difficulty: session.difficulty,
        language: session.language,
        targetPosition: session.target_position,
        durationMinutes: session.duration_minutes,
      },
      overview: report.overview,
      criteria: report.criteria,
      structureApplies: report.structureApplies,
      speaking: report.speaking,
      summary: summary
        ? { status: 'ready', text: summary.text, strengths: summary.strengths, improvements: summary.improvements }
        : { status: 'unavailable', errorCode: summaryError, text: null, strengths: [], improvements: [] },
      timeline: report.timeline,
    };
  };
}
