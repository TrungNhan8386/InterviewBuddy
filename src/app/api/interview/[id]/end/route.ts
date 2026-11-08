import type { NextRequest } from "next/server";
import { apiError, apiJson, getSignedInClient, isSupabaseConfigured } from "@/lib/interview/http";
import { isUuid } from "@/lib/interview/session-contract.mjs";

// POST /api/interview/{id}/end – the user pressed "End Interview" (SCRUM-80).
// Marks an in-progress session as completed. Calling it again, or on a session
// the engine already ended, just returns the current status. A question being
// generated at the same time is not saved: /api/interview/next rechecks the
// status before saving and returns action "end".
export async function POST(request: NextRequest, ctx: RouteContext<"/api/interview/[id]/end">) {
  if (!isSupabaseConfigured) return apiError("SERVER_ERROR");

  const auth = await getSignedInClient(request);
  if (!auth) return apiError("UNAUTHORIZED");

  const { id } = await ctx.params;
  if (!isUuid(id)) return apiError("NOT_FOUND");

  const update = await auth.supabase
    .from("interview_sessions")
    .update({ status: "completed", ended_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "in_progress")
    .select("id, status, ended_at")
    .maybeSingle();
  if (update.error) {
    console.error("[api/interview/:id/end] update failed:", update.error.message);
    return apiError("SERVER_ERROR");
  }

  let row = update.data;
  if (!row) {
    const current = await auth.supabase
      .from("interview_sessions")
      .select("id, status, ended_at")
      .eq("id", id)
      .maybeSingle();
    if (current.error) return apiError("SERVER_ERROR");
    if (!current.data) return apiError("NOT_FOUND");
    row = current.data;
  }
  return apiJson({ id: row.id, status: row.status, endedAt: row.ended_at });
}
