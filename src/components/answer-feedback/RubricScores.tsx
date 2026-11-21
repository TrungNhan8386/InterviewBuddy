import type { FeedbackText } from "@/lib/answer-feedback/text";
import { CRITERIA, type CriterionScores } from "@/lib/answer-feedback/types";
import { scoreColor } from "./ScoreRing";

type Props = { text: FeedbackText; scores: CriterionScores };

// SCRUM-174/175: the four rubric scores. STAR is hidden for non-behavioural questions (UC-08 AF1).
export default function RubricScores({ text, scores }: Props) {
  return (
    <div className="min-w-0 flex-1 space-y-3">
      <ul className="space-y-3">
        {CRITERIA.map((criterion) => {
          const value = scores[criterion];
          if (value === null) return null;
          const color = scoreColor(value);
          return (
            <li key={criterion}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-medium text-slate-800">
                  {text.criteria[criterion]}
                  {criterion === "confidence" && (
                    <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-normal text-slate-600">
                      {text.confidenceEstimate}
                    </span>
                  )}
                </span>
                <span className={`font-mono font-semibold tabular-nums ${color.text}`}>
                  {value}
                  <span className="text-xs font-normal text-slate-500">{text.outOf10}</span>
                </span>
              </div>
              <div
                className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100"
                role="meter"
                aria-label={text.criteria[criterion]}
                aria-valuemin={0}
                aria-valuemax={10}
                aria-valuenow={value}
              >
                <div className={`h-full rounded-full ${color.bar}`} style={{ width: `${value * 10}%` }} />
              </div>
              <p className="mt-0.5 text-xs text-slate-500">{text.criteriaHint[criterion]}</p>
            </li>
          );
        })}
      </ul>
      {scores.structure === null && (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">{text.structureHidden}</p>
      )}
    </div>
  );
}
