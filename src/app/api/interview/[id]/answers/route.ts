import type { NextRequest } from "next/server";
import { apiError, apiJson, getSignedInClient, isSupabaseConfigured } from "@/lib/interview/http";
import { isUuid, validateSaveAnswer, type InterviewApiErrorCode } from "@/lib/interview/session-contract.mjs";

// POST /api/interview/{id}/answers – save the user's answer to the current
// question as soon as it is sent (SCRUM-80). The chat page then calls
// POST /api/interview/next with afterAnswerId = the returned answer id.
// Sending the same question again returns the stored answer (200), so the
// page can safely retry after a network error.
export async function POST(request: NextRequest, ctx: RouteContext<"/api/interview/[id]/answers">) {
  if (!isSupabaseConfigured) return apiError("SERVER_ERROR");

  const auth = await getSignedInClient(request);
  if (!auth) return apiError("UNAUTHORIZED");

  const { id } = await ctx.params;
  if (!isUuid(id)) return apiError("NOT_FOUND");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("BAD_INPUT", { body: "Request body must be valid JSON." });
  }

  const validation = validateSaveAnswer(body);
  if (!validation.ok) return apiError("BAD_INPUT", validation.fields);
  const answer = validation.value;

  // Runs as the user (security invoker), so RLS still checks ownership.
  const { data, error } = await auth.supabase.rpc("save_interview_answer", {
    p_session_id: id,
    p_question_id: answer.questionId,
    p_content: answer.content,
    p_input_mode: answer.inputMode,
    p_duration_seconds: answer.durationSeconds,
  });

  if (error) {
    console.error("[api/interview/:id/answers] save failed:", error.code, error.message);
    return apiError("SERVER_ERROR");
  }
  if (data?.error) return apiError(data.error as InterviewApiErrorCode);

  // A retry is only safe when it sends the same text. If the first request was
  // saved but its response was lost and the user edited the answer, tell the
  // page so it reloads the saved answer instead of showing the edited one.
  if (data.alreadySaved) {
    const stored = await auth.supabase.from("answers").select("content").eq("id", data.answer.id).maybeSingle();
    if (stored.error || !stored.data) return apiError("SERVER_ERROR");
    if (stored.data.content !== answer.content) return apiError("ANSWER_CONFLICT");
  }
  return apiJson(data, data.alreadySaved ? 200 : 201);
}
