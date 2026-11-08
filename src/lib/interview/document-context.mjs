// A prompt projection only. The original CV/JD stay intact in the session and
// in the validated server context. No generated summary or cross-user cache.
export const DOCUMENT_CONTEXT_VERSION = 'verbatim-passages-v1';
const budgets = { cv: 4000, jd: 6000, turn: 2200 };
const omitted = '\n[Source excerpt omitted]\n';
const stopWords = new Set(('the and with for from that this have your you are job role work experience skills ' +
  'của và với cho trong một các những được cần có bạn công việc yêu cầu kinh nghiệm').split(/\s+/u));
const aliases = new Map([['js', 'javascript'], ['ts', 'typescript'], ['nodejs', 'node.js'],
  ['reactjs', 'react'], ['postgres', 'postgresql'], ['csharp', 'c#'], ['.net', 'dotnet']]);

function terms(text) {
  return new Set((text.normalize('NFKC').toLocaleLowerCase('en-US')
    .match(/\.net\b|[\p{L}\p{N}]+(?:\.[\p{L}\p{N}]+)*(?:\+\+|#)?/gu) ?? [])
    .map((word) => aliases.get(word) ?? word)
    .filter((word) => !stopWords.has(word) && (word.length >= 3 || ['go', 'c#', 'ui', 'ux', 'qa', 'ai', 'ml'].includes(word))));
}

function passages(source) {
  return [...source.matchAll(/[^\r\n]+(?:\r?\n|$)/gu)]
    .filter((match) => match[0].trim())
    .map((match) => ({ text: match[0], start: match.index, end: match.index + match[0].length }));
}

function render(source, blocks, selected) {
  const spans = [];
  for (const index of [...selected].sort((a, b) => a - b)) {
    const previous = spans.at(-1);
    if (previous && previous.last + 1 === index) { previous.end = blocks[index].end; previous.last = index; }
    else spans.push({ start: blocks[index].start, end: blocks[index].end, last: index });
  }
  return spans.map(({ start, end }) => source.slice(start, end)).join(omitted);
}

function project(source, query, budget, { full = false, anchors = true, excluded = new Set() } = {}) {
  const blocks = passages(source);
  const all = new Set(blocks.map((_, index) => index));
  const coverage = (selected) => ({ complete: selected.size === blocks.length,
    originalCharacters: source.length, omittedPassages: blocks.length - selected.size });
  // An unbroken oversized passage cannot be safely clipped: retain it in full.
  if (full || (anchors && (source.length <= budget || blocks.some((block) => block.text.length > budget)))) {
    return { text: source, selected: all, coverage: coverage(all) };
  }
  const wanted = terms(query);
  const ranked = blocks.map((block, index) => ({ index,
    score: [...terms(block.text)].filter((word) => wanted.has(word)).length,
  })).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.index - b.index);
  if (anchors && !ranked.length) return { text: source, selected: all, coverage: coverage(all) };
  let selected = new Set();
  const take = (index) => {
    // Keep both neighbors: a skill heading may be qualified by a following
    // sentence such as "I have never used this professionally".
    const window = [index - 1, index, index + 1].filter((i) => i >= 0 && i < blocks.length);
    if (!anchors && window.every((i) => excluded.has(i))) return;
    const candidate = new Set([...selected, ...window]);
    if (render(source, blocks, candidate).length <= budget) selected = candidate;
  };
  if (anchors && blocks.length) { take(0); take(blocks.length - 1); }
  for (const item of ranked) take(item.index);
  if (anchors && !selected.size) return { text: source, selected: all, coverage: coverage(all) };
  return { text: selected.size === blocks.length ? source : render(source, blocks, selected),
    selected, coverage: coverage(selected) };
}

export function buildDocumentContext(input, plan, contextMode = 'compact') {
  const full = contextMode === 'full';
  // Stable across turns: do not use history or questionPlan to build this prefix.
  const query = `${input.settings.targetPosition}\n${input.jdText}`;
  const cv = project(input.cvText, query, budgets.cv, { full });
  const jd = project(input.jdText, input.settings.targetPosition, budgets.jd, { full });
  const latest = input.history.at(-1);
  const turnQuery = [plan.jdFocus, latest?.topic, latest?.question, latest?.answer].filter(Boolean).join('\n');
  const extra = (source, part) => part.coverage.complete ? ''
    : project(source, turnQuery, budgets.turn, { anchors: false, excluded: part.selected }).text;
  return {
    documents: { jdText: jd.text, cvText: cv.text },
    documentCoverage: { version: DOCUMENT_CONTEXT_VERSION, cv: cv.coverage, jd: jd.coverage },
    turnEvidence: { cvText: extra(input.cvText, cv), jdText: extra(input.jdText, jd) },
  };
}
