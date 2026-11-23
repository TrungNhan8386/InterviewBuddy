// Interview report (UC-09, SCRUM-187, SCRUM-189, SCRUM-190): scores, speaking
// indicators and the question timeline, computed in code from the saved
// questions, answers and feedbacks. Pure functions; no Next.js or Supabase.
// Contract: docs/api/REPORT_API_v1.md

export const CRITERIA = ['content', 'structure', 'clarity', 'confidence'];

// Column of the feedbacks table for each criterion.
const CRITERION_COLUMN = {
  content: 'content_score',
  structure: 'structure_score',
  clarity: 'clarity_score',
  confidence: 'confidence_score',
};

// Common spoken fillers. Counted as whole words or phrases, case-insensitive.
// Typed answers rarely contain them, so the count matters most for voice answers.
export const FILLER_WORDS = {
  vi: ['à', 'ừ', 'ừm', 'ờ', 'ơ', 'kiểu', 'kiểu như', 'thì là', 'nói chung', 'đại loại', 'thật ra', 'thực ra'],
  en: ['um', 'uh', 'er', 'erm', 'hmm', 'like', 'you know', 'i mean', 'basically', 'actually', 'sort of', 'kind of'],
};

const round1 = (value) => Math.round(value * 10) / 10;
const average = (values) => (values.length ? round1(values.reduce((a, b) => a + b, 0) / values.length) : null);
const one = (value) => (Array.isArray(value) ? value[0] ?? null : value ?? null);

/** Number of words, split on whitespace. */
export function countWords(text) {
  const trimmed = typeof text === 'string' ? text.trim() : '';
  return trimmed ? trimmed.split(/\s+/u).length : 0;
}

/** Filler words in the given texts: total and the most frequent ones. */
export function countFillers(texts, language = 'vi') {
  const fillers = FILLER_WORDS[language === 'en' ? 'en' : 'vi'];
  const counts = new Map();
  for (const raw of texts) {
    const text = ` ${String(raw ?? '').toLowerCase().normalize('NFC').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/gu, ' ')} `;
    for (const filler of fillers) {
      // Count each filler separately; a phrase like "kiểu như" also contains "kiểu".
      let index = text.indexOf(` ${filler} `);
      while (index >= 0) {
        counts.set(filler, (counts.get(filler) ?? 0) + 1);
        index = text.indexOf(` ${filler} `, index + filler.length + 1);
      }
    }
  }
  // A phrase match ("kiểu như") should not be counted again as its first word ("kiểu").
  for (const phrase of fillers.filter((f) => f.includes(' '))) {
    const first = phrase.split(' ')[0];
    if (counts.has(first) && counts.has(phrase)) {
      const rest = counts.get(first) - counts.get(phrase);
      if (rest > 0) counts.set(first, rest); else counts.delete(first);
    }
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5).map(([word, count]) => ({ word, count }));
  return { total: [...counts.values()].reduce((a, b) => a + b, 0), top };
}

/**
 * Turns the saved rows into report data.
 * - session: interview_sessions row (round_type, language, started_at, ended_at, ...)
 * - questionRows: questions with nested answers (one-to-one) and their feedbacks
 * - previous: { sessionId, overallScore } of the user's previous reported session, or null
 * Throws { code: 'NO_SCORED_ANSWERS' } when no answer has feedback yet.
 */
export function buildReport(session, questionRows, previous = null) {
  const startedAt = Date.parse(session.started_at);
  const turns = [...questionRows].sort((a, b) => a.position - b.position).map((q) => {
    const answer = one(q.answers);
    const feedback = answer ? one(answer.feedbacks) : null;
    return { q, answer, feedback };
  });

  const answered = turns.filter((t) => t.answer);
  const scored = answered.filter((t) => t.feedback);
  if (!scored.length) {
    const error = new Error('No answer of this session has been scored yet.');
    error.code = 'NO_SCORED_ANSWERS';
    throw error;
  }

  // STAR structure is only scored for behavioral interviews (UC-08 rubric).
  const structureApplies = session.round_type === 'behavioral';
  const criteria = {};
  for (const name of CRITERIA) {
    if (name === 'structure' && !structureApplies) { criteria[name] = null; continue; }
    const values = scored.map((t) => t.feedback[CRITERION_COLUMN[name]]).filter((v) => typeof v === 'number' || (typeof v === 'string' && v !== ''));
    criteria[name] = average(values.map(Number));
  }
  const overallScore = average(scored.map((t) => Number(t.feedback.overall_score)));

  const answerTexts = answered.map((t) => t.answer.content ?? '');
  const words = answered.map((t) => (Number.isInteger(t.answer.word_count) ? t.answer.word_count : countWords(t.answer.content)));
  const totalWords = words.reduce((a, b) => a + b, 0);
  const timed = answered.filter((t) => Number(t.answer.duration_seconds) > 0);
  const timedWords = timed.reduce((sum, t) => sum + (Number.isInteger(t.answer.word_count) ? t.answer.word_count : countWords(t.answer.content)), 0);
  const timedSeconds = timed.reduce((sum, t) => sum + Number(t.answer.duration_seconds), 0);
  const fillers = countFillers(answerTexts, session.language);
  const speaking = {
    answeredQuestions: answered.length,
    totalWords,
    avgAnswerWords: answered.length ? Math.round(totalWords / answered.length) : 0,
    fillerWords: {
      total: fillers.total,
      per100Words: totalWords ? round1((fillers.total / totalWords) * 100) : 0,
      top: fillers.top,
    },
    // Speaking pace needs answer durations (voice answers, UC-07).
    paceAvailable: timed.length > 0,
    timedAnswers: timed.length,
    wordsPerMinute: timedSeconds > 0 ? Math.round(timedWords / (timedSeconds / 60)) : null,
  };

  const timeline = turns.map(({ q, answer, feedback }) => {
    const askedAt = q.created_at ?? null;
    const offset = askedAt && Number.isFinite(startedAt) ? Math.max(0, Math.round((Date.parse(askedAt) - startedAt) / 1000)) : null;
    return {
      position: q.position,
      kind: q.kind,
      topic: q.topic ?? null,
      question: q.content,
      askedAt,
      offsetSeconds: offset,
      answered: Boolean(answer),
      answerWords: answer ? (Number.isInteger(answer.word_count) ? answer.word_count : countWords(answer.content)) : 0,
      durationSeconds: answer && answer.duration_seconds != null ? Number(answer.duration_seconds) : null,
      score: feedback ? Number(feedback.overall_score) : null,
      scores: feedback ? Object.fromEntries(CRITERIA.map((name) => [
        name,
        name === 'structure' && !structureApplies ? null : Number(feedback[CRITERION_COLUMN[name]]),
      ])) : null,
    };
  });

  const ended = Date.parse(session.ended_at);
  return {
    overview: {
      overallScore,
      scale: 10,
      mainQuestions: turns.filter((t) => t.q.kind === 'main').length,
      followUps: turns.filter((t) => t.q.kind === 'follow_up').length,
      answeredQuestions: answered.length,
      scoredAnswers: scored.length,
      startedAt: session.started_at ?? null,
      endedAt: session.ended_at ?? null,
      durationSeconds: Number.isFinite(startedAt) && Number.isFinite(ended) ? Math.max(0, Math.round((ended - startedAt) / 1000)) : null,
      trend: previous && previous.overallScore != null && overallScore != null
        ? { previousSessionId: previous.sessionId, previousOverallScore: Number(previous.overallScore), change: round1(overallScore - Number(previous.overallScore)) }
        : null,
    },
    criteria,
    structureApplies,
    speaking,
    timeline,
  };
}

/** The reports row saved for the session (snake_case JSON as in the schema comments). */
export function toReportRow(sessionId, report, summary) {
  return {
    session_id: sessionId,
    overall_score: report.overview.overallScore,
    criteria_scores: report.criteria,
    speaking_metrics: {
      filler_words: report.speaking.fillerWords.total,
      filler_words_per_100: report.speaking.fillerWords.per100Words,
      words_per_minute: report.speaking.wordsPerMinute,
      avg_answer_words: report.speaking.avgAnswerWords,
      timed_answers: report.speaking.timedAnswers,
    },
    strengths: summary?.strengths ?? [],
    improvements: summary?.improvements ?? [],
    summary: summary?.text ?? null,
  };
}

// ---------------------------------------------------------------------------
// AI summary of the whole session (SCRUM-190)
// ---------------------------------------------------------------------------

export const SUMMARY_LIMITS = { text: 800, items: 3, item: 240, question: 400, answer: 700, note: 200 };

const clip = (value, max) => {
  const text = String(value ?? '').replace(/\s+/gu, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

/** Compact, bounded input for the summary prompt. No CV, JD or account data. */
export function buildSummaryInput(session, report, questionRows) {
  const byPosition = new Map([...questionRows].map((q) => [q.position, q]));
  return {
    language: session.language === 'en' ? 'en' : 'vi',
    interviewType: session.round_type,
    difficulty: session.difficulty,
    targetPosition: clip(session.target_position, 120),
    overallScore: report.overview.overallScore,
    criteria: report.criteria,
    speaking: {
      avgAnswerWords: report.speaking.avgAnswerWords,
      fillerWords: report.speaking.fillerWords.total,
      wordsPerMinute: report.speaking.wordsPerMinute,
    },
    turns: report.timeline.filter((t) => t.answered).slice(0, 24).map((t) => {
      const answer = one(byPosition.get(t.position)?.answers);
      const feedback = answer ? one(answer.feedbacks) : null;
      return {
        kind: t.kind,
        topic: clip(t.topic, 120),
        question: clip(t.question, SUMMARY_LIMITS.question),
        answer: clip(answer?.content, SUMMARY_LIMITS.answer),
        score: t.score,
        strengths: (feedback?.strengths ?? []).slice(0, 3).map((s) => clip(s, SUMMARY_LIMITS.note)),
        improvements: (feedback?.improvements ?? []).slice(0, 3).map((s) => clip(s, SUMMARY_LIMITS.note)),
      };
    }),
  };
}

export const SUMMARY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: { type: 'string', description: 'Two or three sentences about the whole session.' },
    strengths: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 3 },
    improvements: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 3 },
  },
  required: ['summary', 'strengths', 'improvements'],
};

/** Validates the AI output; returns { text, strengths, improvements } or null. */
export function validateSummary(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const keys = Object.keys(value);
  if (keys.length !== 3 || !['summary', 'strengths', 'improvements'].every((k) => keys.includes(k))) return null;
  const okText = (s, max) => typeof s === 'string' && s.trim().length > 0 && s.trim().length <= max;
  const okList = (list) => Array.isArray(list) && list.length >= 1 && list.length <= SUMMARY_LIMITS.items
    && list.every((s) => okText(s, SUMMARY_LIMITS.item));
  if (!okText(value.summary, SUMMARY_LIMITS.text) || !okList(value.strengths) || !okList(value.improvements)) return null;
  return {
    text: value.summary.trim(),
    strengths: value.strengths.map((s) => s.trim()),
    improvements: value.improvements.map((s) => s.trim()),
  };
}
