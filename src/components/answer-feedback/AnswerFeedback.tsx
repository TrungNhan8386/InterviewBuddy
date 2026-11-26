"use client";

import { canRetryFeedback } from "@/lib/answer-feedback/transport.mjs";
import { useEffect, useRef } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import type { FeedbackText } from "@/lib/answer-feedback/text";
import type { AnswerFeedback as Feedback, FeedbackErrorCode } from "@/lib/answer-feedback/types";
import type { ChatQuestion, InterviewLanguage } from "@/lib/interview-chat/types";
import AnswerOutline from "./AnswerOutline";
import RubricScores from "./RubricScores";
import ScoreRing from "./ScoreRing";
import WhyThisScore from "./WhyThisScore";

export type FeedbackState =
  | { kind: "loading" }
  | { kind: "ready"; feedback: Feedback }
  | { kind: "error"; code: FeedbackErrorCode };

type Props = {
  text: FeedbackText;
  language: InterviewLanguage;
  question: ChatQuestion;
  answer: string;
  durationSeconds?: number | null;
  state: FeedbackState;
  // "Back to question" hides the feedback while the user reads the transcript (UC-08 AF2).
  collapsed: boolean;
  onBack: () => void;
  onShow: () => void;
  onRetry: () => void;
  onContinue: () => void;
  onCancel: () => void;
  // UC-08 AF3 / UC-10. Not ready until Build 2, so the button is shown disabled when missing.
  onPracticeSimilar?: () => void;
};

function List({ title, items, empty, tone }: { title: string; items: string[]; empty: string; tone: "good" | "fix" }) {
  const dot = tone === "good" ? "bg-emerald-500" : "bg-amber-500";
  return (
    <section className="min-w-0 flex-1 rounded-lg border border-slate-200 p-3">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-1 text-sm text-slate-500">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {items.map((item, i) => (
            <li key={i} className="flex gap-2 text-sm text-slate-800">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
              <span className="min-w-0 break-words">{item}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// Screen 5 (Answer Feedback), shown on the chat page after each saved answer (UC-06 step 7, UC-08).
// Owner: Khang. Jira: SCRUM-174 (scores), SCRUM-175 (why this score, outline), SCRUM-176 (buttons),
// SCRUM-177 (loading and error states).
export default function AnswerFeedback(props: Props) {
  const { text, language, question, answer, state, collapsed } = props;
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Bring the feedback into view (phones) and move focus for screen readers when it appears.
  useEffect(() => {
    if (collapsed) return;
    headingRef.current?.focus({ preventScroll: true });
    headingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [state.kind, collapsed]);

  const continueButton = (label: string) => (
    <Button onClick={props.onContinue}>{label}</Button>
  );

  if (collapsed) {
    return (
      <Card className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">{text.reviewingHint}</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="secondary" onClick={props.onShow}>
            {text.showFeedback}
          </Button>
          {continueButton(text.continueInterview)}
        </div>
      </Card>
    );
  }

  if (state.kind === "loading") {
    return (
      <Card className="space-y-4" aria-busy="true" data-testid="answer-feedback-loading">
        <h2 ref={headingRef} tabIndex={-1} className="scroll-mt-4 text-lg font-semibold outline-none">
          {text.title}
        </h2>
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <div className="h-28 w-28 shrink-0 animate-pulse rounded-full bg-slate-100" />
          <div className="w-full space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-6 animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        </div>
        <div role="status">
          <p className="text-sm font-medium text-slate-700">{text.evaluating}</p>
          <p className="text-xs text-slate-500">{text.evaluatingHint}</p>
        </div>
        <Button variant="secondary" onClick={props.onCancel}>
          {text.stopScoring}
        </Button>
      </Card>
    );
  }

  if (state.kind === "error") {
    const canRetry = canRetryFeedback(state.code);
    return (
      <Card className="space-y-3" role="alert" data-testid="answer-feedback-error">
        <h2 ref={headingRef} tabIndex={-1} className="scroll-mt-4 text-lg font-semibold outline-none">
          {text.title}
        </h2>
        <p className="text-sm font-medium text-red-800">{text.errorTitle}</p>
        <p className="text-sm text-red-700">{text.errors[state.code] || text.errors.SERVER_ERROR}</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          {canRetry && <Button onClick={props.onRetry}>{text.retry}</Button>}
          <Button variant="secondary" onClick={props.onContinue}>
            {text.continueWithout}
          </Button>
        </div>
      </Card>
    );
  }

  const { feedback } = state;
  const time = new Date(feedback.createdAt).toLocaleTimeString(language === "vi" ? "vi-VN" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Card className="space-y-5" data-testid="answer-feedback">
      <div>
        <h2 ref={headingRef} tabIndex={-1} className="scroll-mt-4 text-lg font-semibold outline-none">
          {text.title}
        </h2>
        <p className="mt-1 break-words text-sm text-slate-600">
          <span className="font-medium text-slate-800">{text.questionLabel}: </span>
          {question.content}
        </p>
        <p className="mt-0.5 text-xs text-slate-500">{text.answeredAt(time)}</p>
        {typeof props.durationSeconds === "number" && props.durationSeconds > 0 && (
          <p className="text-xs text-slate-500">{language === "vi" ? "Thời lượng nói" : "Speaking duration"}: {props.durationSeconds}s</p>
        )}
      </div>

      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
        <ScoreRing score={feedback.overall} label={text.overall} outOf={text.outOf10} />
        <RubricScores text={text} scores={feedback.scores} reasons={feedback.reasons} />
      </div>

      <div className="flex flex-col gap-3 md:flex-row">
        <List title={text.strengths} items={feedback.strengths} empty={text.noItems} tone="good" />
        <List title={text.improvements} items={feedback.improvements} empty={text.noItems} tone="fix" />
      </div>

      <WhyThisScore text={text} answer={answer} evidence={feedback.evidence} />

      <AnswerOutline text={text} outline={feedback.outline} />

      <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{text.notice}</p>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
        <Button variant="secondary" onClick={props.onBack}>
          {text.backToQuestion}
        </Button>
        <Button
          variant="secondary"
          onClick={props.onPracticeSimilar}
          disabled={!props.onPracticeSimilar}
          title={props.onPracticeSimilar ? undefined : text.practiceSoon}
          aria-describedby={props.onPracticeSimilar ? undefined : "practice-soon"}
        >
          {text.practiceSimilar}
        </Button>
        {continueButton(text.continueInterview)}
      </div>
      {!props.onPracticeSimilar && (
        <p id="practice-soon" className="text-right text-xs text-slate-500">
          {text.practiceSoon}
        </p>
      )}
    </Card>
  );
}
