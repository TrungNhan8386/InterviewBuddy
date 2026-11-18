import { QUESTION_PLAN_PROMPT_CONFIG } from '../ai/prompt-config.mjs';
import { questionAngle, questionTerms } from './question-diversity.mjs';

// SCRUM-92: a small, deterministic context selector inspired by EZInterviewer
// and PolyInterview. Lexical overlap selects context; it does NOT prove a skill.
export const QUESTION_PLAN_VERSION = QUESTION_PLAN_PROMPT_CONFIG.version;
const stopWords = new Set(('the and with for from that this have your you are job role work experience skills ' +
  'của và với cho trong một các những được cần có bạn công việc yêu cầu kinh nghiệm').split(/\s+/u));
const shortTechnologies = new Set(['go', 'c#', 'ui', 'ux', 'qa', 'ai', 'ml', 'ci', 'cd']);
const aliases = new Map([['js', 'javascript'], ['ts', 'typescript'], ['nodejs', 'node.js'],
  ['reactjs', 'react'], ['postgres', 'postgresql'], ['.net', 'dotnet'], ['csharp', 'c#'], ['cpp', 'c++']]);
const headings = new Set(['requirements', 'required skills', 'skills', 'qualifications', 'responsibilities',
  'job description', 'preferred skills', 'yêu cầu', 'yêu cầu ứng viên', 'kỹ năng', 'trách nhiệm', 'mô tả công việc']);

function headingKey(text) {
  return text.normalize('NFKC').toLocaleLowerCase('en-US').replace(/^\s*[-*•]+\s*/u, '')
    .replace(/[:.!?]+\s*$/u, '').replace(/\s+/gu, ' ').trim();
}
function isHeading(text, position) {
  const key = headingKey(text);
  const title = key.replace(/^(?:vị trí|position|job title|target position|role)\s*:\s*/u, '');
  return headings.has(key) || title === headingKey(position);
}

function terms(text) {
  return new Set((text.normalize('NFKC').toLocaleLowerCase('en-US')
    .match(/\.net\b|[\p{L}\p{N}]+(?:\.[\p{L}\p{N}]+)*(?:\+\+|#)?/gu) || [])
    .map((word) => aliases.get(word) ?? word)
    .filter((word) => (word.length >= 3 || shortTechnologies.has(word)) && !stopWords.has(word)));
}
function overlap(a, b) { return [...a].filter((word) => b.has(word)).length; }
function passages(text) {
  // Preserve exact passages, including negation. Full documents remain in the
  // validated server context; document-context.mjs projects the model payload.
  return text.split(/\r?\n|;|(?<=[.!?])\s+/u).map((s) => s.trim())
    .filter((s) => s.length >= 2 && s.length <= 1500 && terms(s).size > 0);
}

export function planQuestion(input) {
  const previousTopics = input.history.map((turn) => questionTerms(`${turn.topic} ${turn.question}`));
  const cv = passages(input.cvText || '').map((text) => ({ text, terms: terms(text) }));
  const ranked = passages(input.jdText || '').filter((text) => !isHeading(text, input.settings.targetPosition)).map((text, index) => {
    const tokens = terms(text);
    const coverageTokens = questionTerms(text);
    const covered = previousTopics.reduce((max, topic) => Math.max(max, overlap(coverageTokens, topic)), 0);
    return { text, tokens, index, covered, used: covered >= Math.min(2, coverageTokens.size) };
  }).sort((a, b) => a.covered - b.covered || a.index - b.index);
  const unused = ranked.find(part => !part.used);
  const cvRanked = cv.filter(part => !isHeading(part.text, input.settings.targetPosition)).map((part, index) => ({ ...part, index,
    covered: previousTopics.reduce((max, topic) => Math.max(max, overlap(questionTerms(part.text), topic)), 0),
  })).sort((a, b) => a.covered - b.covered || a.index - b.index);
  const cvFocus = !unused && ranked.length ? cvRanked.find(part => part.covered === 0) : null;
  const focus = unused ?? (cvFocus ? null : ranked[0]);
  const related = focus ? cv.map((part, index) => ({ ...part, index, score: overlap(focus.tokens, part.terms) }))
    .filter((part) => part.score > 0).sort((a, b) => b.score - a.score || a.index - b.index).slice(0, 2) : [];
  const difficultyPolicy = QUESTION_PLAN_PROMPT_CONFIG.difficultyPolicies[input.settings.type]?.[input.settings.difficulty];
  const roundPolicy = QUESTION_PLAN_PROMPT_CONFIG.roundPolicies[input.settings.type];
  const angles = input.settings.type === 'technical' ? ['implementation', 'testing', 'failure_handling', 'tradeoffs', 'performance']
    : ['motivation', 'collaboration', 'decision', 'reflection'];
  const angle = angles.map((id, index) => ({ id, index, count: input.history.filter(turn => questionAngle(turn.question) === id).length }))
    .sort((a, b) => a.count - b.count || a.index - b.index)[0].id;
  return {
    version: QUESTION_PLAN_VERSION,
    basis: cvFocus ? 'cv' : focus ? 'jd' : 'role',
    jdFocus: focus?.text ?? null,
    cvContext: cvFocus ? [cvFocus.text] : related.map((part) => part.text),
    angle,
    difficultyPolicy, roundPolicy,
  };
}
