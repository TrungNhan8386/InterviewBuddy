"use client";

import type { KeyboardEvent } from "react";
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
export default function AnswerBox({ text, value, onChange, onSend, onEnd, canAnswer, busy }: Props) {
  const length = value.trim().length;
  const tooLong = value.length > ANSWER_MAX_CHARS;
  const canSend = canAnswer && !busy && length > 0 && !tooLong;

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      if (canSend) onSend();
    }
  }

  return (
    <form
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSend) onSend();
      }}
    >
      <label htmlFor="answer" className="text-sm font-medium text-slate-700">
        {text.answerLabel}
      </label>
      <textarea
        id="answer"
        rows={4}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        disabled={!canAnswer}
        placeholder={text.answerPlaceholder}
        aria-describedby="answer-hint"
        aria-invalid={tooLong}
        className="mt-2 block w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50"
      />
      <div className="mt-1 flex flex-wrap justify-between gap-2 text-xs">
        <p id="answer-hint" className={tooLong ? "text-red-600" : "text-slate-500"}>
          {tooLong ? text.answerTooLong(ANSWER_MAX_CHARS) : text.answerHint}
        </p>
        <span className={tooLong ? "text-red-600" : "text-slate-400"}>
          {value.length}/{ANSWER_MAX_CHARS}
        </span>
      </div>

      <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button variant="secondary" onClick={onEnd} disabled={busy}>
          {text.end}
        </Button>
        <Button type="submit" disabled={!canSend}>
          {text.send}
        </Button>
      </div>
    </form>
  );
}
