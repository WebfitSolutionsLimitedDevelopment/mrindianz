/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import type { PublicContestant } from "@/lib/contestants/repo";

export function PortraitPlaceholder({ name, number }: { name: string; number: number | null }) {
  const initials = name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-charcoal-2 text-center" role="img" aria-label={`Portrait of ${name} coming soon`}>
      <span className="font-display text-6xl text-gold/80">{initials}</span>
      {number !== null && <span className="mt-2 text-xs uppercase tracking-[0.2em] text-mist">No. {String(number).padStart(2, "0")}</span>}
      <span className="mt-4 text-[11px] uppercase tracking-[0.2em] text-mist/70">Portrait coming soon</span>
    </div>
  );
}

export function ContestantCard({ c, votingOpen }: { c: PublicContestant; votingOpen: boolean }) {
  return (
    <article className="group flex h-full flex-col border border-line bg-charcoal">
      <Link href={`/contestants/${c.slug}`} className="block aspect-[4/5] overflow-hidden" tabIndex={-1} aria-hidden>
        {c.imageUrl ? (
          <img src={c.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]" />
        ) : (
          <PortraitPlaceholder name={c.name} number={c.number} />
        )}
      </Link>
      <div className="flex flex-1 flex-col p-5">
        {c.number !== null && <p className="eyebrow">Contestant {String(c.number).padStart(2, "0")}</p>}
        <h3 className="mt-1 text-2xl"><Link href={`/contestants/${c.slug}`} className="hover:text-gold">{c.name}</Link></h3>
        {c.cityRegion && <p className="text-sm text-mist">{c.cityRegion}</p>}
        {c.shortBio && <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-ivory/85">{c.shortBio}</p>}
        <div className="mt-auto flex flex-wrap gap-3 pt-5">
          <Link href={`/contestants/${c.slug}`} className={buttonClasses("secondary", "sm")}>View Profile<span className="sr-only">: {c.name}</span></Link>
          {votingOpen && c.votingEligible && (
            <Link href={`/contestants/${c.slug}#vote`} className={buttonClasses("primary", "sm")}>Vote &amp; Support<span className="sr-only"> {c.name}</span></Link>
          )}
        </div>
      </div>
    </article>
  );
}
