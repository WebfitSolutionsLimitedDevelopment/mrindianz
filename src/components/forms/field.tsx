import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

export const inputClasses =
  "block w-full rounded-none border border-line bg-charcoal px-4 py-3 text-base text-ivory placeholder:text-mist/60 focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold aria-[invalid=true]:border-danger";

export function Field({ id, label, required, hint, error, children, className }: {
  id: string; label: ReactNode; required?: boolean; hint?: ReactNode; error?: string; children: ReactNode; className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <label htmlFor={id} className="block text-sm font-semibold text-ivory">
        {label} {required ? <span className="text-gold" aria-hidden>*</span> : <span className="font-normal text-mist">(optional)</span>}
        {required && <span className="sr-only"> (required)</span>}
      </label>
      {hint && <p id={`${id}-hint`} className="text-sm text-mist">{hint}</p>}
      {children}
      {error && <p id={`${id}-error`} className="text-sm font-medium text-danger" role="alert">{error}</p>}
    </div>
  );
}

export function describedBy(id: string, hint?: unknown, error?: unknown) {
  return [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
}
