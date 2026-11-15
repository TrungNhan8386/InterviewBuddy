// Synthetic provider A/B comparison. This is NOT the authenticated Chat/Supabase
// acceptance test. No automatic retry; unsuccessful requests stay in the sample.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createInterviewerProvider } from '../lib/interview/interviewer-provider.mjs';
import { buildInterviewerRequest, PROMPT_VERSION } from '../lib/interview/interviewer-prompt.mjs';
import { interviewFlowFixtures } from '../lib/interview/interview-flow-fixtures.mjs';
import { interviewerFixtures } from '../lib/interview/interviewer-fixtures.mjs';

const args = process.argv.slice(2);
const option = (name) => args.includes(name) ? args[args.indexOf(name) + 1] : null;
const baselineRoot = option('--baseline');
const output = resolve(option('--out') || '../../tmp/interview-latency-ab.json');
const live = args.includes('--live');
if (!baselineRoot) throw new Error('Supply --baseline <frozen source lib directory> [--live] [--out <json>].');
const baseline = await import(pathToFileURL(resolve(baselineRoot, 'interview/interviewer-provider.mjs')).href);
const baselinePrompt = await import(pathToFileURL(resolve(baselineRoot, 'interview/interviewer-prompt.mjs')).href);
const opening = structuredClone(interviewerFixtures[0].input);
opening.history = [];
const long = structuredClone(opening);
long.cvText = [
  'Synthetic frontend candidate. React, TypeScript, Node.js and PostgreSQL.',
  ...Array.from({ length: 85 }, (_, i) => `Archive activity ${i}: prepared printed catalogues for an exhibition and organised historical collection records with a local volunteer group.`),
  'Built React forms with client-side validation, Node.js REST endpoints and API integration tests.',
  'I have not implemented PostgreSQL isolation or locking in production.',
].join('\n');
const cases = [
  { id: 'opening-vi-short', expectedActions: ['next_topic'], input: opening },
  { id: 'opening-en-short', expectedActions: ['next_topic'], input: { ...opening, settings: { ...opening.settings, language: 'en' } } },
  ...interviewFlowFixtures.filter((entry) => !entry.expectedActions.includes('end')),
  { id: 'opening-vi-long', expectedActions: ['next_topic'], input: long },
  { id: 'opening-en-long', expectedActions: ['next_topic'], input: { ...long, settings: { ...long.settings, language: 'en' } } },
];
const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const half = Math.floor(sorted.length / 2);
  return Math.round((sorted.length % 2 ? sorted[half] : (sorted[half - 1] + sorted[half]) / 2) * 10) / 10;
};
const report = { dateLocal: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date()),
  boundary: 'Direct real Gemini provider A/B; synthetic data, no product UI, authentication or Supabase persistence.',
  needsIndependentContentReview: true,
  baselinePromptVersion: baselinePrompt.PROMPT_VERSION, candidatePromptVersion: PROMPT_VERSION,
  model: process.env.GEMINI_INTERVIEW_MODEL || process.env.GEMINI_MODEL,
  live, pacingSeconds: 8, order: 'AB/BA alternates for each paired input', attempts: [], cases: cases.map((entry) => ({
    id: entry.id, language: entry.input.settings.language, cvCharacters: entry.input.cvText.length,
    baselineRequestCharacters: JSON.stringify(baselinePrompt.buildInterviewerRequest(entry.input)).length,
    candidateRequestCharacters: JSON.stringify(buildInterviewerRequest(entry.input)).length,
    expectedActions: entry.expectedActions,
  })) };
await mkdir(dirname(output), { recursive: true });
const save = () => writeFile(output, JSON.stringify(report, null, 2));
let previousStart = 0;
if (live) for (const [index, entry] of cases.entries()) {
  const variants = index % 2 ? ['candidate', 'baseline'] : ['baseline', 'candidate'];
  for (const variant of variants) {
    const remaining = 8000 - (performance.now() - previousStart);
    if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
    previousStart = performance.now();
    const stages = {}; let firstTextMs = null; let text = ''; let decision;
    const start = performance.now();
    const provider = (variant === 'candidate' ? createInterviewerProvider : baseline.createInterviewerProvider)();
    const attempt = { case: entry.id, variant, expectedActions: entry.expectedActions, valid: false };
    try {
      for await (const part of provider.stream(entry.input, { trace: (stage) => { stages[stage] = Math.round(performance.now() - start); } })) {
        if (part.type === 'delta') {
          text += part.text;
          if (firstTextMs === null && /[\p{L}\p{N}]/u.test(text)) firstTextMs = Math.round(performance.now() - start);
        } else decision = part.value;
      }
      Object.assign(attempt, { valid: Boolean(decision && decision.question?.startsWith(text)),
        expectedAction: entry.expectedActions.includes(decision?.action), decision });
    } catch (error) { attempt.errorCode = /^[A-Z_]+$/.test(error.code ?? '') ? error.code : 'UNEXPECTED_ERROR'; }
    Object.assign(attempt, { firstTextMs, completeMs: Math.round(performance.now() - start), stages });
    report.attempts.push(attempt); await save();
    console.log(JSON.stringify({ case: attempt.case, variant, valid: attempt.valid,
      expectedAction: attempt.expectedAction, firstTextMs, completeMs: attempt.completeMs, errorCode: attempt.errorCode }));
  }
}
report.summary = Object.fromEntries(['baseline', 'candidate'].map((variant) => {
  const rows = report.attempts.filter((row) => row.variant === variant);
  const valid = rows.filter((row) => row.valid);
  return [variant, { attempts: rows.length, valid: valid.length, expectedActions: rows.filter((row) => row.valid && row.expectedAction).length,
    firstTextP50Ms: median(valid.map((row) => row.firstTextMs).filter((ms) => ms !== null)),
    completeP50Ms: median(valid.map((row) => row.completeMs)),
    fastAndValid: valid.filter((row) => row.firstTextMs !== null && row.firstTextMs <= 2000).length,
  }];
}));
await save(); console.log(JSON.stringify({ live, cases: report.cases, summary: report.summary }));
if (live && report.attempts.some((row) => !row.valid || !row.expectedAction)) process.exitCode = 1;
