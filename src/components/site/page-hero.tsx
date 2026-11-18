import type { ReactNode } from "react";
import { StageBackdrop } from "./stage";

/** Dark cinematic banner used at the top of every inner page. */
export function PageHero({ eyebrow, title, intro, children }: { eyebrow?: string; title: ReactNode; intro?: ReactNode; children?: ReactNode }) {
  return (
    <section className="on-dark relative isolate overflow-hidden bg-ink pb-16 pt-36 text-ivory sm:pb-24 sm:pt-44">
      <StageBackdrop intensity="soft" />
      <div className="container-x relative">
        {eyebrow && <p className="eyebrow eyebrow-dark mb-5 animate-rise">{eyebrow}</p>}
        <h1 className="max-w-4xl animate-rise text-[2.6rem] leading-[1.05] text-white [animation-delay:80ms] sm:text-6xl lg:text-7xl">{title}</h1>
        <div className="rule-gold mt-7" />
        {intro && <div className="mt-7 max-w-2xl animate-rise text-base leading-relaxed text-mist [animation-delay:160ms] sm:text-lg">{intro}</div>}
        {children && <div className="mt-8">{children}</div>}
      </div>
    </section>
  );
}
