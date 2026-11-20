"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import Button from "@/components/ui/Button";
import { useSpeechInput } from "@/lib/interview-chat/speech";
import type { CHAT_TEXT } from "@/lib/interview-chat/text";
import { ANSWER_MAX_CHARS, type AnswerMeta, type InterviewLanguage } from "@/lib/interview-chat/types";

type Props = {
  text: (typeof CHAT_TEXT)["vi"];
  language: InterviewLanguage;
  value: string;
  onChange: (value: string) => void;
  onSend: (meta: AnswerMeta) => void;
  onEnd: () => void;
  canAnswer: boolean; // a question is waiting for an answer
  busy: boolean;
};

function MicIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" strokeLinecap="round" />
    </svg>
  );
}

// SCRUM-98: answer box with Send and End Interview.
// SCRUM-129: Send stays clickable for an empty answer and explains why nothing was sent (UC06-01 step 3).
// SCRUM-180/182/183 (UC-07): microphone button. The transcript goes into this same box, where it
// can be edited; the edited text is what is sent. The parent remounts this box for every question
// (key = question id), so the speaking time always belongs to one answer.
export default function AnswerBox({ text, language, value, onChange, onSend, onEnd, canAnswer, busy }: Props) {
  const [emptyTried, setEmptyTried] = useState(false);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const voice = useSpeechInput({ language, onText: onChange });

  const empty = value.trim().length === 0;
  const tooLong = value.length > ANSWER_MAX_CHARS;
  const canSubmit = canAnswer && !busy && !tooLong && !voice.listening;
  const showEmpty = emptyTried && empty && canAnswer;

  // Stop listening when the question can no longer be answered (time up, interview ended).
  const { listening, stop } = voice;
  useEffect(() => {
    if (listening && (!canAnswer || busy)) stop();
  }, [listening, canAnswer, busy, stop]);

  function trySend() {
    if (!canSubmit) return;
    if (empty) {
      setEmptyTried(true);
      boxRef.current?.focus();
      return;
    }
    setEmptyTried(false);
    // A voice answer is one where speech was recognised; the edited text is still what is sent.
    const durationSeconds = voice.spokenSeconds();
    onSend({ inputMode: durationSeconds !== null ? "voice" : "text", durationSeconds });
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      trySend();
    }
  }

  function toggleMic() {
    if (voice.listening) {
      voice.stop();
      return;
    }
    setEmptyTried(false);
    voice.start(value); // new speech is added after the text already in the box (UC-07 AF5)
  }

  function onType(next: string) {
    onChange(next);
    // Clearing the box starts the answer over: the earlier speaking time no longer counts.
    if (!next.trim()) voice.reset();
  }

  const voiceMessage = voice.error ? text.voiceErrors[voice.error] : null;
  const hint = tooLong
    ? text.answerTooLong(ANSWER_MAX_CHARS)
    : showEmpty
      ? text.emptyAnswer
      : voice.listening
        ? text.voiceStopFirst
        : text.answerHint;

  return (
    <form
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      onSubmit={(event) => {
        event.preventDefault();
        trySend();
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor="answer" className="text-sm font-medium text-slate-700">
          {text.answerLabel}
        </label>
        {voice.supported && (
          <button
            type="button"
            onClick={toggleMic}
            disabled={!canAnswer || busy}
            aria-pressed={voice.listening}
            className={`inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50 ${
              voice.listening
                ? "border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
            }`}
          >
            {voice.listening ? (
              <span aria-hidden="true" className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-600" />
            ) : (
              <MicIcon />
            )}
            {voice.listening ? text.voiceStop : text.voiceStart}
          </button>
        )}
      </div>

      {voice.listening && (
        <p className="mt-2 text-sm text-red-700" role="status" aria-live="polite">
          {text.voiceListening}
        </p>
      )}
      {voice.supported === false && <p className="mt-2 text-xs text-slate-500">{text.voiceUnsupported}</p>}
      {voiceMessage && (
        <div
          className="mt-2 flex items-start justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
          role="alert"
        >
          <span>{voiceMessage}</span>
          <button
            type="button"
            onClick={voice.clearError}
            className="shrink-0 text-xs font-medium text-amber-900 underline"
          >
            {text.voiceDismiss}
          </button>
        </div>
      )}

      <textarea
        id="answer"
        ref={boxRef}
        rows={4}
        value={value}
        onChange={(event) => onType(event.target.value)}
        onKeyDown={onKeyDown}
        disabled={!canAnswer}
        readOnly={voice.listening}
        placeholder={voice.supported ? text.answerPlaceholderVoice : text.answerPlaceholder}
        aria-describedby="answer-hint"
        aria-invalid={tooLong || showEmpty}
        className={`mt-2 block w-full resize-y rounded-lg border ${showEmpty ? "border-red-400" : voice.listening ? "border-red-300 bg-red-50/40" : "border-slate-300"} px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50`}
      />
      <div className="mt-1 flex flex-wrap justify-between gap-2 text-xs">
        <p
          id="answer-hint"
          className={tooLong || showEmpty ? "text-red-600" : "text-slate-500"}
          role={showEmpty ? "alert" : undefined}
        >
          {hint}
        </p>
        <span className={tooLong ? "text-red-600" : "text-slate-400"}>
          {value.length}/{ANSWER_MAX_CHARS}
        </span>
      </div>

      <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button
          variant="secondary"
          onClick={() => {
            voice.stop();
            onEnd();
          }}
          disabled={busy}
        >
          {text.end}
        </Button>
        <Button type="submit" disabled={!canSubmit}>
          {text.send}
        </Button>
      </div>
    </form>
  );
}
