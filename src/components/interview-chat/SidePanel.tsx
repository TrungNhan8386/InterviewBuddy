import Link from "next/link";
import Card from "@/components/ui/Card";
import type { CHAT_TEXT } from "@/lib/interview-chat/text";
import type { ChatSession } from "@/lib/interview-chat/types";

type Props = {
  text: (typeof CHAT_TEXT)["vi"];
  session: ChatSession;
};

// SCRUM-99: role, skills from the analysis, tips. Also shows the AI notice (SCRUM-91).
export default function SidePanel({ text, session }: Props) {
  const { settings, skills } = session;

  return (
    <aside className="space-y-4">
      <Card className="space-y-3">
        <div>
          <p className="text-xs text-slate-500">{text.panelRole}</p>
          <p className="break-words font-semibold">{settings.targetPosition}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">{text.panelRound}</p>
          <p className="font-medium">
            {text.types[settings.type]} · {text.difficulties[settings.difficulty]}
          </p>
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold">{text.panelSkills}</h2>
        {skills && (skills.matched.length > 0 || skills.missing.length > 0) ? (
          <div className="mt-3 space-y-3">
            {skills.matched.length > 0 && (
              <div>
                <p className="text-xs text-slate-500">{text.panelMatched}</p>
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {skills.matched.map((s) => (
                    <li key={s} className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs text-emerald-800">
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {skills.missing.length > 0 && (
              <div>
                <p className="text-xs text-slate-500">{text.panelMissing}</p>
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {skills.missing.map((s) => (
                    <li key={s} className="rounded-full bg-amber-50 px-2.5 py-1 text-xs text-amber-800">
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500">
            {text.panelNoAnalysis}{" "}
            <Link href="/analysis" className="font-medium text-indigo-600 hover:underline">
              {text.panelAnalyze}
            </Link>
          </p>
        )}
      </Card>

      <Card>
        <h2 className="text-sm font-semibold">{text.panelTips}</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
          {text.tips[settings.type].map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      </Card>

      <p className="rounded-lg bg-slate-100 p-3 text-xs text-slate-600">{text.aiNotice}</p>
    </aside>
  );
}
