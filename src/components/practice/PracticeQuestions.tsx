"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { PRACTICE_MOCK, loadPractice, startPractice } from "@/lib/practice-view/client";
import { PRACTICE_DEMOS, type PracticeDemo } from "@/lib/practice-view/mock";
import { PRACTICE_TEXT } from "@/lib/practice-view/text";
import {
  PracticeViewError,
  RETRY_CODES,
  type PracticeErrorCode,
  type PracticeLanguage,
  type PracticeQuestion,
  type PracticeSet,
} from "@/lib/practice-view/types";

// "Targeted practice questions" section of the Report page (UC-10). Owner: Khang.
// Jira: SCRUM-203 (show the questions with the criterion each one trains, loading and error states)
// and SCRUM-204 (start a practice session from a question, opening the existing chat page).
// The set is generated once per report; reopening the report shows the saved set (UC-10 AF1).

type Props = {
  sessionId: string;
  language: PracticeLanguage;
};

type State =
  | { kind: "loading" }
  | { kind: "ready"; set: PracticeSet }
  | { kind: "error"; code: PracticeErrorCode; resetAt: string | null };

function one(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function resetTime(iso: string | null, language: PracticeLanguage) {
  if (!iso || Number.isNaN(Date.parse(iso))) return null;
  return new Intl.DateTimeFormat(language === "vi" ? "vi-VN" : "en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(iso));
}

export default function PracticeQuestions({ sessionId, language }: Props) {
  const t = PRACTICE_TEXT[language];
  const router = useRouter();
  // Sample states, only with NEXT_PUBLIC_PRACTICE_MODE=mock: ?practice=strong | error | limit | few.
  const requested = useSearchParams().get("practice");
  const demo = PRACTICE_MOCK && PRACTICE_DEMOS.includes(requested as PracticeDemo) ? (requested as PracticeDemo) : undefined;
  const [state, setState] = useState<State>({ kind: "loading" });
  const [starting, setStarting] = useState<string | null>(null);
  const [startError, setStartError] = useState(false);
  const controller = useRef<AbortController | null>(null);

  // Fetches the set; state changes only in the callbacks (the first render already shows "loading").
  const fetchSet = useCallback(() => {
    controller.current?.abort();
    const ctrl = new AbortController();
    controller.current = ctrl;
    loadPractice(sessionId, language, { signal: ctrl.signal, demo })
      .then((set) => {
        if (!ctrl.signal.aborted) setState({ kind: "ready", set });
      })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return;
        const err = e instanceof PracticeViewError ? e : new PracticeViewError("SERVER_ERROR");
        setState({ kind: "error", code: err.code, resetAt: err.resetAt });
      });
  }, [sessionId, language, demo]);

  useEffect(() => {
    fetchSet();
    return () => controller.current?.abort();
  }, [fetchSet]);

  function retry() {
    setState({ kind: "loading" });
    fetchSet();
  }

  async function start(question: PracticeQuestion) {
    if (starting) return;
    setStarting(question.id);
    setStartError(false);
    try {
      const id = await startPractice(question.id);
      router.push(`/interview/${encodeURIComponent(id)}`);
    } catch {
      setStartError(true);
      setStarting(null);
    }
  }

  return (
    <Card aria-labelledby="practice-title" aria-busy={state.kind === "loading"}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 id="practice-title" className="text-base font-semibold">
            {t.title}
          </h2>
          <p className="mt-1 text-sm text-slate-600">{t.intro}</p>
        </div>
        {state.kind === "ready" && state.set.groups[0]?.questions[0] && (
          <Button
            className="w-full shrink-0 sm:w-auto"
            onClick={() => start(state.set.groups[0].questions[0])}
            disabled={starting !== null}
          >
            {starting === state.set.groups[0].questions[0].id ? t.starting : t.startFirst}
          </Button>
        )}
      </div>

      {state.kind === "loading" && (
        <div className="mt-4" role="status">
          <p className="flex items-center gap-2 text-sm text-slate-700">
            <span
              aria-hidden="true"
              className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600"
            />
            {t.generating}
          </p>
          <p className="mt-1 text-xs text-slate-500">{t.generatingHint}</p>
          <div className="mt-4 grid gap-3 lg:grid-cols-2" aria-hidden="true">
            {[0, 1].map((i) => (
              <div key={i} className="space-y-2 rounded-lg bg-slate-50 p-3">
                <div className="h-4 w-1/3 animate-pulse rounded bg-slate-200" />
                <div className="h-12 animate-pulse rounded bg-slate-200" />
                <div className="h-12 animate-pulse rounded bg-slate-200" />
                <div className="h-12 animate-pulse rounded bg-slate-200" />
              </div>
            ))}
          </div>
        </div>
      )}

      {state.kind === "error" && (
        <div
          className={`mt-4 space-y-2 rounded-lg border p-3 text-sm ${
            state.code === "NOT_ENOUGH_SCORES" || state.code === "SESSION_NOT_COMPLETED"
              ? "border-slate-200 bg-slate-50 text-slate-700"
              : "border-amber-200 bg-amber-50 text-amber-900"
          }`}
          role="alert"
        >
          {state.code !== "NOT_ENOUGH_SCORES" && state.code !== "SESSION_NOT_COMPLETED" && (
            <p className="font-semibold">{t.errorTitle}</p>
          )}
          <p>
            {t.errors[state.code] ?? t.errors.SERVER_ERROR}
            {state.code === "AI_DAILY_LIMIT" && resetTime(state.resetAt, language) && (
              <> {t.limitReset(resetTime(state.resetAt, language) as string)}</>
            )}
          </p>
          {RETRY_CODES.includes(state.code) && (
            <Button variant="secondary" onClick={retry}>
              {t.retry}
            </Button>
          )}
        </div>
      )}

      {state.kind === "ready" && (
        <>
          {state.set.noMajorWeakness && (
            <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900" role="note">
              {t.noMajorWeakness}
            </p>
          )}
          {startError && (
            <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900" role="alert">
              {t.startError}
            </p>
          )}
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {state.set.groups.map((group) => (
              <section key={group.criterion} aria-label={t.criteria[group.criterion]} className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">{t.criteria[group.criterion]}</h3>
                  {group.score !== null && (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium tabular-nums text-amber-900">
                      {t.focusLabel(one(group.score))}
                    </span>
                  )}
                  <span className="text-xs text-slate-500">· {t.questionCount(group.questions.length)}</span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">{t.criteriaHint[group.criterion]}</p>
                <ol className="mt-3 space-y-3">
                  {group.questions.map((q, index) => (
                    <li key={q.id} className="rounded-lg border border-slate-200 p-3">
                      <span className="inline-block rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-800">
                        {t.trains(t.criteria[group.criterion])}
                      </span>
                      <p className="mt-2 text-sm text-slate-900">
                        <span className="mr-1 font-medium text-slate-500">{index + 1}.</span>
                        {q.question}
                      </p>
                      {q.tip && (
                        <p className="mt-1 text-xs text-slate-600">
                          <span className="font-medium">{t.tip}:</span> {q.tip}
                        </p>
                      )}
                      <div className="mt-3 flex justify-end">
                        <Button
                          variant="secondary"
                          className="w-full sm:w-auto"
                          onClick={() => start(q)}
                          disabled={starting !== null}
                          aria-label={`${q.practiceSessionId ? t.continuePractice : t.practice}: ${q.question}`}
                        >
                          {starting === q.id ? t.starting : q.practiceSessionId ? t.continuePractice : t.practice}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
          <p className="mt-4 text-xs text-slate-500">{t.notice}</p>
        </>
      )}
    </Card>
  );
}
