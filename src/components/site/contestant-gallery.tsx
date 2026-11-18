"use client";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { ContestantCard } from "./contestant-card";
import type { PublicContestant } from "@/lib/contestants/repo";
import { inputClasses } from "@/components/forms/field";

export function ContestantGallery({ contestants, votingOpen }: { contestants: PublicContestant[]; votingOpen: boolean }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return contestants;
    return contestants.filter((c) =>
      c.name.toLowerCase().includes(t) || (c.cityRegion ?? "").toLowerCase().includes(t) || (c.number !== null && String(c.number).padStart(2, "0").includes(t)));
  }, [q, contestants]);
  return (
    <div>
      <div className="relative mb-8 max-w-md">
        <label htmlFor="contestant-search" className="sr-only">Search contestants by name, number or city</label>
        <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-mist" />
        <input id="contestant-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, number or city" className={`${inputClasses} pl-11`} />
      </div>
      <p className="sr-only" aria-live="polite">{filtered.length} contestants shown</p>
      {filtered.length === 0 ? (
        <p className="text-mist">No contestants match “{q}”.</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((c) => <ContestantCard key={c.id} c={c} votingOpen={votingOpen} />)}
        </div>
      )}
    </div>
  );
}
