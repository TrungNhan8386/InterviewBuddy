// Offline documentation checks; never loads credentials or calls a provider/DB.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { normalizeFitInput, formatFitResult } from '../lib/analysis/analysis-fit.mjs';
import { GEMINI_ANALYSIS_SCHEMA } from '../lib/analysis/contracts.mjs';
import { scoreAnalysis, SCORING_VERSION } from '../lib/analysis/scoring.mjs';
import { buildGeminiRequest } from '../lib/analysis/gemini.mjs';
import { INTERVIEWER_OUTPUT_SCHEMA, validateInterviewerInput, validateInterviewerOutput } from '../lib/interview/interviewer-contract.mjs';
import { buildInterviewerRequest, PROMPT_VERSION } from '../lib/interview/interviewer-prompt.mjs';
import { QUESTION_PLAN_VERSION } from '../lib/interview/question-plan.mjs';
import { CONVERSATION_MEMORY_VERSION } from '../lib/interview/conversation-memory.mjs';
import { DOCUMENT_CONTEXT_VERSION } from '../lib/interview/document-context.mjs';
import { validateNextRequest } from '../lib/interview/next-service.mjs';
import { requestInterviewNext } from '../lib/interview/next-stream-client.mjs';

const root = new URL('../../', import.meta.url);
const docDir = 'docs/analysis and design/';
const json = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const digest = text => createHash('sha256').update(text.replace(/\r\n/gu, '\n')).digest('hex');
const examples = await json(docDir + 'ai-design/examples.json');
const manifest = await json(docDir + 'ai-design/source-manifest.json');

assert.deepEqual(await json(docDir + 'ai-design/analysis-output.schema.json'), GEMINI_ANALYSIS_SCHEMA);
assert.deepEqual(await json(docDir + 'ai-design/interviewer-output.schema.json'), INTERVIEWER_OUTPUT_SCHEMA);
assert.deepEqual(manifest.versions, {
  prompt: PROMPT_VERSION, questionPlan: QUESTION_PLAN_VERSION,
  memory: CONVERSATION_MEMORY_VERSION, documentContext: DOCUMENT_CONTEXT_VERSION, scoring: SCORING_VERSION,
});
assert.equal(manifest.review.status, 'pending');
assert.equal(manifest.review.independentHumanAcceptance, false);
assert.equal(manifest.hashNormalization, 'UTF-8 text; CRLF normalized to LF');
for (const source of manifest.sources) {
  assert.equal(digest(await readFile(new URL(source.path, root), 'utf8')), source.sha256,
    `Source changed; review and refresh documentation: ${source.path}`);
}

const analysisInput = normalizeFitInput(examples.analysisFitInput);
const analysis = scoreAnalysis(examples.analysisModelOutput, analysisInput);
assert.equal(analysis.fitScore, examples.analysisExpected.fitScore);
assert.equal(analysis.fitScore, 66.67);
assert.equal(analysis.scoreBreakdown.matchedWeight, 2);
assert.equal(analysis.scoreBreakdown.totalWeight, 3);
assert.deepEqual(analysis.matchedSkills, ['React']);
assert.deepEqual(analysis.missingSkills, ['Git']);
assert.equal(Math.round(analysis.fitScore), examples.analysisExpected.roundedUiAndStoredColumnScore);
assert.equal(formatFitResult(analysis, analysisInput).requirements[1].status, 'missing');
const context = validateInterviewerInput(examples.interviewerInternalInput);
const decision = validateInterviewerOutput(examples.interviewerModelOutput, context);
validateNextRequest(examples.nextPublicInput);
const received = await requestInterviewNext(examples.nextPublicInput, {
  fetchImpl: async () => new Response(`event: complete\ndata: ${JSON.stringify(examples.nextPublicOutput)}\n\n`, {
    headers: { 'Content-Type': 'text/event-stream' },
  }),
});
assert.equal(received.question.content, decision.question);
assert.equal(received.action, decision.action);
assert.equal(received.question.position, context.history.length + 1);

for (const [request, forbidden] of [
  [buildGeminiRequest(analysisInput), analysisInput.cvText],
  [buildInterviewerRequest(context), context.history[0].question],
]) {
  assert.equal(request.systemInstruction.parts[0].text.includes(forbidden), false);
}

const documents = [docDir + 'ai-design.md', docDir + 'ai-design-review.md'];
let localLinks = 0;
let jsonFences = 0;
for (const path of documents) {
  const url = new URL(path, root);
  const text = await readFile(url, 'utf8');
  for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/gu)) {
    const target = match[1];
    if (/^(?:https?:|#)/u.test(target)) continue;
    const resolved = new URL(target.replace(/#.*$/u, ''), url);
    // The generated verification result may not exist until this run finishes.
    if (!resolved.pathname.endsWith('/scrum125/document-verification.json')) await access(resolved);
    localLinks++;
  }
  for (const match of text.matchAll(/```json\s*\n([\s\S]*?)\n```/gu)) {
    const value = JSON.parse(match[1]);
    const allowed = [examples.analysisFitInput, examples.interviewerModelOutput, examples.nextPublicInput];
    assert.ok(allowed.some(item => JSON.stringify(item) === JSON.stringify(value)), 'JSON example fence drifted from verified examples');
    jsonFences++;
  }
}
const report = {
  checkedAtUtc: new Date().toISOString(), task: 'SCRUM-125', implementationCommit: manifest.implementationCommit,
  checks: { schemaSnapshotsEqualExports: 2, sourceHashesVerified: manifest.sources.length,
    versionsMatch: true, syntheticExamplesValidated: true, scoringExample: '66.67; UI/storage column round to 67',
    publicResponseValidatedByRealClient: true, localLinksChecked: localLinks, jsonExampleFencesChecked: jsonFences },
  boundary: 'Offline source/document/schema checks with a controlled complete-only SSE replay; no live Gemini, Auth, UI or shared Supabase acceptance.',
  humanReview: { reviewer: manifest.review.reviewer, status: 'pending', independentlyApproved: false },
};
if (process.argv.includes('--write-report')) {
  const output = new URL('docs/test/results/scrum125/document-verification.json', root);
  await mkdir(new URL('./', output), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify(report, null, 2));
