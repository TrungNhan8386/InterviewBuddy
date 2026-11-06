import type { Metadata } from "next";
import InterviewChat from "@/components/interview-chat/InterviewChat";

export const metadata: Metadata = {
  title: "Phỏng vấn – InterviewBuddy",
};

// Screen 4 (Chat Interview). Owner: Khang. Jira: SCRUM-95.
// The setup page (/interview/new, Tài, SCRUM-86) opens this page with the new session id.
export default async function InterviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // key: a new session id starts a fresh chat instead of reusing the old state.
  return <InterviewChat key={id} sessionId={id} />;
}
