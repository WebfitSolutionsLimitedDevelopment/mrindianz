import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

type Tone = "ivory" | "cream" | "dark" | "light" | "charcoal";

export function Section({ children, tone = "ivory", className, id, labelledBy, contained = true, backdrop }: {
  children: ReactNode; tone?: Tone; className?: string; id?: string; labelledBy?: string; contained?: boolean; backdrop?: ReactNode;
}) {
  const tones: Record<Tone, string> = {
    ivory: "bg-ivory text-espresso",
    light: "bg-ivory text-espresso",
    cream: "texture-silk bg-cream text-espresso",
    dark: "on-dark bg-ink text-ivory",
    charcoal: "on-dark bg-onyx text-ivory",
  };
  return (
    <section id={id} aria-labelledby={labelledBy} className={cn("relative isolate py-20 sm:py-28", tones[tone], className)}>
      {backdrop}
      {contained ? <div className="container-x relative">{children}</div> : children}
    </section>
  );
}

export function SectionHeading({ eyebrow, title, id, intro, align = "left", as: As = "h2", dark = false, className }: {
  eyebrow?: string; title: ReactNode; id?: string; intro?: ReactNode; align?: "left" | "center"; as?: "h1" | "h2"; dark?: boolean; className?: string;
}) {
  return (
    <div className={cn("mb-12 max-w-3xl", align === "center" && "mx-auto text-center", className)}>
      {eyebrow && <p className={cn("eyebrow mb-4", dark && "eyebrow-dark")}>{eyebrow}</p>}
      <As id={id} className={cn(As === "h1" ? "text-[2.6rem] sm:text-6xl lg:text-7xl" : "text-[2.15rem] sm:text-5xl", "leading-[1.08]", dark ? "text-white" : "text-espresso")}>{title}</As>
      <div className={cn("rule-gold mt-6", align === "center" && "mx-auto")} />
      {intro && <div className={cn("mt-6 text-base leading-relaxed sm:text-lg", dark ? "text-mist" : "text-stone")}>{intro}</div>}
    </div>
  );
}

export function Prose({ text, className }: { text: string; className?: string }) {
  const paras = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return (
    <div className={cn("prose-site", className)}>
      {paras.map((p, i) => <p key={i}>{p}</p>)}
    </div>
  );
}
