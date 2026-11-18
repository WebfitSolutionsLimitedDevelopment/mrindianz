/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import type { PublicContestant } from "@/lib/contestants/repo";
import { KoruMark } from "./stage";

export function PortraitPlaceholder({ name, number }: { name: string; number: number | null }) {
  const initials = name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-[radial-gradient(90%_70%_at_50%_0%,#2a1d0c,#0a0908_70%)] text-center" role="img" aria-label={`Portrait of ${name} coming soon`}>
      <KoruMark className="absolute bottom-6 w-32 opacity-20" />
      <span className="font-display text-7xl text-gold-gradient">{initials}</span>
      {number !== null && <span className="mt-3 text-[10px] uppercase tracking-[0.3em] text-gold">No. {String(number).padStart(2, "0")}</span>}
      <span className="mt-2 text-[10px] uppercase tracking-[0.24em] text-white/50">Portrait coming soon</span>
    </div>
  );
}

export function ContestantCard({ c, votingOpen }: { c: PublicContestant; votingOpen: boolean }) {
  return (
    <article className="card group flex h-full flex-col overflow-hidden transition duration-500 hover:-translate-y-1.5">
      <Link href={`/contestants/${c.slug}`} className="relative block aspect-[4/5] overflow-hidden" tabIndex={-1} aria-hidden>
        {c.imageUrl ? (
          <img src={c.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover object-top transition-transform duration-700 group-hover:scale-105" />
        ) : (
          <PortraitPlaceholder name={c.name} number={c.number} />
        )}
        {c.number !== null && (
          <span className="absolute left-4 top-4 rounded-full bg-ink/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-gold backdrop-blur">No. {String(c.number).padStart(2, "0")}</span>
        )}
      </Link>
      <div className="flex flex-1 flex-col p-6">
        <p className="eyebrow">{c.cityRegion ?? "Mr. IndiaNZ 2027"}</p>
        <h3 className="mt-2 text-2xl text-espresso"><Link href={`/contestants/${c.slug}`} className="hover:text-gold-ink">{c.name}</Link></h3>
        {c.shortBio && <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-stone">{c.shortBio}</p>}
        <div className="mt-auto flex flex-wrap items-center gap-4 pt-6">
          <Link href={`/contestants/${c.slug}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-espresso hover:text-gold-ink">
            View profile <ArrowUpRight className="h-4 w-4" aria-hidden /><span className="sr-only">: {c.name}</span>
          </Link>
          {votingOpen && c.votingEligible && (
            <Link href={`/contestants/${c.slug}#vote`} className={buttonClasses("primary", "sm", "ml-auto")}>Vote<span className="sr-only"> for {c.name}</span></Link>
          )}
        </div>
      </div>
    </article>
  );
}
