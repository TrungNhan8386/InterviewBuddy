"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ChatHeader from "./ChatHeader";
import MessageList from "./MessageList";
import AnswerBox from "./AnswerBox";
import SidePanel from "./SidePanel";
import EndInterviewDialog from "./EndInterviewDialog";
import { USE_MOCK, endSession, loadChatSession, requestNext, saveAnswer } from "@/lib/interview-chat/client";
import { CHAT_TEXT } from "@/lib/interview-chat/text";
import {
  ANSWER_MAX_CHARS,
  InterviewChatError,
  type ChatErrorCode,
  type ChatSession,
} from "@/lib/interview-chat/types";

// Screen 4 (Chat Interview), /interview/[id]. Owner: Khang. Jira: SCRUM-95.
// Flow per turn (docs/api/INTERVIEW_NEXT_API_v1.md):
//   1. save the answer  2. POST /api/interview/next with afterAnswerId = saved answer id
//   3. show the next question, or the "ended" state when action = "end".
// Reloading the page resumes where it stopped: the last unanswered question is shown again,
// or the next question is requested with the latest saved answer id.

type Phase =
  | { kind: "loading" }
  | { kind: "load-error"; code: ChatErrorCode }
  | { kind: "answering" }
  | { kind: "saving" }
  | { kind: "thinking" }
  | { kind: "error"; code: ChatErrorCode; retry: "save" | "next" }
  | { kind: "ended" };

const MAX_BUSY_RETRIES = 5; // GENERATION_IN_PROGRESS: wait 2 s and ask for the same turn again
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const codeOf = (error: unknown): ChatErrorCode =>
  error instanceof InterviewChatError ? error.code : "SERVER_ERROR";

export default function InterviewChat({ sessionId }: { sessionId: string }) {
  const [session, setSession] = useState<ChatSession | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [draft, setDraft] = useState("");
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [ending, setEnding] = useState(false);
  const [endError, setEndError] = useState<string | null>(null);

  // Ignore results that arrive after the user left the page.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // fetchNext needs start() to reload after STALE_TURN; a ref avoids a circular dependency.
  const startRef = useRef<() => Promise<void>>(async () => {});

  const fetchNext = useCallback(
    async (afterAnswerId: string | null, isOpening: boolean) => {
      setPhase({ kind: "thinking" });
      for (let attempt = 0; ; attempt++) {
        try {
          const next = await requestNext(sessionId, afterAnswerId);
          if (!alive.current) return;
          if (next.action === "end" || !next.question) {
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
          if (!alive.current) return;
          const code = codeOf(error);
          if (code === "GENERATION_IN_PROGRESS" && attempt < MAX_BUSY_RETRIES) {
            await wait(2000);
            continue;
          }
          if (code === "STALE_TURN") {
            // Another tab moved the interview on: reload the saved history and continue.
            setPhase({ kind: "loading" });
            void startRef.current();
            return;
          }
          setPhase({ kind: "error", code, retry: "next" });
          return;
        }
      }
    },
    [sessionId],
  );

  // Loads the saved session and resumes it. Callers show the loading state themselves.
  const start = useCallback(async () => {
    try {
      const loaded = await loadChatSession(sessionId);
      if (!alive.current) return;
      setSession(loaded);
      if (loaded.status !== "in_progress") {
        setPhase({ kind: "ended" });
        return;
      }
      const last = loaded.turns.at(-1);
      if (last && !last.answer) {
        setPhase({ kind: "answering" });
      } else {
        await fetchNext(last?.answer?.id ?? null, !last);
      }
    } catch (error) {
      if (alive.current) setPhase({ kind: "load-error", code: codeOf(error) });
    }
  }, [sessionId, fetchNext]);

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

  async function send() {
    const content = draft.trim();
    const last = session?.turns.at(-1);
    if (!session || !last || last.answer || !content || content.length > ANSWER_MAX_CHARS) return;

    // Show the answer right away; roll back if saving fails (the draft stays in the box).
    setSession({
      ...session,
      turns: session.turns.map((t) =>
        t.question.id === last.question.id ? { ...t, answer: { id: "pending", content } } : t,
      ),
    });
    setPhase({ kind: "saving" });

    let answerId: string;
    try {
      answerId = await saveAnswer(session.id, last.question.id, content);
    } catch (error) {
      if (!alive.current) return;
      setSession((s) =>
        s ? { ...s, turns: s.turns.map((t) => (t.question.id === last.question.id ? { ...t, answer: null } : t)) } : s,
      );
      setPhase({ kind: "error", code: codeOf(error) === "NETWORK_ERROR" ? "NETWORK_ERROR" : "SAVE_FAILED", retry: "save" });
      return;
    }
    if (!alive.current) return;
    setSession((s) =>
      s
        ? { ...s, turns: s.turns.map((t) => (t.question.id === last.question.id ? { ...t, answer: { id: answerId, content } } : t)) }
        : s,
    );
    setDraft("");
    await fetchNext(answerId, false);
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
    setEnding(true);
    setEndError(null);
    try {
      await endSession(session.id);
      if (!alive.current) return;
      setSession({ ...session, status: "completed" });
      setConfirmEnd(false);
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
      return (
        <Card className="mx-auto max-w-lg space-y-3 text-center" role="alert">
          <p className="font-medium text-red-700">{t.errors[phase.code]}</p>
          <div className="flex flex-col justify-center gap-2 sm:flex-row">
            {phase.code === "UNAUTHORIZED" ? (
              <Link href="/login" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white">
                Đăng nhập
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
    return (
      <p className="py-16 text-center text-sm text-slate-500" role="status">
        {t.loading}
      </p>
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
        />

        <MessageList
          text={text}
          turns={session.turns}
          thinking={phase.kind === "thinking"}
          saving={phase.kind === "saving"}
        />

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

        {ended ? (
          <Card className="space-y-3 text-center">
            <h2 className="text-lg font-semibold">{text.endedTitle}</h2>
            <p className="text-sm text-slate-600">{text.endedBody}</p>
            <div className="flex flex-col justify-center gap-2 sm:flex-row">
              <Link href="/dashboard" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700">
                {text.toDashboard}
              </Link>
              <Link href="/interview/new" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-100">
                {text.newInterview}
              </Link>
            </div>
          </Card>
        ) : (
          <AnswerBox
            text={text}
            value={draft}
            onChange={setDraft}
            onSend={() => void send()}
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
