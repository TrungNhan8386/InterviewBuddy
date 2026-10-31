import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { interviewerFixtures } from '../lib/interview/interviewer-fixtures.mjs';
import { CONTRACT_VERSION, InterviewerError, validateInterviewerInput } from '../lib/interview/interviewer-contract.mjs';
import { buildInterviewerRequest, PROMPT_VERSION } from '../lib/interview/interviewer-prompt.mjs';
import { createInterviewerProvider } from '../lib/interview/interviewer-provider.mjs';

// SCRUM-68: fixed synthetic dataset, two independent repetitions, no DB or real CV reads.
const args = process.argv.slice(2);
if (args.some((arg) => arg !== '--live') || args.length > 1) {
  console.error('Usage: node scripts/evaluate-interviewer.mjs [--live]');
  process.exit(2);
}
const live = args.includes('--live');
const fixtures = interviewerFixtures.filter((fixture) => ['good', 'vague', 'off_topic'].includes(fixture.quality));
if (fixtures.length !== 9 || new Set(fixtures.map((fixture) => fixture.input.settings.targetPosition)).size !== 3) {
  throw new Error('The evaluation requires exactly three JDs with three answer variants each.');
}
const hash = (value) => createHash('sha256').update(value).digest('hex');
const sources = {};
for (const name of ['interviewer-prompt.mjs', 'interviewer-contract.mjs', 'interviewer-provider.mjs', 'interviewer-fixtures.mjs', 'session-contract.mjs']) {
  sources[name] = hash(await readFile(new URL(`../lib/interview/${name}`, import.meta.url)));
}
let externalCalls = 0;
const provider = createInterviewerProvider({ fetchImpl: (...options) => { externalCalls++; return fetch(...options); } });
const generatedAt = new Date();
const runId = generatedAt.toISOString().replace(/[:.]/g, '-');
const report = {
  task: 'SCRUM-68', mode: live ? 'live' : 'prepared-only', runId,
  generatedAt: generatedAt.toISOString(), dateLocal: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(generatedAt),
  timezone: 'Asia/Bangkok', model: provider.model, promptVersion: PROMPT_VERSION, contractVersion: CONTRACT_VERSION,
  repetitions: 2, sourceSha256: sources,
  provenance: 'Only AI-authored synthetic fixtures. Independent requests from the same completed-turn snapshot, not a multi-turn session or a user study.',
  interpretation: 'valid-output checks structure and server policy; actionMatchesExpectation compares fixture-specific expectations, not expert ground truth. Content quality needs separate review.',
  humanReview: 'pending', status: live ? 'running' : 'prepared-only', externalCalls: 0,
  dataset: fixtures.map((fixture) => ({
    id: fixture.id, quality: fixture.quality, expectedActions: fixture.expectedActions,
    input: validateInterviewerInput(fixture.input), requestSha256: hash(JSON.stringify(buildInterviewerRequest(fixture.input))),
  })),
  cases: [],
};
const destination = new URL('../../docs/test/results/', import.meta.url);
await mkdir(destination, { recursive: true });
const target = new URL(`SCRUM-68-evaluation-${live ? 'live' : 'prepared'}-${runId}.json`, destination);
// A unique run file preserves previous evidence; update it after each completed request.
await writeFile(target, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
const save = async () => {
  report.externalCalls = externalCalls;
  await writeFile(target, `${JSON.stringify(report, null, 2)}\n`);
};
let stopCode;
if (live) {
  for (let repetition = 1; repetition <= report.repetitions; repetition++) {
    for (const fixture of fixtures) {
      const entry = { fixtureId: fixture.id, repetition };
      if (stopCode) {
        report.cases.push({ ...entry, status: 'skipped', error: stopCode });
        await save();
        continue;
      }
      const start = performance.now();
      try {
        const result = await provider.next(fixture.input);
        report.cases.push({ ...entry, status: 'valid-output', latencyMs: Math.round(performance.now() - start),
          actionMatchesExpectation: fixture.expectedActions.includes(result.action), result,
        });
        console.log(`${repetition}/${fixture.id}: valid-output, ${result.action}`);
      } catch (error) {
        const code = error instanceof InterviewerError ? error.code : 'UNEXPECTED_ERROR';
        report.cases.push({ ...entry, status: 'failed', error: code, latencyMs: Math.round(performance.now() - start) });
        console.log(`${repetition}/${fixture.id}: ${code}`);
        if (['AI_NOT_CONFIGURED', 'AI_CONFIGURATION_ERROR', 'AI_RATE_LIMITED', 'AI_UNAVAILABLE'].includes(code)) stopCode = code;
      }
      await save();
    }
  }
}
const valid = report.cases.filter((entry) => entry.status === 'valid-output');
const times = valid.map((entry) => entry.latencyMs).sort((a, b) => a - b);
const middle = Math.floor(times.length / 2);
report.summary = {
  planned: fixtures.length * report.repetitions,
  validOutputs: valid.length,
  actionMatches: valid.filter((entry) => entry.actionMatchesExpectation).length,
  failures: report.cases.filter((entry) => entry.status === 'failed').length,
  skipped: report.cases.filter((entry) => entry.status === 'skipped').length,
  latencyMs: times.length ? { min: times[0], max: times.at(-1), median: times.length % 2 ? times[middle] : (times[middle - 1] + times[middle]) / 2 } : null,
  repeatedActions: fixtures.map((fixture) => {
    const actions = valid.filter((entry) => entry.fixtureId === fixture.id).map((entry) => entry.result.action);
    return { fixtureId: fixture.id, actions, sameAction: actions.length === report.repetitions ? new Set(actions).size === 1 : null };
  }),
};
report.status = !live ? 'prepared-only' : valid.length === report.summary.planned ? 'completed-needs-content-review' : 'incomplete';
await save();
console.log(`Report: docs/test/results/${decodeURIComponent(target.pathname.split('/').at(-1))}`);
console.log(JSON.stringify({ status: report.status, externalCalls, validOutputs: valid.length, planned: report.summary.planned }));
if (live && (valid.length !== report.summary.planned || report.summary.actionMatches !== report.summary.planned)) process.exitCode = 1;
