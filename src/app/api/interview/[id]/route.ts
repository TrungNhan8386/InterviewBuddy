import type { NextRequest } from "next/server";
import { apiError, apiJson, getSignedInClient, isSupabaseConfigured } from "@/lib/interview/http";
import {
  isUuid,
  toProgress,
  toResumeState,
  toSessionResponse,
  toTurns,
  type SessionStatus,
} from "@/lib/interview/session-contract.mjs";

// GET /api/interview/{id} – settings of one session, its linked fit analysis,
// every question with its answer, and what the chat page should do next
// (resume, SCRUM-80). Another user's session returns 404 (not 403), so ids
// cannot be probed.
export async function GET(request: NextRequest, ctx: RouteContext<"/api/interview/[id]">) {
  if (!isSupabaseConfigured) return apiError("SERVER_ERROR");

  const auth = await getSignedInClient(request);
  if (!auth) return apiError("UNAUTHORIZED");

  const { id } = await ctx.params;
  if (!isUuid(id)) return apiError("NOT_FOUND");

  const [session, questions] = await Promise.all([
    auth.supabase
      .from("interview_sessions")
      .select(
        "id, status, created_at, started_at, ended_at, round_type, difficulty, language, target_position, " +
          "interview_date, duration_minutes, input_mode, planned_questions, " +
          "fit_analyses (id, fit_score, language, created_at, result)",
      )
      .eq("id", id)
      .maybeSingle(),
    auth.supabase
      .from("questions")
      .select("id, position, kind, topic, content, created_at, answers (id, content, input_mode, duration_seconds, created_at)")
      .eq("session_id", id)
      .order("position"),
  ]);

  if (session.error || questions.error) {
    console.error("[api/interview/:id] select failed:", (session.error ?? questions.error)?.message);
    return apiError("SERVER_ERROR");
  }
  if (!session.data) return apiError("NOT_FOUND");

  const row = session.data as unknown as Record<string, unknown>;
  // Questions start only on the first /next call; before that the timer has not started.
  const turns = toTurns((questions.data ?? []) as unknown as Record<string, unknown>[]);
  const base = toSessionResponse(row);
  return apiJson({
    ...base,
    startedAt: turns.length ? base.startedAt : null,
    turns,
    progress: toProgress(turns, base.settings.plannedQuestions),
    resume: toResumeState(row.status as SessionStatus, turns),
  });
}
