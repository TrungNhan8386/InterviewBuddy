import type { ReactNode } from "react";
import type { FeedbackText } from "@/lib/answer-feedback/text";
import type { Evidence } from "@/lib/answer-feedback/types";

type Props = { text: FeedbackText; answer: string; evidence: Evidence[] };

const MARK: Record<Evidence["effect"], string> = {
  positive: "bg-emerald-100 text-emerald-900",
  negative: "bg-amber-100 text-amber-900",
};

type Range = { start: number; end: number; effect: Evidence["effect"]; index: number };

// Finds each quote in the answer (ignoring case). Overlapping quotes keep the first one.
function findRanges(answer: string, evidence: Evidence[]): Range[] {
  const lower = answer.toLocaleLowerCase();
  const ranges: Range[] = [];
  evidence.forEach((e, index) => {
    const at = lower.indexOf(e.quote.toLocaleLowerCase());
    if (at < 0) return;
    const range = { start: at, end: at + e.quote.length, effect: e.effect, index };
    if (ranges.every((r) => range.end <= r.start || range.start >= r.end)) ranges.push(range);
  });
  return ranges.sort((a, b) => a.start - b.start);
}

// SCRUM-175: "Why this score" — the user's answer with the quoted evidence highlighted,
// then one line per quote saying which criterion it affected and how.
export default function WhyThisScore({ text, answer, evidence }: Props) {
  const ranges = findRanges(answer, evidence);
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const r of ranges) {
    if (r.start > cursor) parts.push(answer.slice(cursor, r.start));
    parts.push(
      <mark key={r.index} className={`rounded px-0.5 ${MARK[r.effect]}`}>
        {answer.slice(r.start, r.end)}
        <sup className="ml-0.5 font-mono text-[10px]">{r.index + 1}</sup>
      </mark>,
    );
    cursor = r.end;
  }
  parts.push(answer.slice(cursor));

  return (
    <section className="space-y-3" aria-labelledby="why-score">
      <div>
        <h3 id="why-score" className="text-sm font-semibold text-slate-900">
          {text.whyTitle}
        </h3>
        <p className="text-xs text-slate-500">{text.whyHint}</p>
      </div>
      <blockquote className="whitespace-pre-wrap break-words rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm leading-relaxed text-slate-800">
        {parts}
      </blockquote>
      {evidence.length === 0 ? (
        <p className="text-sm text-slate-500">{text.noEvidence}</p>
      ) : (
        <ol className="space-y-2">
          {evidence.map((e, i) => (
            <li key={i} className="flex gap-2 text-sm">
              <span
                className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-xs ${MARK[e.effect]}`}
                aria-hidden="true"
              >
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-xs text-slate-500">
                  {text.criteria[e.criterion]} · {text.effect[e.effect]}
                </p>
                <p className="break-words text-slate-800">
                  <q className="italic">{e.quote}</q>
                  {e.comment && <span className="text-slate-600"> — {e.comment}</span>}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
