"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ChatHeader from "./ChatHeader";
import MessageList from "./MessageList";
import AnswerBox from "./AnswerBox";
import SidePanel from "./SidePanel";
import EndInterviewDialog from "./EndInterviewDialog";
import EndScreen from "./EndScreen";
import AnswerFeedback, { type FeedbackState } from "@/components/answer-feedback/AnswerFeedback";
import { FEEDBACK_MODE, evaluateAnswer } from "@/lib/answer-feedback/client";
import { FEEDBACK_TEXT } from "@/lib/answer-feedback/text";
import { AnswerFeedbackError } from "@/lib/answer-feedback/types";
import type { InterviewStreamStatus } from "@/lib/interview/next-stream-client.mjs";
import { USE_MOCK, endSession, loadChatSession, requestNext, saveAnswer } from "@/lib/interview-chat/client";
import { CHAT_TEXT } from "@/lib/interview-chat/text";
import {
  ANSWER_MAX_CHARS,
  InterviewChatError,
  type AnswerMeta,
  type ChatErrorCode,
  type ChatSession,
  type EndReason,
} from "@/lib/interview-chat/types";

// Screen 4 (Chat Interview), /interview/[id]. Owner: Khang. Jira: SCRUM-95.
// Flow per turn (docs/api/INTERVIEW_NEXT_API_v1.md):
//   1. save the answer  2. POST /api/evaluate-answer and show the Answer Feedback screen (UC-08, SCRUM-172)
//   3. "Continue interview": POST /api/interview/next with afterAnswerId = saved answer id
//   4. show the next question, or the "ended" state when action = "end".
// NEXT_PUBLIC_FEEDBACK_MODE=off skips step 2 (see lib/answer-feedback/client.ts).
// Reloading the page resumes where it stopped: the last unanswered question is shown again,
// or the feedback of the latest saved answer is shown again before the next question (UC-06 AF8).

type Phase =
  | { kind: "loading" }
  | { kind: "load-error"; code: ChatErrorCode }
  | { kind: "answering" }
  | { kind: "saving" }
  | { kind: "thinking" }
  | { kind: "feedback"; answerId: string } // Answer Feedback screen, waiting for "Continue interview"
  | { kind: "error"; code: ChatErrorCode; retry: "save" | "next" }
  | { kind: "ended" };

const codeOf = (error: unknown): ChatErrorCode =>
  error instanceof InterviewChatError ? error.code : "SERVER_ERROR";

// Load errors that "Try again" cannot fix: the link is wrong or the session is unusable.
const FINAL_LOAD_ERRORS: ChatErrorCode[] = ["NOT_FOUND", "BAD_INPUT", "SESSION_CONTEXT_INVALID"];

// The engine ends the interview when the questions are done or the time is up (UC06-05).
function engineEndReason(session: ChatSession | null): EndReason {
  const started = session?.startedAt ? Date.parse(session.startedAt) : NaN;
  if (session && !session.practice && Number.isFinite(started) && Date.now() - started >= session.settings.durationMinutes * 60_000) {
    return "time_up";
  }
  return "completed";
}

export default function InterviewChat({ sessionId }: { sessionId: string }) {
  const [session, setSession] = useState<ChatSession | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [draft, setDraft] = useState("");
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [ending, setEnding] = useState(false);
  const [endError, setEndError] = useState<string | null>(null);
  const [questionPreview, setQuestionPreview] = useState("");
  const [generationStatus, setGenerationStatus] = useState<InterviewStreamStatus>("generating");
  // Why the page reloaded the saved session after a failed save (shown until the next send).
  const [notice, setNotice] = useState<ChatErrorCode | null>(null);
  const generation = useRef<AbortController | null>(null);
  // How the current draft was given (typed or voice + speaking time), kept for "Try again" after a failed save.
  const answerMeta = useRef<AnswerMeta>({ inputMode: "text", durationSeconds: null });

  // Ignore results that arrive after the user left the page.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      generation.current?.abort();
    };
  }, []);

  // fetchNext needs start() to reload after STALE_TURN; a ref avoids a circular dependency.
  const startRef = useRef<() => Promise<void>>(async () => {});

  // SCRUM-172: feedback of the last saved answer (UC-08).
  const [feedback, setFeedback] = useState<FeedbackState>({ kind: "loading" });
  const [feedbackCollapsed, setFeedbackCollapsed] = useState(false);
  const scoring = useRef<AbortController | null>(null);
  useEffect(() => () => scoring.current?.abort(), []);

  // SCRUM-128: why and when the interview ended, for the end screen.
  const [end, setEnd] = useState<{ reason: EndReason; at: number | null } | null>(null);
  const router = useRouter();
  const transcriptRef = useRef<HTMLDivElement>(null);
  // fetchNext is memoised, so it reads the latest session (start time, duration) from a ref.
  const sessionRef = useRef<ChatSession | null>(null);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const fetchNext = useCallback(
    async (afterAnswerId: string | null, isOpening: boolean) => {
      generation.current?.abort();
      const controller = new AbortController();
      generation.current = controller;
      setQuestionPreview("");
      setGenerationStatus("generating");
      setPhase({ kind: "thinking" });
        try {
          const next = await requestNext(sessionId, afterAnswerId, {
            signal: controller.signal,
            onPreview: (text) => { if (alive.current && generation.current === controller) setQuestionPreview(text); },
            onStatus: (status) => { if (alive.current && generation.current === controller) setGenerationStatus(status); },
          });
          if (!alive.current || generation.current !== controller) return;
          if (controller.signal.aborted) throw new InterviewChatError("REQUEST_CANCELLED");
          if (next.action === "end" || !next.question) {
            setEnd({ reason: engineEndReason(sessionRef.current), at: Date.now() });
            setSession((s) => (s ? { ...s, status: "completed" } : s));
            setPhase({ kind: "ended" });
            return;
          }
          const question = next.question;
          setSession((s) => {
            if (!s) return s;
            if (s.turns.some((t) => t.question.id === question.id)) return s; // replayed turn
            return {
              ...s,
              // The server starts the clock at the first question.
              startedAt: isOpening ? new Date().toISOString() : s.startedAt,
              turns: [...s.turns, { question, answer: null }],
            };
          });
          setPhase({ kind: "answering" });
          return;
        } catch (error) {
          if (!alive.current || generation.current !== controller) return;
          const code = codeOf(error);
          if (code === "STALE_TURN") {
            // Another tab moved the interview on: reload the saved history and continue.
            setPhase({ kind: "loading" });
            void startRef.current();
            return;
          }
          setPhase({ kind: "error", code, retry: "next" });
          return;
        } finally {
          if (generation.current === controller) {
            generation.current = null;
            if (alive.current) setQuestionPreview("");
          }
        }
    },
    [sessionId],
  );

  // SCRUM-172: score the saved answer and show the Answer Feedback screen (UC-06 step 7).
  // The server returns the saved feedback if it already exists, so resume and "Try again" are safe.
  const evaluate = useCallback(
    async (answerId: string, answer: string) => {
      if (FEEDBACK_MODE === "off") {
        await fetchNext(answerId, false);
        return;
      }
      scoring.current?.abort();
      const controller = new AbortController();
      scoring.current = controller;
      setFeedbackCollapsed(false);
      setFeedback({ kind: "loading" });
      setPhase({ kind: "feedback", answerId });
      const s = sessionRef.current;
      try {
        const result = await evaluateAnswer(sessionId, answerId, {
          signal: controller.signal,
          sample: s ? { answer, questionType: s.settings.type, language: s.settings.language } : undefined,
        });
        if (!alive.current || scoring.current !== controller) return;
        setFeedback({ kind: "ready", feedback: result });
      } catch (error) {
        if (!alive.current || scoring.current !== controller) return;
        setFeedback({
          kind: "error",
          code: error instanceof AnswerFeedbackError ? error.code : "SERVER_ERROR",
        });
      } finally {
        if (scoring.current === controller) scoring.current = null;
      }
    },
    [sessionId, fetchNext],
  );

  // "Continue interview" (with or without feedback): ask the engine for the next step.
  function continueInterview(answerId: string) {
    scoring.current?.abort();
    scoring.current = null;
    setFeedbackCollapsed(false);
    void fetchNext(answerId, false);
  }

  // Loads the saved session and resumes it. Callers show the loading state themselves.
  const start = useCallback(async () => {
    try {
      const loaded = await loadChatSession(sessionId);
      if (!alive.current) return;
      setSession(loaded);
      if (loaded.status !== "in_progress") {
        setEnd((e) => e ?? { reason: "reopened", at: null });
        setPhase({ kind: "ended" });
        return;
      }
      const last = loaded.turns.at(-1);
      if (last && !last.answer) {
        setPhase({ kind: "answering" });
      } else if (last?.answer) {
        // UC-06 AF8: the last answer has no next question yet → show its feedback again first.
        await evaluate(last.answer.id, last.answer.content);
      } else {
        await fetchNext(null, true);
      }
    } catch (error) {
      if (alive.current) setPhase({ kind: "load-error", code: codeOf(error) });
    }
  }, [sessionId, fetchNext, evaluate]);

  // Start once per page. In `npm run dev`, React Strict Mode runs effects twice;
  // without this guard the page asks the API for the same turn twice (409 in the console).
  const started = useRef(false);
  useEffect(() => {
    startRef.current = start;
    if (started.current) return;
    started.current = true;
    // Start after the first render; start() only sets state once data arrives.
    void Promise.resolve().then(start);
  }, [start]);

  async function send(meta: AnswerMeta = answerMeta.current) {
    answerMeta.current = meta;
    const content = draft.trim();
    const last = session?.turns.at(-1);
    if (!session || !last || last.answer || !content || content.length > ANSWER_MAX_CHARS) return;

    // Show the answer right away; roll back if saving fails (the draft stays in the box).
    setNotice(null);
    setSession({
      ...session,
      turns: session.turns.map((t) =>
        t.question.id === last.question.id ? { ...t, answer: { id: "pending", content } } : t,
      ),
    });
    setPhase({ kind: "saving" });

    let answerId: string;
    try {
      answerId = await saveAnswer(session.id, last.question.id, content, meta);
    } catch (error) {
      if (!alive.current) return;
      setSession((s) =>
        s ? { ...s, turns: s.turns.map((t) => (t.question.id === last.question.id ? { ...t, answer: null } : t)) } : s,
      );
      const code = codeOf(error);
      // Retrying cannot fix these: the saved session moved on (another tab, time
      // limit, or an earlier send that was saved). Reload it and say why.
      if (code === "STALE_TURN" || code === "SESSION_CLOSED" || code === "ANSWER_CONFLICT") {
        setNotice(code);
        setDraft(""); // it belonged to a question that is no longer open
        setPhase({ kind: "loading" });
        void startRef.current();
        return;
      }
      setPhase({ kind: "error", code: code === "NETWORK_ERROR" ? "NETWORK_ERROR" : "SAVE_FAILED", retry: "save" });
      return;
    }
    if (!alive.current) return;
    setSession((s) =>
      s
        ? { ...s, turns: s.turns.map((t) => (t.question.id === last.question.id ? { ...t, answer: { id: answerId, content, inputMode: meta.inputMode, durationSeconds: meta.durationSeconds } } : t)) }
        : s,
    );
    setDraft("");
    answerMeta.current = { inputMode: "text", durationSeconds: null };
    await evaluate(answerId, content);
  }

  function retry() {
    if (phase.kind !== "error") return;
    if (phase.retry === "save") {
      void send();
    } else {
      const lastAnswerId = session?.turns.at(-1)?.answer?.id ?? null;
      void fetchNext(lastAnswerId, !session?.turns.length);
    }
  }

  async function confirmEndInterview() {
    if (!session) return;
    scoring.current?.abort();
    scoring.current = null;
    const active = generation.current;
    generation.current = null;
    active?.abort();
    setQuestionPreview("");
    if (active) setPhase({ kind: "error", code: "REQUEST_CANCELLED", retry: "next" });
    setEnding(true);
    setEndError(null);
    try {
      await endSession(session.id);
      if (!alive.current) return;
      setConfirmEnd(false);
      // UC-06: ending before any answer closes the session without a report → back to the Dashboard.
      if (!session.turns.some((t) => t.answer && t.answer.id !== "pending")) {
        router.push("/dashboard");
        return;
      }
      setSession({ ...session, status: "completed" });
      setEnd({ reason: "user", at: Date.now() });
      setPhase({ kind: "ended" });
    } catch (error) {
      if (alive.current) setEndError(CHAT_TEXT[session.settings.language].errors[codeOf(error)]);
    } finally {
      if (alive.current) setEnding(false);
    }
  }

  const closeDialog = useCallback(() => setConfirmEnd(false), []);

  function reload() {
    setPhase({ kind: "loading" });
    void start();
  }

  // ---- Loading and load errors (before we know the session language) ----
  if (!session) {
    const t = CHAT_TEXT.vi;
    if (phase.kind === "load-error") {
      const final = FINAL_LOAD_ERRORS.includes(phase.code);
      return (
        <Card className="mx-auto max-w-lg space-y-3 text-center" role="alert">
          <h1 className="text-lg font-semibold">{t.loadErrorTitle}</h1>
          <p className="text-sm text-red-700">{t.errors[phase.code]}</p>
          <div className="flex flex-col justify-center gap-2 sm:flex-row">
            {phase.code === "UNAUTHORIZED" ? (
              <Link href="/login" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white transition hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
                Đăng nhập
              </Link>
            ) : final ? (
              <Link href="/interview/new" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white">
                {t.newInterview}
              </Link>
            ) : (
              <Button onClick={reload}>{t.retry}</Button>
            )}
            <Link href="/dashboard" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700">
              {t.toDashboard}
            </Link>
          </div>
        </Card>
      );
    }
    // Skeleton in the shape of the page, so the screen is never blank while loading.
    return (
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]" aria-busy="true">
        <div className="min-w-0 space-y-4">
          <div className="h-28 animate-pulse rounded-xl bg-slate-100" />
          <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500" role="status">
              {t.loading}
            </p>
          </div>
        </div>
        <div className="hidden h-64 animate-pulse rounded-xl bg-slate-100 lg:block" />
      </div>
    );
  }

  const text = CHAT_TEXT[session.settings.language];
  const answered = session.turns.filter((t) => t.answer && t.answer.id !== "pending").length;
  const mainAsked = session.turns.filter((t) => t.question.kind === "main").length;
  const last = session.turns.at(-1);
  const waitingForAnswer = !!last && !last.answer;
  const ended = phase.kind === "ended";

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0 space-y-4">
        {USE_MOCK && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{text.mockNotice}</p>
        )}

        <ChatHeader
          text={text}
          settings={session.settings}
          currentQuestion={mainAsked}
          startedAt={session.startedAt}
          running={!ended}
          practice={session.practice}
        />

        <div ref={transcriptRef} className="scroll-mt-4">
        <MessageList
          text={text}
          turns={session.turns}
          thinking={phase.kind === "thinking"}
          saving={phase.kind === "saving"}
          preview={questionPreview}
          generationStatus={generationStatus}
        />
        </div>

        {phase.kind === "thinking" && (
          <Button variant="secondary" onClick={() => generation.current?.abort()}>
            {text.cancelGeneration}
          </Button>
        )}

        {notice && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="status">
            {text.errors[notice]}
          </p>
        )}

        {phase.kind === "error" && (
          <div
            className="flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between"
            role="alert"
          >
            <span>{text.errors[phase.code]}</span>
            {phase.code === "LEASE_LOST" || phase.code === "SESSION_CONTEXT_INVALID" ? (
              <Button variant="secondary" onClick={reload}>
                {text.reload}
              </Button>
            ) : (
              <Button variant="secondary" onClick={retry}>
                {text.retry}
              </Button>
            )}
          </div>
        )}

        {phase.kind === "feedback" && last?.answer ? (
          <AnswerFeedback
            text={FEEDBACK_TEXT[session.settings.language]}
            language={session.settings.language}
            question={last.question}
            answer={last.answer.content}
            durationSeconds={last.answer.inputMode === "voice" ? last.answer.durationSeconds : null}
            state={feedback}
            collapsed={feedbackCollapsed}
            onBack={() => {
              setFeedbackCollapsed(true);
              transcriptRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            onShow={() => setFeedbackCollapsed(false)}
            onRetry={() => void evaluate(phase.answerId, last.answer?.content ?? "")}
            onCancel={() => scoring.current?.abort()}
            onContinue={() => continueInterview(phase.answerId)}
          />
        ) : ended ? (
          <EndScreen
            text={text}
            session={session}
            reason={end?.reason ?? "reopened"}
            endedAt={end?.at ?? null}
            onReview={() => transcriptRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
          />
        ) : (
          <AnswerBox
            // A new question gets a fresh box, so voice state and speaking time never carry over.
            key={last?.question.id ?? "none"}
            text={text}
            language={session.settings.language}
            value={draft}
            onChange={setDraft}
            onSend={(meta) => void send(meta)}
            onEnd={() => setConfirmEnd(true)}
            canAnswer={waitingForAnswer && (phase.kind === "answering" || (phase.kind === "error" && phase.retry === "save"))}
            busy={phase.kind === "saving" || phase.kind === "thinking"}
          />
        )}
      </div>

      <SidePanel text={text} session={session} />

      {confirmEnd && (
        <EndInterviewDialog
          text={text}
          answered={answered}
          busy={ending}
          error={endError}
          onConfirm={() => void confirmEndInterview()}
          onCancel={closeDialog}
        />
      )}
    </div>
  );
}
