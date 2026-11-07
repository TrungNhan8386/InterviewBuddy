import Link from "next/link";
import { redirect } from "next/navigation";
import Card from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/server";

type Session = {
  id: string;
  title: string | null;
  target_position: string | null;
  round_type: string;
  status: string;
  created_at: string;
};

const roundLabels: Record<string, string> = {
  hr: "HR Interview",
  technical: "Technical Interview",
  behavioral: "Behavioral Interview",
};

const statusLabels: Record<string, string> = {
  in_progress: "Đang thực hiện",
  completed: "Đã hoàn thành",
  abandoned: "Đã dừng",
};

function displayDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const [countResult, recentResult] = await Promise.all([
    supabase
      .from("interview_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),

    supabase
      .from("interview_sessions")
      .select(
        "id, title, target_position, round_type, status, created_at"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(5),
  ]);

  const sessions: Session[] = recentResult.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          Tổng số phiên và danh sách gần đây được lấy từ tài khoản
          của bạn. Phần đánh giá điểm sẽ được bổ sung sau.
        </p>
      </div>

      <section className="rounded-2xl border border-indigo-100 bg-indigo-50 p-6 sm:p-8">
        <p className="text-xs font-semibold tracking-widest text-indigo-600">
          WELCOME BACK!
        </p>

        <h2 className="mt-3 text-2xl font-bold sm:text-3xl">
          Ready for your next interview?
        </h2>

        <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
          Thiết lập một buổi luyện tập phù hợp với vị trí và mục tiêu
          nghề nghiệp của bạn.
        </p>

        <Link
          href="/interview/new"
          className="mt-5 inline-flex min-h-11 items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          Start New Interview
        </Link>
      </section>

      <section
        aria-label="Thống kê tổng quan"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <Card>
          <h2 className="text-sm text-slate-500">Total Sessions</h2>

          <p className="mt-3 text-2xl font-bold">
            {countResult.error ? "—" : countResult.count ?? 0}
          </p>

          <p className="mt-2 text-xs text-slate-500">
            Tất cả phiên đã tạo của bạn.
          </p>

          {countResult.error && (
            <p role="alert" className="mt-2 text-sm text-red-600">
              Chưa tải được tổng số phiên. Vui lòng tải lại trang.
            </p>
          )}
        </Card>

        {[
          { label: "Average Score", note: "Điểm trung bình" },
          { label: "Latest Score", note: "Điểm phiên gần nhất" },
          { label: "Strongest Area", note: "Kỹ năng nổi bật" },
        ].map((item) => (
          <Card key={item.label}>
            <h2 className="text-sm text-slate-500">{item.label}</h2>

            <p className="mt-3 text-2xl font-bold">—</p>

            <p className="mt-2 text-xs leading-5 text-slate-500">
              {item.note} · Tính năng sẽ được bổ sung sau.
            </p>
          </Card>
        ))}
      </section>

      <Card className="min-w-0">
        <h2 className="text-lg font-semibold">Recent Sessions</h2>

        <p className="mt-1 text-sm text-slate-500">
          Tối đa 5 phiên được tạo gần đây nhất.
        </p>

        {recentResult.error ? (
          <p role="alert" className="mt-5 text-sm text-red-600">
            Không tải được danh sách phiên. Vui lòng tải lại trang.
          </p>
        ) : sessions.length === 0 ? (
          <div className="mt-5 rounded-lg bg-slate-50 p-4">
            <p className="text-sm text-slate-600">
              Bạn chưa có phiên phỏng vấn nào.
            </p>

            <Link
              href="/interview/new"
              className="mt-3 inline-block rounded text-sm font-medium text-indigo-700 underline underline-offset-4"
            >
              Thiết lập phiên đầu tiên
            </Link>
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {sessions.map((session) => (
              <li
                key={session.id}
                className="flex flex-wrap items-center justify-between gap-3 py-4"
              >
                <div className="min-w-0">
                  <h3 className="break-words text-sm font-semibold">
                    {session.target_position ||
                      session.title ||
                      "Phiên phỏng vấn"}
                  </h3>

                  <p className="mt-1 text-xs text-slate-500">
                    {roundLabels[session.round_type] ??
                      session.round_type}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {displayDate(session.created_at)}
                  </p>
                </div>

                <span className="rounded-lg bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-700">
                  {statusLabels[session.status] ?? session.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
