import { useEffect, useState } from "react";
import { useLocale } from "@/lib/locale";

function parts(target: number, now: number) {
  const diff = Math.max(0, target - now);
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor(diff / 3600000) % 24,
    minutes: Math.floor(diff / 60000) % 60,
    seconds: Math.floor(diff / 1000) % 60,
    done: diff === 0,
  };
}

export function Countdown({ date, compact = false }: { date: string; compact?: boolean }) {
  const { text } = useLocale();
  const target = new Date(`${date}T00:00:00`).getTime();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!Number.isFinite(target)) return null;
  const p = parts(target, now);

  if (compact) {
    return (
      <span className="text-xs font-medium text-primary">
        {p.done ? text("Onderweg", "Travelling") : text(`nog ${p.days}d ${p.hours}u`, `${p.days}d ${p.hours}h remaining`)}
      </span>
    );
  }

  const cells: [number, string][] = [
    [p.days, text("dagen", "days")],
    [p.hours, text("uur", "hours")],
    [p.minutes, "min"],
    [p.seconds, "sec"],
  ];

  return (
    <div className="flex gap-2">
      {cells.map(([v, label]) => (
        <div key={label} className="min-w-16 rounded-xl bg-muted/60 px-3 py-2 text-center">
          <div className="font-display text-xl font-semibold tabular-nums">
            {String(v).padStart(2, "0")}
          </div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
        </div>
      ))}
    </div>
  );
}
