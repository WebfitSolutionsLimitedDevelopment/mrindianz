import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

export function Section({ children, tone = "dark", className, id, labelledBy }: {
  children: ReactNode; tone?: "dark" | "charcoal" | "light"; className?: string; id?: string; labelledBy?: string;
}) {
  const tones = {
    dark: "bg-ink text-ivory",
    charcoal: "bg-charcoal text-ivory",
    light: "surface-light bg-ivory text-ink",
  };
  return (
    <section id={id} aria-labelledby={labelledBy} className={cn("py-16 sm:py-24", tones[tone], className)}>
      <div className="container-x">{children}</div>
    </section>
  );
}

export function SectionHeading({ eyebrow, title, id, intro, align = "left", as: As = "h2" }: {
  eyebrow?: string; title: string; id?: string; intro?: ReactNode; align?: "left" | "center"; as?: "h1" | "h2";
}) {
  return (
    <div className={cn("mb-10 max-w-3xl", align === "center" && "mx-auto text-center")}>
      {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
      <As id={id} className={cn(As === "h1" ? "text-4xl sm:text-6xl" : "text-3xl sm:text-5xl", "leading-tight")}>{title}</As>
      {intro && <div className="mt-5 text-base leading-relaxed opacity-85 sm:text-lg">{intro}</div>}
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
