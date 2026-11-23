import type { Metadata } from "next";
import ReportView from "@/components/report/ReportView";
import { REPORT_DEMOS, mockReport, type ReportDemo } from "@/lib/report-view/mock";

export const metadata: Metadata = {
  title: "Báo cáo phỏng vấn – InterviewBuddy",
};

// Screen 6 – Interview Results Report (UC-09), /reports/[sessionId]. Owner: Tài.
// SCRUM-185 (W7): skeleton with sample data, so the layout can be reviewed before the API is merged.
// Try the states with ?demo=typed | behavioral | summary-unavailable | en.
// W8: load GET /api/report/{sessionId} (Nhân, SCRUM-186) with loading and error states
// (NOT_FOUND, SESSION_NOT_COMPLETED, NO_SCORED_ANSWERS) and remove the sample-data notice.
export default async function ReportPage({
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ demo?: string }>;
}) {
  const { demo } = await searchParams;
  const variant: ReportDemo = REPORT_DEMOS.includes(demo as ReportDemo) ? (demo as ReportDemo) : "default";
  const report = mockReport(variant);

  return (
    <div className="space-y-4">
      <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800" role="note">
        Dữ liệu mẫu: trang này chưa nối API báo cáo (sẽ nối ở tuần 8). Các con số dưới đây không phải kết quả thật của bạn.
      </p>
      <ReportView report={report} />
    </div>
  );
}
