// Targeted practice questions (UC-10, SCRUM-178): choose the weakest criteria,
// build the bounded AI input and validate the AI output. Pure functions; no
// Next.js, Supabase or network. Contract: docs/api/PRACTICE_API_v1.md
import practicePrompt from '../../config/prompts/practice.json' with { type: 'json' };

export const PRACTICE_CRITERIA = ['content', 'structure', 'clarity', 'confidence'];
export const PRACTICE_LIMITS = { focus: 2, minPerCriterion: 3, maxPerCriterion: 5, question: 300, tip: 160, note: 200, asked: 24 };
// Both weakest criteria at or above this score: "no major weakness" note (UC-10 AF3).
export const STRONG_SCORE = 7.5;

function checkedPrompt(config) {
  const lines = (value) => Array.isArray(value) && value.length > 0 && value.every((l) => typeof l === 'string' && l.trim());
  if (typeof config?.version !== 'string' || !/^[a-zA-Z0-9._-]{1,100}$/u.test(config.version) || !lines(config.system)
      || !lines(config.languageRules?.vi) || !lines(config.languageRules?.en)) {
    const error = new Error('Invalid practice prompt configuration.');
    error.code = 'INVALID_PROMPT_CONFIG';
    throw error;
  }
  return Object.freeze(config);
}

export const PRACTICE_PROMPT_CONFIG = checkedPrompt(practicePrompt);
export const PRACTICE_PROMPT_VERSION = PRACTICE_PROMPT_CONFIG.version;

export function practicePromptText(language) {
  return [...PRACTICE_PROMPT_CONFIG.system, ...PRACTICE_PROMPT_CONFIG.languageRules[language === 'en' ? 'en' : 'vi']].join('\n');
}

/**
 * The two lowest scored criteria of a report (UC-10 step 2). `null` criteria
 * (STAR outside behavioral interviews) are skipped. Ties keep the fixed order
 * content → structure → clarity → confidence, so results are repeatable.
 * Returns [] when fewer than two criteria have a score.
 */
export function pickWeakCriteria(criteria) {
  const scored = PRACTICE_CRITERIA
    .map((name, order) => ({ criterion: name, score: criteria?.[name], order }))
    .filter((c) => typeof c.score === 'number' && Number.isFinite(c.score));
  if (scored.length < PRACTICE_LIMITS.focus) return [];
  return scored.sort((a, b) => a.score - b.score || a.order - b.order)
    .slice(0, PRACTICE_LIMITS.focus)
    .map(({ criterion, score }) => ({ criterion, score: Math.round(score * 10) / 10 }));
}

export function noMajorWeakness(focus) {
  return focus.length > 0 && focus.every((f) => f.score >= STRONG_SCORE);
}

const clip = (value, max) => {
  const text = String(value ?? '').replace(/\s+/gu, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};
const one = (value) => (Array.isArray(value) ? value[0] ?? null : value ?? null);

/** Compact input for the prompt. No CV, JD, answers or account data. */
export function buildPracticeInput(session, focus, questionRows = []) {
  const improvements = [];
  for (const q of questionRows) {
    const feedback = one(one(q.answers)?.feedbacks);
    for (const note of feedback?.improvements ?? []) {
      if (improvements.length < 8) improvements.push(clip(note, PRACTICE_LIMITS.note));
    }
  }
  return {
    language: session.language === 'en' ? 'en' : 'vi',
    interviewType: session.round_type,
    difficulty: session.difficulty,
    targetPosition: clip(session.target_position, 120),
    focus: focus.map((f) => ({ criterion: f.criterion, score: f.score })),
    askedQuestions: [...questionRows].sort((a, b) => a.position - b.position)
      .slice(0, PRACTICE_LIMITS.asked).map((q) => clip(q.content, 300)),
    improvementNotes: improvements,
  };
}

export const PRACTICE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    groups: {
      type: 'array',
      minItems: PRACTICE_LIMITS.focus,
      maxItems: PRACTICE_LIMITS.focus,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          criterion: { type: 'string', enum: PRACTICE_CRITERIA },
          questions: {
            type: 'array',
            minItems: PRACTICE_LIMITS.minPerCriterion,
            maxItems: PRACTICE_LIMITS.maxPerCriterion,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                question: { type: 'string', description: 'One interview question, at most 300 characters.' },
                tip: { type: 'string', description: 'What a strong answer shows, at most 160 characters.' },
              },
              required: ['question', 'tip'],
            },
          },
        },
        required: ['criterion', 'questions'],
      },
    },
  },
  required: ['groups'],
};

const normalized = (s) => s.toLowerCase().normalize('NFC').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/**
 * Validates the AI output against the requested focus. Returns
 * [{ criterion, questions: [{ question, tip }] }] in focus order, or null.
 * Duplicates (also of questions already asked) are dropped; a group that
 * keeps fewer than 3 questions makes the whole output invalid.
 */
export function validatePracticeOutput(value, focus, askedQuestions = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !Array.isArray(value.groups)) return null;
  if (Object.keys(value).length !== 1 || value.groups.length !== focus.length) return null;
  const seen = new Set(askedQuestions.map((q) => normalized(String(q))));
  const groups = [];
  for (const [index, wanted] of focus.entries()) {
    const group = value.groups[index];
    if (!group || typeof group !== 'object' || group.criterion !== wanted.criterion || !Array.isArray(group.questions)) return null;
    const questions = [];
    for (const item of group.questions.slice(0, PRACTICE_LIMITS.maxPerCriterion)) {
      if (!item || typeof item !== 'object' || typeof item.question !== 'string') return null;
      const question = item.question.replace(/\s+/gu, ' ').trim();
      const tip = typeof item.tip === 'string' ? item.tip.replace(/\s+/gu, ' ').trim() : '';
      if (!question || question.length > PRACTICE_LIMITS.question || tip.length > PRACTICE_LIMITS.tip) return null;
      const key = normalized(question);
      if (seen.has(key)) continue;
      seen.add(key);
      questions.push({ question, tip: tip || null });
    }
    if (questions.length < PRACTICE_LIMITS.minPerCriterion) return null;
    groups.push({ criterion: wanted.criterion, questions });
  }
  return groups;
}

/** Rows for the practice_questions table, positions 1..n across both groups. */
export function toPracticeRows(sessionId, language, focus, groups, meta = {}) {
  const scoreOf = new Map(focus.map((f) => [f.criterion, f.score]));
  let position = 0;
  return groups.flatMap((g) => g.questions.map((q) => ({
    session_id: sessionId,
    criterion: g.criterion,
    criterion_score: scoreOf.get(g.criterion) ?? null,
    position: ++position,
    content: q.question,
    tip: q.tip,
    language,
    model: meta.model ?? null,
    prompt_version: meta.promptVersion ?? PRACTICE_PROMPT_VERSION,
  })));
}

/** API response body from saved practice_questions rows (sorted by position). */
export function toPracticeResponse(sessionId, rows, extra = {}) {
  const sorted = [...rows].sort((a, b) => a.position - b.position);
  const groups = [];
  for (const row of sorted) {
    let group = groups.find((g) => g.criterion === row.criterion);
    if (!group) {
      group = { criterion: row.criterion, score: row.criterion_score == null ? null : Number(row.criterion_score), questions: [] };
      groups.push(group);
    }
    group.questions.push({
      id: row.id,
      position: row.position,
      question: row.content,
      tip: row.tip ?? null,
      practiceSessionId: row.practice_session_id ?? null,
    });
  }
  const focus = groups.map((g) => ({ criterion: g.criterion, score: g.score ?? 0 }));
  return {
    sessionId,
    language: sorted[0]?.language === 'en' ? 'en' : 'vi',
    generatedAt: sorted[0]?.created_at ?? null,
    noMajorWeakness: noMajorWeakness(focus),
    groups,
    ...extra,
  };
}
