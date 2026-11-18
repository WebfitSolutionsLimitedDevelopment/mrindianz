"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useEffect, useState } from "react";
import { buttonClasses } from "@/components/ui/button";
import type { LeaderboardRow } from "@/lib/voting/repo";

export function Leaderboard({ initial, initialTotal, refreshSeconds, votingOpen, live }: {
  initial: LeaderboardRow[]; initialTotal: number | null; refreshSeconds: number; votingOpen: boolean; live: boolean;
}) {
  const [rows, setRows] = useState(initial);
  const [total, setTotal] = useState(initialTotal);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!live) return;
    let stopped = false;
    const load = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/leaderboard", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { rows: LeaderboardRow[]; total: number | null; updatedAt: string };
        if (!stopped) {
          setRows(data.rows);
          setTotal(data.total);
          setUpdatedAt(data.updatedAt);
        }
      } catch { /* keep last known values */ }
    };
    const id = setInterval(load, Math.max(10, refreshSeconds) * 1000);
    return () => { stopped = true; clearInterval(id); };
  }, [live, refreshSeconds]);

  if (rows.length === 0) return <p className="text-stone">The leaderboard will appear once finalists are announced.</p>;
  const showVotes = rows.some((r) => r.votes !== null);
  const showRank = rows.some((r) => r.rank !== null);

  return (
    <div>
      {total !== null && (
        <p className="mb-6 text-sm text-stone">
          <span className="font-display text-4xl text-gold-ink">{total.toLocaleString("en-NZ")}</span> verified votes
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[320px] border-collapse text-left">
          <caption className="sr-only">People&apos;s Choice leaderboard{updatedAt ? `, updated ${new Date(updatedAt).toLocaleTimeString("en-NZ")}` : ""}</caption>
          <thead>
            <tr className="border-b border-espresso/15 text-[11px] uppercase tracking-[0.14em] text-stone">
              {showRank && <th scope="col" className="py-3 pr-3">Rank</th>}
              <th scope="col" className="py-3 pr-3">Contestant</th>
              {showVotes && <th scope="col" className="py-3 pr-3 text-right">Votes</th>}
              <th scope="col" className="py-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.contestantId} className="border-b border-espresso/15/60">
                {showRank && <td className="py-3 pr-3 font-display text-2xl text-gold-ink">{r.rank}</td>}
                <td className="py-3 pr-3">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 shrink-0 overflow-hidden bg-ivory-2">
                      {r.imageUrl ? <img src={r.imageUrl} alt="" className="h-full w-full object-cover object-top" loading="lazy" /> : <span aria-hidden className="flex h-full items-center justify-center font-display text-gold-ink/70">{r.name[0]}</span>}
                    </div>
                    <div>
                      {r.number !== null && <p className="text-[11px] uppercase tracking-[0.14em] text-stone">No. {String(r.number).padStart(2, "0")}</p>}
                      <p className="font-medium">{r.name}</p>
                    </div>
                  </div>
                </td>
                {showVotes && <td className="py-3 pr-3 text-right tabular-nums">{r.votes?.toLocaleString("en-NZ")}</td>}
                <td className="py-3 text-right">
                  <div className="flex flex-col items-end gap-2 sm:flex-row sm:justify-end">
                    <Link href={`/contestants/${r.slug}`} className={buttonClasses("ghost", "sm")}>Profile<span className="sr-only"> of {r.name}</span></Link>
                    {votingOpen && <Link href={`/contestants/${r.slug}#vote`} className={buttonClasses("primary", "sm")}>Vote<span className="sr-only"> for {r.name}</span></Link>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {live && <p className="mt-3 text-xs text-stone" aria-live="polite">Updates every {refreshSeconds} seconds. Only verified, paid votes are counted.</p>}
    </div>
  );
}
