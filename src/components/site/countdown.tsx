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
    <p className="inline-flex items-baseline gap-3 border-l-2 border-gold pl-4" aria-live="off">
      <span className="font-display text-5xl leading-none text-gold sm:text-6xl">{days}</span>
      <span className="text-xs uppercase tracking-[0.2em] text-mist">{days === 1 ? "day" : "days"} {days === 0 ? "— it's today" : `to ${label}`}</span>
    </p>
  );
}
