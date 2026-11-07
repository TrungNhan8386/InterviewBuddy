import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/interview/session-contract.mjs";
import InterviewChat from "@/components/interview/InterviewChat";

export default async function InterviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect("/login");
  const { data, error } = await client.from("interview_sessions").select("id,target_position,input_mode").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (error) throw new Error("Không tải được phiên. Hãy thử lại.");
  if (!data) notFound();
  return <InterviewChat sessionId={id} title={data.target_position || "Phỏng vấn"} voice={data.input_mode === "voice"} />;
}
