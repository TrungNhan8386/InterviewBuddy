import { getSignedInClient, apiJson, isSupabaseConfigured } from "@/lib/interview/http";
import { validLanguageBody, sameOrigin } from "@/lib/settings/contract.mjs";

export async function GET(request: Request) {
  if (!isSupabaseConfigured) return apiJson({ error: { message: "Database chưa được cấu hình." } }, 503);
  const auth = await getSignedInClient(request);
  if (!auth) return apiJson({ error: { message: "Vui lòng đăng nhập lại." } }, 401);
  const { data, error } = await auth.supabase.from("profiles").select("preferred_language").eq("id", auth.userId).maybeSingle();
  if (error) return apiJson({ error: { message: "Không tải được cài đặt." } }, 500);
  if (!data) return apiJson({ error: { message: "Chưa tìm thấy hồ sơ. Liên hệ quản trị viên." } }, 404);
  return apiJson({ preferredLanguage: data.preferred_language });
}
export async function PATCH(request: Request) {
  if (!sameOrigin(request)) return apiJson({ error: { message: "Yêu cầu không hợp lệ." } }, 403);
  if (!isSupabaseConfigured) return apiJson({ error: { message: "Database chưa được cấu hình." } }, 503);
  const auth = await getSignedInClient(request);
  if (!auth) return apiJson({ error: { message: "Vui lòng đăng nhập lại." } }, 401);
  const body: unknown = await request.json().catch(() => null);
  if (!validLanguageBody(body)) return apiJson({ error: { message: "Chọn vi hoặc en." } }, 400);
  const { data, error } = await auth.supabase.from("profiles").update({ preferred_language: body.preferredLanguage }).eq("id", auth.userId).select("preferred_language").maybeSingle();
  if (error) return apiJson({ error: { message: "Không lưu được cài đặt." } }, 500);
  if (!data) return apiJson({ error: { message: "Chưa tìm thấy hồ sơ." } }, 404);
  return apiJson({ preferredLanguage: data.preferred_language });
}
