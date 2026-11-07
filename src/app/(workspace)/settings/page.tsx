"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export default function SettingsPage() {
  const [language, setLanguage] = useState("vi");
  const [loaded, setLoaded] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const lock = useRef(false);
  const router = useRouter();
  async function load() {
    try {
      const response = await fetch("/api/settings", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || "Không tải được cài đặt.");
      setLanguage(result.preferredLanguage); setLoaded(true); setMessage("");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Mất kết nối."); }
  }
  useEffect(() => {
    let active = true;
    fetch("/api/settings", { cache: "no-store" }).then(async response => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || "Không tải được cài đặt.");
      if (active) { setLanguage(result.preferredLanguage); setLoaded(true); }
    }).catch(error => { if (active) setMessage(error.message); });
    return () => { active = false; };
  }, []);
  async function mutate(remove: boolean) {
    if (lock.current || (!remove && !loaded) || (remove && confirmation !== "DELETE")) return;
    lock.current = true; setBusy(true); setMessage("");
    try {
      const response = await fetch(remove ? "/api/settings/data" : "/api/settings", { method: remove ? "DELETE" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(remove ? { confirmation } : { preferredLanguage: language }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || "Không hoàn thành yêu cầu.");
      setMessage(remove ? `Đã xóa ${result.sessionsDeleted} phiên và ${result.analysesDeleted} phân tích CV/JD. Tài khoản và hồ sơ được giữ lại.` : "Đã lưu ngôn ngữ mặc định cho phiên mới.");
      if (remove) setConfirmation("");
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Mất kết nối. Hãy kiểm tra dữ liệu trước khi thử lại."); }
    finally { lock.current = false; setBusy(false); }
  }
  return <div className="max-w-3xl space-y-6"><h1 className="text-2xl font-bold">Cài đặt</h1>
    <Card><h2 className="text-lg font-semibold">Ngôn ngữ ưu tiên</h2><p className="my-3 text-sm text-slate-600">Dùng làm mặc định khi tạo phiên mới. Không thay đổi ngôn ngữ các phiên đã có.</p>
      <label htmlFor="preferred-language" className="block text-sm font-medium">Ngôn ngữ</label><select id="preferred-language" disabled={!loaded || busy} value={language} onChange={e => setLanguage(e.target.value)} className="my-3 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3"><option value="vi">Tiếng Việt</option><option value="en">English</option></select>
      <Button disabled={!loaded || busy} onClick={() => void mutate(false)}>Lưu cài đặt</Button>{!loaded && <Button variant="secondary" disabled={busy} onClick={() => void load()} className="ml-2">Tải lại</Button>}
    </Card>
    <Card><h2 className="text-lg font-semibold text-red-700">Xóa CV và lịch sử</h2><p className="my-3 text-sm leading-6 text-slate-600">Xóa toàn bộ phân tích CV/JD, bản sao CV trong phiên, các phiên phỏng vấn, câu trả lời, phản hồi và báo cáo của bạn. Không thể khôi phục. Tài khoản, hồ sơ và ngôn ngữ được giữ lại. Đóng các tab luyện tập trước khi xóa.</p>
      <Input id="delete-confirmation" label="Nhập DELETE để xác nhận" autoComplete="off" value={confirmation} disabled={busy} onChange={e => setConfirmation(e.target.value)} />
      <Button disabled={busy || confirmation !== "DELETE"} onClick={() => void mutate(true)} className="mt-4 bg-red-700 hover:bg-red-800">Xóa CV và lịch sử của tôi</Button>
    </Card><p role="status" aria-live="polite" className="break-words text-sm">{busy ? "Đang xử lý…" : message}</p>
  </div>;
}
