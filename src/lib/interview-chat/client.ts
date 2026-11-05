import { createClient } from "@/lib/supabase/client";
import { mockEndSession, mockLoadSession, mockRequestNext, mockSaveAnswer } from "./mock";
import type { ChatErrorCode, ChatSession, ChatSettings, ChatTurn, NextResult, SessionStatus } from "./types";
import { InterviewChatError } from "./types";

// Data access for /interview/[id] (SCRUM-95). Owner: Khang.
// - Settings and linked analysis: GET /api/interview/{id} (Nhân, SCRUM-56/57).
// - Questions, answers, started_at: browser Supabase client; RLS only returns
//   the signed-in user's rows (same pattern as fit_analyses, SCRUM-72).
// - Next question: POST /api/interview/next (Hưng, SCRUM-92/93).
// - Saving an answer: insert into answers (RLS "answers: own questions").
//   If Nhân adds an answer API in SCRUM-80, only saveAnswer() needs to change.

export const USE_MOCK = process.env.NEXT_PUBLIC_INTERVIEW_MOCK === "1";

const KNOWN_CODES = new Set<ChatErrorCode>([
  "BAD_INPUT", "UNAUTHORIZED", "NOT_FOUND", "STALE_TURN", "GENERATION_IN_PROGRESS",
  "LEASE_LOST", "SESSION_CONTEXT_INVALID", "AI_CONTENT_BLOCKED", "AI_RATE_LIMITED",
  "INVALID_OUTPUT", "AI_UNAVAILABLE", "DATABASE_NOT_READY", "AI_NOT_CONFIGURED", "AI_TIMEOUT",
]);

function toCode(status: number, code: unknown): ChatErrorCode {
  if (typeof code === "string" && KNOWN_CODES.has(code as ChatErrorCode)) return code as ChatErrorCode;
  // AI_CONFIGURATION_ERROR and other server-only codes
  if (code === "AI_CONFIGURATION_ERROR") return "AI_NOT_CONFIGURED";
  if (status === 401) return "UNAUTHORIZED";
  if (status === 404) return "NOT_FOUND";
  if (status === 429) return "AI_RATE_LIMITED";
  if (status === 504) return "AI_TIMEOUT";
  return "SERVER_ERROR";
}

async function callJson(url: string, init?: RequestInit): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, cache: "no-store" });
  } catch {
    throw new InterviewChatError("NETWORK_ERROR");
  }
  const body = (await res.json().catch(() => null)) as { error?: { code?: string } } | null;
  if (!res.ok || !body || body.error) {
    throw new InterviewChatError(toCode(res.status, body?.error?.code));
  }
  return body;
}

type SessionApiResponse = {
  id: string;
  status: SessionStatus;
  settings: ChatSettings;
  analysis: null | { result?: { matched?: { skill: string }[]; missing?: { skill: string }[] } };
};

type QuestionRow = {
  id: string;
  position: number;
  kind: "main" | "follow_up" | "practice";
  topic: string | null;
  content: string;
  // One-to-one relation (answers.question_id is unique): PostgREST returns an object,
  // older clients may return an array.
  answers: { id: string; content: string } | { id: string; content: string }[] | null;
};

export async function loadChatSession(id: string): Promise<ChatSession> {
  if (USE_MOCK) return mockLoadSession(id);

  const api = (await callJson(`/api/interview/${encodeURIComponent(id)}`)) as SessionApiResponse;
  const supabase = createClient();
  const [sessionRow, questionRows] = await Promise.all([
    supabase.from("interview_sessions").select("started_at, status").eq("id", id).maybeSingle(),
    supabase
      .from("questions")
      .select("id, position, kind, topic, content, answers(id, content)")
      .eq("session_id", id)
      .order("position", { ascending: true }),
  ]);
  if (sessionRow.error || questionRows.error) throw new InterviewChatError("SERVER_ERROR");
  if (!sessionRow.data) throw new InterviewChatError("NOT_FOUND");

  const turns: ChatTurn[] = ((questionRows.data ?? []) as QuestionRow[])
    .filter((q) => q.kind !== "practice")
    .map((q) => {
      const answer = Array.isArray(q.answers) ? (q.answers[0] ?? null) : q.answers;
      return {
        question: {
          id: q.id,
          position: q.position,
          kind: q.kind as "main" | "follow_up",
          topic: q.topic ?? "",
          content: q.content,
        },
        answer: answer ? { id: answer.id, content: answer.content } : null,
      };
    });

  const result = api.analysis?.result;
  return {
    id: api.id,
    status: sessionRow.data.status ?? api.status,
    startedAt: sessionRow.data.started_at ?? null,
    settings: api.settings,
    skills: result
      ? {
          matched: (result.matched ?? []).map((m) => m.skill).filter(Boolean),
          missing: (result.missing ?? []).map((m) => m.skill).filter(Boolean),
        }
      : null,
    turns,
  };
}

// Returns the id of the saved answer. Saving the same question twice
// (double click, retry after a lost response) returns the existing answer.
export async function saveAnswer(sessionId: string, questionId: string, content: string): Promise<string> {
  if (USE_MOCK) return mockSaveAnswer(sessionId, questionId, content);

  const supabase = createClient();
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  const { data, error } = await supabase
    .from("answers")
    .insert({ question_id: questionId, content, input_mode: "text", word_count: words })
    .select("id")
    .single();
  if (!error && data) return data.id as string;

  if (error?.code === "23505") {
    // unique_violation: this question already has an answer
    const existing = await supabase.from("answers").select("id").eq("question_id", questionId).maybeSingle();
    if (existing.data) return existing.data.id as string;
  }
  throw new InterviewChatError("SAVE_FAILED", error?.message);
}

export async function requestNext(sessionId: string, afterAnswerId: string | null): Promise<NextResult> {
  if (USE_MOCK) return mockRequestNext(sessionId, afterAnswerId);

  const body = (await callJson("/api/interview/next", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, afterAnswerId }),
  })) as NextResult;
  if (!body || !["follow_up", "next_topic", "end"].includes(body.action)) {
    throw new InterviewChatError("INVALID_OUTPUT");
  }
  if (body.action !== "end" && (!body.question || typeof body.question.content !== "string")) {
    throw new InterviewChatError("INVALID_OUTPUT");
  }
  return { action: body.action, question: body.action === "end" ? null : body.question };
}

// "End interview" button. RLS policy "interview_sessions: own rows" allows the update.
export async function endSession(sessionId: string): Promise<void> {
  if (USE_MOCK) return mockEndSession(sessionId);

  const supabase = createClient();
  const { error } = await supabase
    .from("interview_sessions")
    .update({ status: "completed", ended_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("status", "in_progress");
  if (error) throw new InterviewChatError("SERVER_ERROR", error.message);
}
