import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

export const inputClasses =
  "block w-full rounded-xl border border-espresso/15 bg-white px-4 py-3 text-base text-espresso shadow-[inset_0_1px_2px_rgba(42,33,23,.04)] placeholder:text-stone/60 transition focus:border-gold-deep focus:outline-none focus:ring-4 focus:ring-gold/15 aria-[invalid=true]:border-danger-ink";

export function Field({ id, label, required, hint, error, children, className }: {
  id: string; label: ReactNode; required?: boolean; hint?: ReactNode; error?: string; children: ReactNode; className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <label htmlFor={id} className="block text-sm font-semibold text-espresso">
        {label} {required ? <span className="text-gold-deep" aria-hidden>*</span> : <span className="font-normal text-stone">(optional)</span>}
        {required && <span className="sr-only"> (required)</span>}
      </label>
      {hint && <p id={`${id}-hint`} className="text-sm text-stone">{hint}</p>}
      {children}
      {error && <p id={`${id}-error`} className="text-sm font-medium text-danger-ink" role="alert">{error}</p>}
    </div>
  );
}

export function describedBy(id: string, hint?: unknown, error?: unknown) {
  return [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
}
