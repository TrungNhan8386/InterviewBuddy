"use client";

import { useEffect, useRef } from "react";
import Button from "@/components/ui/Button";
import type { CHAT_TEXT } from "@/lib/interview-chat/text";

type Props = {
  text: (typeof CHAT_TEXT)["vi"];
  answered: number;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

// SCRUM-98: confirmation before ending the interview.
export default function EndInterviewDialog({ text, answered, busy, error, onConfirm, onCancel }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Focus "Keep going" first so Enter does not end the interview by accident.
    boxRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div
        ref={boxRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="end-title"
        aria-describedby="end-body"
        className="w-full max-w-sm rounded-xl bg-white p-5 shadow-lg"
      >
        <h2 id="end-title" className="text-lg font-semibold">
          {text.endConfirmTitle}
        </h2>
        <p id="end-body" className="mt-2 text-sm text-slate-600">
          {text.endConfirmBody(answered)}
        </p>
        {error && <p className="mt-2 text-sm text-red-600" role="alert">{error}</p>}
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            {text.endConfirmNo}
          </Button>
          <Button onClick={onConfirm} disabled={busy}>
            {text.endConfirmYes}
          </Button>
        </div>
      </div>
    </div>
  );
}
