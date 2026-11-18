import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

const tones = {
  gold: "border-gold/50 text-gold bg-gold/5",
  neutral: "border-espresso/20 text-stone",
  success: "border-success-ink/30 text-success-ink bg-success-ink/5",
  successDark: "border-success/50 text-success",
  danger: "border-danger-ink/40 text-danger-ink",
  ink: "border-ink/30 text-ink",
  pending: "border-gold-ink/40 text-gold-ink bg-gold/10",
};

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: keyof typeof tones; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]", tones[tone], className)}>
      {children}
    </span>
  );
}

/** Marker for copy or policies awaiting organiser/legal approval. Light by default; pass dark on black. */
export function PendingApproval({ light = true, dark = false, label = "Draft — pending approval" }: { light?: boolean; dark?: boolean; label?: string }) {
  return <Badge tone={dark || !light ? "gold" : "pending"}>{label}</Badge>;
}
