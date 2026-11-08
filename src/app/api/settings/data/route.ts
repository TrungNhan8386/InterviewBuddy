import { getSignedInClient, apiJson, isSupabaseConfigured } from "@/lib/interview/http";
import { validDeleteBody, sameOrigin } from "@/lib/settings/contract.mjs";

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return apiJson({ error: { message: "Yêu cầu không hợp lệ." } }, 403);
  if (!isSupabaseConfigured) return apiJson({ error: { message: "Database chưa được cấu hình." } }, 503);
  const auth = await getSignedInClient(request);
  if (!auth) return apiJson({ error: { message: "Vui lòng đăng nhập lại." } }, 401);
  const body: unknown = await request.json().catch(() => null);
  if (!validDeleteBody(body)) return apiJson({ error: { message: "Nhập DELETE để xác nhận." } }, 400);
  const { data, error } = await auth.supabase.rpc("delete_own_practice_data");
  if (error) return apiJson({ error: { message: ["42883", "PGRST202"].includes(error.code) ? "Chưa sẵn sàng xóa dữ liệu. Liên hệ quản trị viên để cập nhật database." : "Không xóa được dữ liệu. Hãy kiểm tra lại trước khi thử lại." } }, ["42883", "PGRST202"].includes(error.code) ? 503 : 500);
  return apiJson(data);
}
