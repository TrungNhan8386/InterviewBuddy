import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

// GET /api/health        -> checks Supabase (database + auth) and that the Gemini model exists.
// GET /api/health?ai=1   -> also asks Gemini for a one-word reply (uses a little quota).
//                           Allowed in development, or for a signed-in user.
// Never returns keys; only "ok" or an error message.

type Check = { status: "ok" | "error" | "skipped"; detail?: string };

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

export async function GET(request: NextRequest) {
  const supabase: Record<string, Check> = {};
  let signedIn = false;

  if (!isSupabaseConfigured) {
    supabase.database = { status: "error", detail: "NEXT_PUBLIC_SUPABASE_* is not set" };
  } else {
    try {
      const client = await createClient();

      const { error } = await client.from("profiles").select("id", { count: "exact", head: true });
      supabase.database = error ? { status: "error", detail: error.message } : { status: "ok" };

      const { data } = await client.auth.getClaims();
      signedIn = Boolean(data?.claims?.sub);
      supabase.auth = { status: "ok", detail: signedIn ? "signed in" : "not signed in" };
    } catch (e) {
      supabase.database = { status: "error", detail: errorMessage(e) };
    }
  }

  const gemini: Record<string, Check> = {};
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL;

  if (!apiKey || !model) {
    gemini.model = { status: "error", detail: "GEMINI_API_KEY or GEMINI_MODEL is not set" };
  } else {
    gemini.model = await checkModel(apiKey, model);

    const wantsAi = request.nextUrl.searchParams.get("ai") === "1";
    const allowed = process.env.NODE_ENV === "development" || signedIn;
    if (!wantsAi) {
      gemini.generate = { status: "skipped", detail: "add ?ai=1 to test a real AI reply" };
    } else if (!allowed) {
      gemini.generate = { status: "skipped", detail: "sign in first (protects the free quota)" };
    } else {
      gemini.generate = await checkGenerate(apiKey, model);
    }
  }

  const all = [...Object.values(supabase), ...Object.values(gemini)];
  const ok = all.every((c) => c.status !== "error");

  return NextResponse.json(
    { ok, supabase, gemini: { modelName: model ?? null, ...gemini } },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}

async function checkModel(apiKey: string, model: string): Promise<Check> {
  try {
    const res = await fetch(`${GEMINI_BASE}/models/${encodeURIComponent(model)}`, {
      headers: { "x-goog-api-key": apiKey },
      cache: "no-store",
    });
    if (res.ok) return { status: "ok" };
    const body = await res.json().catch(() => null);
    return { status: "error", detail: `${res.status} ${body?.error?.message ?? ""}`.trim() };
  } catch (e) {
    return { status: "error", detail: errorMessage(e) };
  }
}

async function checkGenerate(apiKey: string, model: string): Promise<Check> {
  try {
    const res = await fetch(`${GEMINI_BASE}/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Reply with exactly one word: OK" }] }],
        generationConfig: { maxOutputTokens: 20, thinkingConfig: { thinkingBudget: 0 } },
      }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      return { status: "error", detail: `${res.status} ${body?.error?.message ?? ""}`.trim() };
    }
    const text: string = body?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return { status: "ok", detail: `AI replied: ${text.trim().slice(0, 40)}` };
  } catch (e) {
    return { status: "error", detail: errorMessage(e) };
  }
}

function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}
