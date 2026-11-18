import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

const tones = {
  gold: "border-gold/60 text-gold",
  neutral: "border-mist/40 text-mist",
  success: "border-success/60 text-success",
  danger: "border-danger/60 text-danger",
  ink: "border-ink/30 text-ink",
  pending: "border-gold-ink/50 text-gold-ink bg-gold/10",
};

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: keyof typeof tones; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em]", tones[tone], className)}>
      {children}
    </span>
  );
}

/** Visible marker for copy or policies that still need organiser/legal approval. */
export function PendingApproval({ light = false, label = "Draft — pending approval" }: { light?: boolean; label?: string }) {
  return <Badge tone={light ? "pending" : "gold"}>{label}</Badge>;
}
