import type { Metadata } from "next";
import ReportLoader from "@/components/report/ReportLoader";
import ReportView from "@/components/report/ReportView";
import { REPORT_DEMOS, mockReport, type ReportDemo } from "@/lib/report-view/mock";
import { REPORT_STATE_TEXT } from "@/lib/report-view/text";

export const metadata: Metadata = {
  title: "Báo cáo phỏng vấn – InterviewBuddy",
};

// Screen 6 – Interview Results Report (UC-09), /reports/[sessionId]. Owner: Tài.
// SCRUM-198 (W8): loads GET /api/report/{sessionId} (Nhân, SCRUM-186) with loading and error states.
// Sample data stays available for design review: /reports/anything?demo=default|typed|behavioral|summary-unavailable|en
export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ demo?: string }>;
}) {
  const { sessionId } = await params;
  const { demo } = await searchParams;

  if (REPORT_DEMOS.includes(demo as ReportDemo)) {
    return (
      <div className="space-y-4">
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800" role="note">
          {REPORT_STATE_TEXT.sampleNote}
        </p>
        <ReportView report={mockReport(demo as ReportDemo)} />
      </div>
    );
  }

  return <ReportLoader sessionId={sessionId} />;
}
