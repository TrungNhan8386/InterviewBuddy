"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { todayInVietnam, validateCreateSession, isUuid } from "@/lib/interview/session-contract.mjs";
import AiPracticeNotice from "@/components/interview/AiPracticeNotice";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";

const roundOptions = [
  { value: "hr", label: "HR" },
  { value: "technical", label: "Technical" },
  { value: "behavioral", label: "Behavioral" },
];

const difficultyOptions = [
  { value: "easy", label: "Dễ" },
  { value: "medium", label: "Trung bình" },
  { value: "hard", label: "Khó" },
];

const languageOptions = [
  { value: "vi", label: "Tiếng Việt" },
  { value: "en", label: "English" },
];

const durationOptions = [
  { value: "15", label: "15 phút" },
  { value: "30", label: "30 phút" },
  { value: "45", label: "45 phút" },
];

const answerOptions = [
  { value: "text", label: "Văn bản" },
  { value: "voice", label: "Giọng nói" },
];

const initialForm = {
  targetPosition: "",
  roundType: "technical",
  difficulty: "medium",
  language: "vi",
  interviewDate: "",
  duration: "30",
  answerMode: "text",
};

type SetupForm = typeof initialForm;

type FormErrors = {
  targetPosition?: string;
  interviewDate?: string;
};

type Option = {
  value: string;
  label: string;
};

type ChoiceGroupProps = {
  name: string;
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
};

function ChoiceGroup({
  name,
  label,
  value,
  options,
  onChange,
}: ChoiceGroupProps) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-sm font-medium text-slate-700">
        {label}
      </legend>

      <div
        className={`grid gap-2 ${
          options.length === 2
            ? "grid-cols-2"
            : "grid-cols-1 sm:grid-cols-3"
        }`}
      >
        {options.map((option) => (
          <label key={option.value} className="min-w-0 cursor-pointer">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="peer sr-only"
            />

            <span className="flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-center text-sm text-slate-700 transition hover:border-indigo-400 peer-checked:border-indigo-600 peer-checked:bg-indigo-600 peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-indigo-600">
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function optionLabel(options: Option[], value: string) {
  return options.find((option) => option.value === value)?.label ?? "—";
}

function displayDate(value: string) {
  if (!value) return "Chưa chọn";

  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

export default function InterviewSetupPage() {
  const [form, setForm] = useState<SetupForm>(initialForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [createdId, setCreatedId] = useState("");
  const pending = useRef(false);
  const languageEdited = useRef(false);
  const targetEdited = useRef(false);
  const router = useRouter();
  useEffect(() => {
    let active = true;
    const client = createClient();
    void client.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: profile } = await client.from("profiles").select("preferred_language, target_position").eq("id", data.user.id).maybeSingle();
      if (!active || !profile) return;
      if (!languageEdited.current && ["vi", "en"].includes(profile.preferred_language)) {
        setForm(current => ({ ...current, language: profile.preferred_language }));
      }
      if (!targetEdited.current && profile.target_position?.trim()) {
        setForm(current => ({ ...current, targetPosition: profile.target_position!.trim() }));
      }
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  function updateField(field: keyof SetupForm, value: string) {
    if (field === "language") languageEdited.current = true;
    if (field === "targetPosition") targetEdited.current = true;
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    setMessage("");

    if (field === "targetPosition" || field === "interviewDate") {
      setErrors((current) => ({
        ...current,
        [field]: undefined,
      }));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || createdId) return;
    const payload = { targetPosition: form.targetPosition, type: form.roundType,
      difficulty: form.difficulty, language: form.language, interviewDate: form.interviewDate || null,
      durationMinutes: Number(form.duration), inputMode: form.answerMode };
    const validation = validateCreateSession(payload, { today: todayInVietnam() });
    const nextErrors: FormErrors = {};
    if (!form.targetPosition.trim()) nextErrors.targetPosition = "Vui lòng nhập vị trí mục tiêu.";
    if (!form.interviewDate || (!validation.ok && validation.fields.interviewDate)) nextErrors.interviewDate = "Chọn ngày hợp lệ, từ hôm nay trở đi (giờ Việt Nam).";
    setErrors(nextErrors);
    if (!validation.ok || Object.keys(nextErrors).length) { setMessage("Vui lòng kiểm tra thông tin đã nhập."); return; }
    pending.current = true; setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/interview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) {
        setErrors(result.error?.fields ?? {});
        throw new Error(response.status === 401 ? "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại ở tab khác rồi thử lại." : result.error?.message || "Không tạo được phiên. Hãy thử lại.");
      }
      if (!isUuid(result.sessionId)) throw new Error("Phản hồi không hợp lệ. Hãy kiểm tra Dashboard trước khi tạo lại phiên.");
      setCreatedId(result.sessionId);
      router.push(`/interview/${result.sessionId}`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Mất kết nối. Kiểm tra Dashboard trước khi tạo lại để tránh trùng phiên.");
    } finally { pending.current = false; setBusy(false); }
  }

  const preview = [
    {
      label: "Vị trí",
      value: form.targetPosition.trim() || "Chưa nhập",
    },
    {
      label: "Vòng phỏng vấn",
      value: optionLabel(roundOptions, form.roundType),
    },
    {
      label: "Độ khó",
      value: optionLabel(difficultyOptions, form.difficulty),
    },
    {
      label: "Ngôn ngữ",
      value: optionLabel(languageOptions, form.language),
    },
    {
      label: "Ngày phỏng vấn",
      value: displayDate(form.interviewDate),
    },
    {
      label: "Thời lượng",
      value: optionLabel(durationOptions, form.duration),
    },
    {
      label: "Cách trả lời",
      value: optionLabel(answerOptions, form.answerMode),
    },
  ];

  return (
    <div className="space-y-6">
      <AiPracticeNotice />
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Thiết lập phỏng vấn
        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          Tạo một buổi luyện tập phù hợp với mục tiêu của bạn.
        </p>
      </div>

      <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4">
        <p className="text-sm font-medium text-indigo-800">
          Muốn luyện tập sát với công việc?
        </p>

        <p className="mt-1 text-sm leading-6 text-slate-600">
          Bạn có thể{" "}
          <Link
            href="/analysis"
            className="font-medium text-indigo-700 underline underline-offset-4"
          >
            phân tích CV và JD
          </Link>{" "}
          trước khi bắt đầu.
        </p>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card className="min-w-0">
          <h2 className="text-lg font-semibold">
            Thông tin buổi luyện tập
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            Chọn thông số bên dưới. Phần xem trước sẽ cập nhật ngay.
          </p>

          <form
            id="interview-setup-form"
            noValidate
            onSubmit={handleSubmit}
            className="mt-6 space-y-5"
          >
            <Input
              id="target-position"
              label="Vị trí mục tiêu *"
              placeholder="Ví dụ: Software Engineer Intern"
              value={form.targetPosition}
              onChange={(event) =>
                updateField("targetPosition", event.target.value)
              }
              maxLength={120}
              required
              error={errors.targetPosition}
            />

            <ChoiceGroup
              name="round-type"
              label="Loại phỏng vấn"
              value={form.roundType}
              options={roundOptions}
              onChange={(value) => updateField("roundType", value)}
            />

            <ChoiceGroup
              name="difficulty"
              label="Độ khó"
              value={form.difficulty}
              options={difficultyOptions}
              onChange={(value) => updateField("difficulty", value)}
            />

            <ChoiceGroup
              name="language"
              label="Ngôn ngữ"
              value={form.language}
              options={languageOptions}
              onChange={(value) => updateField("language", value)}
            />

            <Input
              id="interview-date"
              label="Ngày phỏng vấn thực tế *"
              type="date"
              value={form.interviewDate}
              onChange={(event) =>
                updateField("interviewDate", event.target.value)
              }
              required
              error={errors.interviewDate}
            />

            <ChoiceGroup
              name="duration"
              label="Thời lượng"
              value={form.duration}
              options={durationOptions}
              onChange={(value) => updateField("duration", value)}
            />

            <ChoiceGroup
              name="answer-mode"
              label="Cách trả lời"
              value={form.answerMode}
              options={answerOptions}
              onChange={(value) => updateField("answerMode", value)}
            />

            {form.answerMode === "voice" && (
              <p className="rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-600">
                Phiên ghi nhận lựa chọn giọng nói. Trong trang luyện tập hiện tại, bạn vẫn có thể nhập câu trả lời bằng văn bản.
              </p>
            )}

            <Button type="submit" disabled={busy || !!createdId} className="w-full sm:w-auto">
              {busy ? "Đang tạo phiên…" : "Bắt đầu phỏng vấn"}
            </Button>

            <p
              role="status"
              aria-live="polite"
              className="text-sm leading-6 text-green-700"
            >
              {message}
            </p>
            {createdId && <Link className="block text-indigo-700 underline" href={`/interview/${createdId}`}>Mở phiên vừa tạo</Link>}
          </form>
        </Card>

        <aside aria-labelledby="session-preview-title" className="min-w-0">
          <Card className="border-indigo-100 bg-indigo-50">
            <p className="text-xs font-semibold tracking-widest text-indigo-600">
              PHIÊN CỦA BẠN
            </p>

            <h2
              id="session-preview-title"
              className="mt-3 text-xl font-semibold"
            >
              Xem trước phiên phỏng vấn
            </h2>

            <dl className="mt-6 space-y-4">
              {preview.map((item) => (
                <div
                  key={item.label}
                  className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-3"
                >
                  <dt className="text-sm text-slate-500">
                    {item.label}
                  </dt>

                  <dd className="min-w-0 break-words text-sm font-medium text-slate-900">
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>

            <Button
              type="submit" form="interview-setup-form" disabled={busy || !!createdId}
              className="mt-6 w-full"
              aria-describedby="start-session-note"
            >
              Bắt đầu phỏng vấn
            </Button>

            <p
              id="start-session-note"
              className="mt-3 text-xs leading-5 text-slate-500"
            >
              Phiên sẽ được lưu và mở trang luyện tập. Phân tích CV/JD gần nhất được liên kết nếu có.
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
