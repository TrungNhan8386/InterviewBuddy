import Link from "next/link";
import { redirect } from "next/navigation";
import Card from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect("/login");
  const [total, recent] = await Promise.all([
    client.from("interview_sessions").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    client.from("interview_sessions").select("id,title,target_position,round_type,status,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(5),
  ]);
  const status: Record<string, string> = { in_progress: "Đang luyện tập", completed: "Hoàn thành", abandoned: "Đã dừng" };
  return <div className="space-y-6">
    <h1 className="text-2xl font-bold">Dashboard</h1>
    <section className="rounded-2xl border border-indigo-100 bg-indigo-50 p-6 sm:p-8"><h2 className="text-xl font-bold">Ready for your next interview?</h2><p className="my-4 text-sm text-slate-600">Thiết lập buổi luyện tập phù hợp với mục tiêu của bạn.</p><Link className="inline-flex min-h-11 items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600" href="/interview/new">Start New Interview</Link></section>
    <section aria-label="Thống kê tổng quan" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card><h2 className="text-sm text-slate-500">Total Sessions</h2><p className="mt-3 text-xl font-bold">{total.error ? "—" : total.count ?? 0}</p><p className="mt-2 text-xs text-slate-500">{total.error ? "Chưa tải được tổng số phiên. Hãy tải lại trang." : "Tất cả phiên của bạn"}</p></Card>
      {["Average Score", "Latest Score", "Strongest Area"].map(label => <Card key={label}><h2 className="text-sm text-slate-500">{label}</h2><p className="mt-3 text-xl font-bold">—</p><p className="mt-2 text-xs text-slate-500">Tính năng sẽ được bổ sung sau.</p></Card>)}
    </section>
    <Card><h2 className="text-lg font-semibold">Recent Sessions</h2><p className="mt-1 text-sm text-slate-500">Tối đa 5 phiên được tạo gần nhất.</p>
      {recent.error ? <p role="alert" className="mt-4 text-red-700">Không tải được danh sách. Hãy tải lại trang.</p> : recent.data.length === 0 ? <p className="mt-4">Bạn chưa có phiên nào. <Link className="text-indigo-700 underline" href="/interview/new">Thiết lập phiên đầu tiên</Link></p> : <ul className="mt-4 divide-y divide-slate-100">{recent.data.map(session => <li key={session.id} className="flex flex-wrap justify-between gap-3 py-4"><div className="min-w-0"><Link className="break-words font-semibold text-indigo-700 underline" href={`/interview/${session.id}`}>{session.target_position || session.title || "Phiên phỏng vấn"}</Link><p className="mt-1 text-sm text-slate-500">{session.round_type} · {new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(session.created_at))}</p></div><span className="text-sm">{status[session.status] ?? session.status}</span></li>)}</ul>}
    </Card>
  </div>;
}
