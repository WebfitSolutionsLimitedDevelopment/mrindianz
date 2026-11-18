import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export const adminInput =
  "block w-full rounded border border-line bg-ink px-3 py-2 text-sm text-ivory placeholder:text-mist/60 focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold";

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-3xl text-sm text-mist">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, children, className, actions }: { title?: string; children: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    <section className={cn("rounded border border-line bg-charcoal p-5", className)}>
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-gold">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, href, note }: { label: string; value: ReactNode; href?: string; note?: string }) {
  const inner = (
    <>
      <p className="text-[11px] uppercase tracking-[0.14em] text-mist">{label}</p>
      <p className="mt-2 font-display text-4xl text-ivory">{value}</p>
      {note && <p className="mt-1 text-xs text-mist">{note}</p>}
    </>
  );
  return href ? <Link href={href} className="block rounded border border-line bg-charcoal p-5 hover:border-gold">{inner}</Link> : <div className="rounded border border-line bg-charcoal p-5">{inner}</div>;
}

export function AdminField({ label, name, children, hint, className }: { label: string; name?: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={cn("block space-y-1.5", className)} htmlFor={name}>
      <span className="text-xs font-semibold uppercase tracking-[0.1em] text-mist">{label}</span>
      {children}
      {hint && <span className="block text-xs text-mist/80">{hint}</span>}
    </label>
  );
}

export function Flash({ ok, error }: { ok?: string; error?: string }) {
  if (!ok && !error) return null;
  return (
    <p role={error ? "alert" : "status"} className={cn("mb-6 rounded border p-3 text-sm", error ? "border-danger/60 text-danger" : "border-success/60 text-success")}>
      {error ?? ok}
    </p>
  );
}

export function AdminButton({ children, variant = "primary", className, ...props }: React.ComponentProps<"button"> & { variant?: "primary" | "secondary" | "danger" }) {
  return (
    <button
      className={cn(
        "inline-flex min-h-9 items-center justify-center gap-2 rounded px-4 text-xs font-semibold uppercase tracking-[0.12em] disabled:opacity-50",
        variant === "primary" && "bg-gold text-ink hover:bg-ivory",
        variant === "secondary" && "border border-line text-ivory hover:border-gold",
        variant === "danger" && "bg-danger-ink text-white hover:bg-red-800",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function StatusPill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "gold" | "success" | "danger" }) {
  const tones = { neutral: "border-line text-mist", gold: "border-gold/60 text-gold", success: "border-success/60 text-success", danger: "border-danger/60 text-danger" };
  return <span className={cn("inline-block whitespace-nowrap rounded border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em]", tones[tone])}>{children}</span>;
}

export function Table({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto rounded border border-line"><table className="w-full min-w-[640px] text-left text-sm">{children}</table></div>;
}
export const th = "border-b border-line bg-charcoal px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-mist";
export const td = "border-b border-line/60 px-3 py-2 align-top";
