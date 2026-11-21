// SCRUM-174: overall score out of 10 as a ring.
export function scoreColor(score: number) {
  if (score >= 8) return { stroke: "stroke-emerald-500", text: "text-emerald-700", bar: "bg-emerald-500" };
  if (score >= 5) return { stroke: "stroke-amber-500", text: "text-amber-700", bar: "bg-amber-500" };
  return { stroke: "stroke-red-500", text: "text-red-700", bar: "bg-red-500" };
}

type Props = { score: number; label: string; outOf: string };

export default function ScoreRing({ score, label, outOf }: Props) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const value = Math.max(0, Math.min(10, score));
  const color = scoreColor(value);
  return (
    <div className="flex flex-col items-center" role="img" aria-label={`${label}: ${value.toFixed(1)}${outOf}`}>
      <div className="relative h-28 w-28">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
          <circle cx="50" cy="50" r={radius} className="fill-none stroke-slate-100" strokeWidth="10" />
          <circle
            cx="50"
            cy="50"
            r={radius}
            className={`fill-none ${color.stroke} transition-[stroke-dashoffset] duration-700`}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - value / 10)}
          />
        </svg>
        <div className="absolute inset-0 flex items-baseline justify-center pt-9">
          <span className={`font-mono text-3xl font-bold tabular-nums ${color.text}`}>{value.toFixed(1)}</span>
          <span className="text-sm text-slate-500">{outOf}</span>
        </div>
      </div>
      <p className="mt-1 text-sm font-medium text-slate-700">{label}</p>
    </div>
  );
}
