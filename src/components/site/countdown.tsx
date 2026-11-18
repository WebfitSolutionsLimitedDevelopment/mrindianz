"use client";
import { useEffect, useState } from "react";
import { daysUntilNzDate } from "@/lib/format";

/** Day-level countdown (the finale start time is not yet confirmed, so no hours/minutes). */
export function Countdown({ date, label }: { date: string; label: string }) {
  const [days, setDays] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setDays(daysUntilNzDate(date));
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [date]);
  if (days === null || days < 0) return null;
  return (
    <div className="inline-flex items-center gap-5 rounded-full border border-gold/30 bg-black/30 py-2.5 pl-3 pr-7 backdrop-blur-sm">
      <span className="flex h-14 min-w-14 items-center justify-center rounded-full bg-gradient-to-b from-gold-bright to-gold-deep px-3 font-display text-2xl font-semibold text-ink">{days}</span>
      <span className="text-left text-[11px] uppercase leading-relaxed tracking-[0.22em] text-white/80">
        {days === 0 ? "It's today" : <>{days === 1 ? "Day" : "Days"} to<br />{label}</>}
      </span>
    </div>
  );
}
