import type { FeedbackText } from "@/lib/answer-feedback/text";
import type { AnswerOutline as Outline } from "@/lib/answer-feedback/types";

type Props = { text: FeedbackText; outline: Outline };

const STAR_KEYS = ["situation", "task", "action", "result"] as const;

// SCRUM-175: suggested answer outline. STAR for behavioural questions, key points otherwise (UC-08 AF1).
export default function AnswerOutline({ text, outline }: Props) {
  return (
    <section className="space-y-2" aria-labelledby="answer-outline">
      <h3 id="answer-outline" className="text-sm font-semibold text-slate-900">
        {text.outlineTitle}
      </h3>
      {outline.format === "star" ? (
        <ol className="grid gap-2 sm:grid-cols-2">
          {STAR_KEYS.map((key) => (
            <li key={key} className="rounded-lg border border-indigo-100 bg-indigo-50/60 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">{text.star[key]}</p>
              <p className="mt-1 break-words text-sm text-slate-800">{outline[key] || "—"}</p>
            </li>
          ))}
        </ol>
      ) : (
        <>
          <p className="text-xs text-slate-500">{text.outlineKeyPoints}</p>
          {outline.points.length === 0 ? (
            <p className="text-sm text-slate-500">{text.noItems}</p>
          ) : (
            <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-800">
              {outline.points.map((point, i) => (
                <li key={i} className="break-words">
                  {point}
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </section>
  );
}
