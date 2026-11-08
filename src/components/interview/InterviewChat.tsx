"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import AiPracticeNotice from "./AiPracticeNotice";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

type Question = { id: string; content: string; position: number; answers: { id: string; content: string }[] };
export default function InterviewChat({ sessionId, title, voice }: { sessionId: string; title: string; voice: boolean }) {
  const [client] = useState(() => createClient());
  const [questions, setQuestions] = useState<Question[]>([]);
  const [status, setStatus] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState("");
  const lock = useRef(false);
  const loadSnapshot = useCallback(async () => {
    const [session, turns] = await Promise.all([
      client.from("interview_sessions").select("status").eq("id", sessionId).maybeSingle(),
      client.from("questions").select("id,content,position,answers(id,content)").eq("session_id", sessionId).order("position", { ascending: true }),
    ]);
    if (session.error || turns.error) throw new Error("Không tải được phiên. Hãy thử tải lại.");
    if (!session.data) throw new Error("Phiên không tồn tại hoặc bạn cần đăng nhập lại.");
    type Answer = { id: string; content: string };

    type RawQuestion = Omit<Question, "answers"> & {
      answers: Answer | Answer[] | null;
    };

    const rows = (turns.data ?? []) as unknown as RawQuestion[];

    const normalizedQuestions: Question[] = rows.map((question) => ({
      ...question,
      answers: Array.isArray(question.answers)
        ? question.answers
        : question.answers
          ? [question.answers]
          : [],
    }));

    return {
      questions: normalizedQuestions,
      status: session.data.status as string,
    };
  }, [client, sessionId]);
  async function reload() {
    const snapshot = await loadSnapshot();
    setQuestions(snapshot.questions); setStatus(snapshot.status); setLoaded(true);
  }
  useEffect(() => {
    let active = true;
    void loadSnapshot().then(snapshot => {
      if (active) { setQuestions(snapshot.questions); setStatus(snapshot.status); setLoaded(true); }
    }).catch(error => { if (active) setMessage(error.message); });
    return () => { active = false; };
  }, [loadSnapshot]);
  const current = questions.at(-1);
  const savedAnswer = current?.answers?.[0];
  async function advance() {
    if (lock.current || !loaded || status !== "in_progress") return;
    if (current && !savedAnswer && !answer.trim()) { setMessage("Vui lòng nhập câu trả lời."); return; }
    lock.current = true; setBusy(true); setMessage("");
    try {
      let afterAnswerId = savedAnswer?.id ?? null;
      if (current && !afterAnswerId) {
        const result = await client.rpc("save_own_interview_answer", { p_session_id: sessionId, p_question_id: current.id, p_content: answer });
        if (result.error) throw new Error("Không lưu được câu trả lời. Hãy tải lại để kiểm tra phiên; nội dung đang nhập được giữ lại.");
        afterAnswerId = result.data;
        await reload(); setAnswer("");
      }
      const response = await fetch("/api/interview/next", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId, afterAnswerId }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || "Chưa lấy được câu hỏi. Hãy thử lại sau.");
      await reload();
      if (result.action === "end") setMessage("Buổi luyện tập đã kết thúc. Phần chấm điểm sẽ được bổ sung sau.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Mất kết nối. Hãy tải lại để kiểm tra trước khi thử tiếp.");
    } finally { lock.current = false; setBusy(false); }
  }
  return <div className="mx-auto max-w-3xl space-y-5"><h1 className="break-words text-2xl font-bold">{title}</h1><AiPracticeNotice />
    {voice && <p className="text-sm text-slate-600">Chế độ giọng nói đã được ghi nhận. Hiện bạn có thể luyện tập bằng câu trả lời văn bản.</p>}
    <ol className="space-y-4">{questions.map((question, index) => <li key={question.id}><Card><h2 className="font-semibold">Câu hỏi {index + 1}</h2><p className="mt-2 whitespace-pre-wrap break-words">{question.content}</p>{(question.answers ?? []).map(item => <div key={item.id} className="mt-4 rounded-lg bg-indigo-50 p-3"><p className="text-xs font-semibold text-indigo-700">Câu trả lời của bạn</p><p className="mt-2 whitespace-pre-wrap break-words">{item.content}</p></div>)}</Card></li>)}</ol>
    {loaded && status === "in_progress" && <Card>
      {current && !savedAnswer && <><label className="block text-sm font-medium" htmlFor="interview-answer">Câu trả lời</label><textarea id="interview-answer" rows={6} maxLength={12000} value={answer} disabled={busy} onChange={e => setAnswer(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 p-3" /></>}
      <Button disabled={busy} className="mt-3" onClick={() => void advance()}>{busy ? "Đang xử lý…" : !current ? "Lấy câu hỏi đầu tiên" : savedAnswer ? "Lấy câu hỏi tiếp theo / thử lại" : "Gửi câu trả lời"}</Button>
    </Card>}
    {loaded && status !== "in_progress" && <p>Phiên đã kết thúc.</p>}
    <p role="status" aria-live="polite" className="break-words text-sm">{message}</p>
    <div className="flex flex-wrap items-center gap-4"><Button variant="secondary" disabled={busy} onClick={() => { void reload().then(() => setMessage("Đã tải lại phiên.")).catch(error => setMessage(error.message)); }}>Tải lại phiên</Button><Link className="text-indigo-700 underline" href="/dashboard">Về Dashboard</Link></div>
  </div>;
}
