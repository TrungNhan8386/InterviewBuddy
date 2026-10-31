import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { interviewerFixtures } from '../lib/interview/interviewer-fixtures.mjs';
import { buildInterviewerRequest } from '../lib/interview/interviewer-prompt.mjs';
import { validateInterviewerOutput } from '../lib/interview/interviewer-contract.mjs';

const names = process.argv.slice(2);
if (names.length !== 3 || names.some((name) => !/^[a-zA-Z0-9._-]+\.json$/.test(name))) {
  console.error('Usage: node scripts/summarize-interviewer-evaluation.mjs <matrix.json> <vague-recovery.json> <off-topic-recovery.json>');
  process.exit(2);
}
const destination = new URL('../../docs/test/results/', import.meta.url);
const sha = (value) => createHash('sha256').update(value).digest('hex');
const files = await Promise.all(names.map(async (name) => {
  const bytes = await readFile(new URL(name, destination));
  return { name, sha256: sha(bytes), report: JSON.parse(bytes.toString('utf8')) };
}));
const matrix = files[0].report;
assert.equal(matrix.task, 'SCRUM-68');
assert.equal(matrix.mode, 'live');
assert.equal(matrix.repetitions, 2);
for (const name of Object.keys(matrix.sourceSha256)) {
  assert.equal(sha(await readFile(new URL(`../lib/interview/${name}`, import.meta.url))), matrix.sourceSha256[name], `Source changed: ${name}`);
}
const valid = matrix.cases.filter((entry) => entry.status === 'valid-output').map((entry) => ({ ...entry, evidence: files[0].name }));
for (const file of files.slice(1)) {
  const recovery = file.report;
  assert.equal(recovery.mode, 'live');
  for (const key of ['model', 'promptVersion', 'contractVersion']) assert.equal(recovery[key], matrix[key]);
  assert.equal(recovery.cases.length, 1);
  const entry = recovery.cases[0];
  assert.equal(entry.status, 'valid-output');
  const missing = matrix.cases.filter((item) => item.fixtureId === entry.id && item.status !== 'valid-output');
  assert.equal(missing.length, 1, 'Recovery must fill exactly one missing scheduled result.');
  assert.ok(new Date(recovery.generatedAt) > new Date(matrix.generatedAt));
  valid.push({ fixtureId: entry.id, repetition: missing[0].repetition, status: entry.status,
    actionMatchesExpectation: entry.actionMatchesExpectation, result: entry.result, latencyMs: entry.latencyMs, evidence: file.name,
  });
}
assert.equal(valid.length, matrix.dataset.length * matrix.repetitions);
assert.equal(new Set(valid.map((entry) => `${entry.fixtureId}/${entry.repetition}`)).size, valid.length);
for (const entry of valid) {
  const fixture = interviewerFixtures.find((item) => item.id === entry.fixtureId);
  const original = matrix.dataset.find((item) => item.id === entry.fixtureId);
  assert.equal(sha(JSON.stringify(buildInterviewerRequest(fixture.input))), original.requestSha256);
  validateInterviewerOutput(entry.result, fixture.input);
  assert.equal(entry.actionMatchesExpectation, fixture.expectedActions.includes(entry.result.action));
}
const times = valid.map((entry) => entry.latencyMs).sort((a, b) => a - b);
const actionPairs = matrix.dataset.map((fixture) => {
  const actions = valid.filter((entry) => entry.fixtureId === fixture.id).sort((a, b) => a.repetition - b.repetition).map((entry) => entry.result.action);
  assert.equal(actions.length, matrix.repetitions);
  return { fixtureId: fixture.id, actions, sameAction: new Set(actions).size === 1 };
});
const result = {
  task: 'SCRUM-68', generatedAt: new Date().toISOString(), dateLocal: matrix.dateLocal,
  status: 'completed-with-rate-limit-recovery-needs-human-review',
  model: matrix.model, promptVersion: matrix.promptVersion, contractVersion: matrix.contractVersion,
  provenance: 'Merged evidence only; no new Gemini calls. Initial 429 and skipped case remain in the original matrix. Content review is separate and AI-assisted.',
  sources: files.map(({ name, sha256 }) => ({ name, sha256 })),
  externalCalls: files.reduce((sum, file) => sum + file.report.externalCalls, 0),
  initialFailures: matrix.cases.filter((entry) => entry.status === 'failed').map(({ fixtureId, repetition, error }) => ({ fixtureId, repetition, error })),
  initiallySkipped: matrix.cases.filter((entry) => entry.status === 'skipped').length,
  scheduledResults: matrix.summary.planned, validOutputs: valid.length,
  actionMatches: valid.filter((entry) => entry.actionMatchesExpectation).length,
  latencyMs: { min: times[0], max: times.at(-1), median: (times[times.length / 2 - 1] + times[times.length / 2]) / 2 },
  actionPairs, cases: valid.sort((a, b) => a.repetition - b.repetition || a.fixtureId.localeCompare(b.fixtureId)),
  humanReview: 'pending',
};
await writeFile(new URL('SCRUM-68-evaluation-summary.json', destination), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ validOutputs: result.validOutputs, externalCalls: result.externalCalls, latencyMs: result.latencyMs,
  stableActionPairs: actionPairs.filter((entry) => entry.sameAction).length, actionPairs: actionPairs.length }));
