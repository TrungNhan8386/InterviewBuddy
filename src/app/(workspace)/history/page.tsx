import type { Metadata } from "next";
import HistoryView from "@/components/history/HistoryView";
import { HISTORY_DEMOS, type HistoryDemo } from "@/lib/history/mock";

export const metadata: Metadata = {
  title: "Lịch sử phỏng vấn – InterviewBuddy",
};

// History (UC-11), /history. Owner: Khang. SCRUM-206 (W8): skeleton with sample data.
// Try the states with ?demo=empty | error | loading. W9: connect to the History API (Hưng).
export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ demo?: string }> }) {
  const { demo } = await searchParams;
  const variant: HistoryDemo = HISTORY_DEMOS.includes(demo as HistoryDemo) ? (demo as HistoryDemo) : "default";
  return <HistoryView demo={variant} />;
}
