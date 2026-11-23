// Conservative lexical paraphrase guard, not a semantic classifier. The prompt
// also sees full-session coverage. Keep unfamiliar wording eligible for review.
const stop = new Set(('how would you what which could can should do does did have has is are be a an the to of for in on with and or when using use define describe explain tell me steps take component components collaborating team question required preferred skill skills requirements experience built used ' +
  'ban se nhu the nao ra sao voi bang cho cua trong mot cac khi la va co hay ve da').split(/\s+/u));
const aliases = new Map(Object.entries({ types: 'type', typing: 'type', typed: 'type', props: 'prop', properties: 'prop',
  resolve: 'handle', resolving: 'handle', handle: 'handle', handling: 'handle', resolved: 'handle',
  testing: 'test', tests: 'test', failures: 'failure', errors: 'error', ts: 'typescript', reactjs: 'react', js: 'javascript',
  branches: 'branch', branching: 'branch', workflows: 'workflow', commits: 'commit' }));
const facets = new Set(['optional', 'generic', 'generics', 'test', 'error', 'failure', 'performance', 'render', 'security', 'cancel', 'cancellation', 'validation', 'accessibility', 'locking', 'isolation', 'rollback', 'rebase', 'debug', 'tradeoff']);
export function questionTerms(text) {
  const folded = text.normalize('NFKD').replace(/\p{M}/gu, '').replace(/đ/giu, 'd').toLocaleLowerCase('en-US')
    .replace(/khai bao kieu|dinh nghia kieu|kieu du lieu/gu, 'type')
    .replace(/giai quyet|xu ly/gu, 'handle').replace(/xung dot/gu, 'conflict')
    .replace(/phan nhanh/gu, 'branch').replace(/quy trinh/gu, 'workflow').replace(/chien luoc/gu, 'strategy')
    .replace(/thuoc tinh/gu, 'prop').replace(/kiem thu/gu, 'test').replace(/hieu nang/gu, 'performance');
  return new Set((folded.match(/[\p{L}][\p{L}\p{N}+#.]*/gu) ?? [])
    .map(word => aliases.get(word.replace(/\.+$/u, '')) ?? word.replace(/\.+$/u, ''))
    .filter(word => word.length > 1 && !stop.has(word)));
}
export function isNearDuplicate(question, previous, { followUp = false } = {}) {
  const next = questionTerms(question), old = questionTerms(previous);
  const common = [...next].filter(word => old.has(word)).length;
  // Turning an answered Git-conflict process into a past story still repeats
  // that main-question goal. A genuine follow-up may probe a new mechanism.
  if (!followUp && [next, old].every(words => words.has('git') && words.has('conflict'))) return true;
  // New technical detail can be a legitimate focused follow-up.
  if ([...next].some(word => facets.has(word) && !old.has(word))) return false;
  const branchWorkflow = words => words.has('git') && words.has('branch')
    && ['workflow', 'strategy', 'commit', 'flow'].some(word => words.has(word));
  if (branchWorkflow(next) && branchWorkflow(old) && questionAngle(question) === questionAngle(previous)) return true;
  return common >= 3 && common / Math.min(next.size, old.size) >= 0.85
    && common / Math.max(next.size, old.size) >= 0.55;
}
export function isClosingStatement(question, topic) {
  if (/[?？]/u.test(question)) return false;
  const folded = (topic + '\n' + question).normalize('NFKD').replace(/\p{M}/gu, '').replace(/đ/giu, 'd').toLowerCase();
  return /^(?:end|closing|ket thuc)\n/u.test(folded)
    || /\n(?:the|all|our|this) [^.?!]*(?:questions?|interview|session)[^.?!]*(?:completed|finished|ended)/u.test(folded)
    || /\n(?:buoi|phien|tat ca|da) [^.?!]*(?:ket thuc|hoan thanh)/u.test(folded);
}
export function questionAngle(question) {
  const words = questionTerms(question);
  if (['motivation', 'interested', 'career'].some(word => words.has(word))) return 'motivation';
  if (['collaboration', 'teamwork', 'disagreement'].some(word => words.has(word))) return 'collaboration';
  if (['decision', 'prioritize', 'priorities'].some(word => words.has(word))) return 'decision';
  if (['reflection', 'learned', 'differently'].some(word => words.has(word))) return 'reflection';
  if (['test', 'assert', 'verify'].some(word => words.has(word))) return 'testing';
  if (['failure', 'error', 'debug'].some(word => words.has(word))) return 'failure_handling';
  if (['performance', 'render', 'optimize'].some(word => words.has(word))) return 'performance';
  if (['tradeoff', 'choose', 'compare'].some(word => words.has(word))) return 'tradeoffs';
  return 'implementation';
}
