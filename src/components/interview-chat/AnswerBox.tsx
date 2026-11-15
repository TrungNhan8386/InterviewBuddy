"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import Button from "@/components/ui/Button";
import type { CHAT_TEXT } from "@/lib/interview-chat/text";
import { ANSWER_MAX_CHARS } from "@/lib/interview-chat/types";

type Props = {
  text: (typeof CHAT_TEXT)["vi"];
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onEnd: () => void;
  canAnswer: boolean; // a question is waiting for an answer
  busy: boolean;
};

// SCRUM-98: answer box with Send and End Interview.
// SCRUM-129: Send stays clickable for an empty answer and explains why nothing was sent (UC06-01 step 3).
export default function AnswerBox({ text, value, onChange, onSend, onEnd, canAnswer, busy }: Props) {
  const [emptyTried, setEmptyTried] = useState(false);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const empty = value.trim().length === 0;
  const tooLong = value.length > ANSWER_MAX_CHARS;
  const canSubmit = canAnswer && !busy && !tooLong;
  const showEmpty = emptyTried && empty && canAnswer;

  function trySend() {
    if (!canSubmit) return;
    if (empty) {
      setEmptyTried(true);
      boxRef.current?.focus();
      return;
    }
    setEmptyTried(false);
    onSend();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      trySend();
    }
  }

  return (
    <form
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      onSubmit={(event) => {
        event.preventDefault();
        trySend();
      }}
    >
      <label htmlFor="answer" className="text-sm font-medium text-slate-700">
        {text.answerLabel}
      </label>
      <textarea
        id="answer"
        ref={boxRef}
        rows={4}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        disabled={!canAnswer}
        placeholder={text.answerPlaceholder}
        aria-describedby="answer-hint"
        aria-invalid={tooLong || showEmpty}
        className={`mt-2 block w-full resize-y rounded-lg border ${showEmpty ? "border-red-400" : "border-slate-300"} px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50`}
      />
      <div className="mt-1 flex flex-wrap justify-between gap-2 text-xs">
        <p
          id="answer-hint"
          className={tooLong || showEmpty ? "text-red-600" : "text-slate-500"}
          role={showEmpty ? "alert" : undefined}
        >
          {tooLong ? text.answerTooLong(ANSWER_MAX_CHARS) : showEmpty ? text.emptyAnswer : text.answerHint}
        </p>
        <span className={tooLong ? "text-red-600" : "text-slate-400"}>
          {value.length}/{ANSWER_MAX_CHARS}
        </span>
      </div>

      <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button variant="secondary" onClick={onEnd} disabled={busy}>
          {text.end}
        </Button>
        <Button type="submit" disabled={!canSubmit}>
          {text.send}
        </Button>
      </div>
    </form>
  );
}
