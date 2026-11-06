"use client";

import { useEffect, useRef } from "react";
import type { CHAT_TEXT } from "@/lib/interview-chat/text";
import type { ChatTurn } from "@/lib/interview-chat/types";

type Props = {
  text: (typeof CHAT_TEXT)["vi"];
  turns: ChatTurn[];
  thinking: boolean; // waiting for the next question
  saving: boolean; // the last answer is being saved
};

// SCRUM-97: AI questions, follow-up labels and the user's answers.
export default function MessageList({ text, turns, thinking, saving }: Props) {
  const endRef = useRef<HTMLDivElement>(null);
  const lastAnswerId = turns.at(-1)?.answer?.id;

  // Keep the newest message in view.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns.length, lastAnswerId, thinking]);

  return (
    <div
      className="flex min-h-64 flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      aria-live="polite"
      aria-relevant="additions"
    >
      {turns.length === 0 && !thinking && (
        <p className="py-8 text-center text-sm text-slate-500">{text.emptyTranscript}</p>
      )}

      {turns.map(({ question, answer }) => (
        <div key={question.id} className="flex flex-col gap-3">
          <div className="max-w-[90%] self-start sm:max-w-[80%]">
            <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-medium text-slate-700">{text.interviewer}</span>
              {question.kind === "follow_up" && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800">
                  {text.followUp}
                </span>
              )}
              {question.topic && (
                <span className="break-words">
                  {text.topic}: {question.topic}
                </span>
              )}
            </div>
            <p className="whitespace-pre-wrap break-words rounded-2xl rounded-tl-sm bg-slate-100 px-4 py-3 text-sm text-slate-900">
              {question.content}
            </p>
          </div>

          {answer && (
            <div className="max-w-[90%] self-end sm:max-w-[80%]">
              <p className="mb-1 text-right text-xs font-medium text-slate-700">{text.you}</p>
              <p className="whitespace-pre-wrap break-words rounded-2xl rounded-tr-sm bg-indigo-600 px-4 py-3 text-sm text-white">
                {answer.content}
              </p>
            </div>
          )}
        </div>
      ))}

      {(thinking || saving) && (
        <div className="flex items-center gap-2 self-start text-sm text-slate-500" role="status">
          <span className="flex gap-1" aria-hidden="true">
            <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" />
          </span>
          {saving ? text.saving : text.thinking}
        </div>
      )}

      <div ref={endRef} />
    </div>
  );
}
