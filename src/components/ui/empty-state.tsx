import type { ReactNode } from "react";

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="border border-line bg-charcoal px-6 py-14 text-center sm:px-12">
      <div aria-hidden className="rule-gold mx-auto mb-8 w-24" />
      <h2 className="text-3xl sm:text-4xl">{title}</h2>
      {children && <div className="mx-auto mt-4 max-w-xl text-mist">{children}</div>}
      {action && <div className="mt-8">{action}</div>}
    </div>
  );
}
